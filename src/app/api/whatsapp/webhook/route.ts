import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Configuración general
const geminiKey = process.env.GEMINI_API_KEY;
const PAUSE_MINUTES = 10; // Pausa automática por intervención humana
const BUFFER_DELAY_MS = 3500; // Tiempo de espera para unificar mensajes consecutivos

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });

    const payload = await request.json();
    const webhookType = payload.typeWebhook;
    
    // Ignorar respuestas originadas por la propia API (el bot)
    if (webhookType === "outgoingAPIMessageReceived") {
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje propio del bot (API)" });
    }

    const chatId = payload.senderData?.chatId || payload.chatId || "";
    
    // =====================================================
    // 1. BLOQUEO DEFINITIVO DE GRUPOS
    // =====================================================
    if (chatId.includes("@g.us")) {
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje de grupo ignorado permanentemente" });
    }

    // =====================================================
    // 2. DETECCIÓN DE INTERVENCIÓN HUMANA (AUTO-PAUSA)
    // =====================================================
    // Si un agente humano escribió desde su WhatsApp móvil/web (outgoingMessage)
    if (webhookType === "outgoingMessage" || webhookType === "outgoingMessageReceived") {
      const targetPhone = chatId;
      if (!targetPhone) return NextResponse.json({ success: true, ignored: true });

      const pauseUntil = new Date(Date.now() + PAUSE_MINUTES * 60 * 1000).toISOString();
      await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", targetPhone);
      await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: targetPhone, paused_until: pauseUntil });
      
      console.log(`[WEBHOOK] 🛑 Humano intervino. Auto-pausa de ${PAUSE_MINUTES} min para ${targetPhone}.`);
      return NextResponse.json({ success: true, action: "auto_paused_human_intervention" });
    }

    // Solo continuamos con mensajes entrantes
    if (webhookType !== "incomingMessageReceived") {
      return NextResponse.json({ success: true, ignored: true, reason: "Tipo no procesable" });
    }

    const sender = payload.senderData?.sender || "";
    if (sender === payload.instanceData?.wid || sender === "") {
        return NextResponse.json({ success: true, ignored: true, reason: "Loop del propio bot evitado" });
    }

    // Prevención retrasos de Vercel (omitir > 2 minutos)
    const msgTimestamp = payload.messageData?.timestamp || payload.timestamp || 0;
    if (msgTimestamp) {
      if (Date.now() / 1000 - msgTimestamp > 120) {
        return NextResponse.json({ success: true, ignored: true, reason: "Mensaje muy antiguo" });
      }
    }

    // =====================================================
    // 3. EXTRACCIÓN DEL TEXTO O COMPROBANTE
    // =====================================================
    const typeMessage = payload.messageData?.typeMessage;
    let messageText = "";

    if (typeMessage === "textMessage") {
      messageText = payload.messageData?.textMessageData?.textMessage || "";
    } else if (typeMessage === "extendedTextMessage") {
      messageText = payload.messageData?.extendedTextMessageData?.text || "";
    } else {
      // 3B. ASUMIR COMPROBANTES / IMÁGENES
      messageText = "[EL CLIENTE HA ENVIADO UN COMPROBANTE DE PAGO, IMAGEN O ARCHIVO. Revísalo e indícale que lo vas a procesar pronto o derívalo a un humano.]";
    }

    if (!messageText.trim()) {
      return NextResponse.json({ success: true, ignored: true, reason: "Vacío" });
    }

    // =====================================================
    // ANTI-DUPLICADOS (Idempotency)
    // =====================================================
    const messageId = payload.idMessage || "";
    if (messageId) {
      const { error: dedupError } = await supabase.from("whatsapp_processed_messages").insert({ message_id: messageId });
      if (dedupError && dedupError.code === "23505") {
        return NextResponse.json({ success: true, ignored: true, reason: "DUPLICADO" });
      }
    }

    // =====================================================
    // 4. BUFFERING (ESPERA PARA MULTI-MENSAJES)
    // =====================================================
    // Guardamos el mensaje en historial de inmediato.
    const senderName = payload.senderData?.senderName || "Cliente";
    
    const { data: insertedChat, error: chatError } = await supabase.from("whatsapp_chats").insert({
      owner_id: uid,
      phone_number: sender,
      role: "user",
      content: messageText,
    }).select('id').single();

    if (chatError) throw chatError;
    const insertedId = insertedChat.id;

    // Pausa actíva para esperar si el usuario envía otro mensaje en los próximos 3.5 segundos
    await new Promise((r) => setTimeout(r, BUFFER_DELAY_MS));

    // Verificamos si este mensaje todavía es el último mensaje enviado por este usuario
    const { data: latestMsg } = await supabase
      .from("whatsapp_chats")
      .select("id")
      .eq("owner_id", uid)
      .eq("phone_number", sender)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestMsg && latestMsg.id !== insertedId) {
      console.log(`[WEBHOOK] ⏱️ Buffering: Llegó otro mensaje después. Abortando este hilo (se hará cargo el siguiente).`);
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje consolidado con uno más reciente" });
    }

    // =====================================================
    // CONTINÚA SOLO EL EVENTO DEL ÚLTIMO MENSAJE DEL BUFFER
    // Verificaciones Clásicas (Configuración, Pausas, Scammers)
    // =====================================================
    const client = await clerkClient();
    const user = await client.users.getUser(uid);
    if (!user) throw new Error("Usuario no encontrado en Clerk");

    const settings = user.publicMetadata?.whatsappSettings as any;
    if (!settings || !settings.isActive) return NextResponse.json({ success: true, ignored: true, reason: "Agente IA desactivado" });

    const { providerConfig, aiPersona, knowledgeBase } = settings;
    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      return NextResponse.json({ success: true, ignored: true, reason: "API telefonía no configurada" });
    }

    const waBaseUrl = providerConfig.apiUrl.replace(/\/$/, "");
    const sendWAMessage = async (message: string) => {
      const endpoint = `${waBaseUrl}/waInstance${providerConfig.idInstance}/sendMessage/${providerConfig.apiTokenInstance}`;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: sender, message }),
          signal: AbortSignal.timeout(8000), // timeout reducido para no atascar vercel con retries largos
        });
        return res.ok;
      } catch (e: any) {
        console.warn(`[WEBHOOK] Envio fallo: ${e.message}`);
        return false;
      }
    };

    // Comandos directos #pause / #bot enviados por webhook entrante (por si el agente se escribe a sí mismo u otros bypasses)
    const lowerMsg = messageText.trim().toLowerCase();
    if (lowerMsg === "#bot" || lowerMsg === "#pausa" || lowerMsg.startsWith("#pause")) {
      // Como ya tenemos el Auto-pause via "outgoingMessage", esto es solo de ayuda rápida para el dueño de la cuenta
      if (payload.instanceData?.wid === sender) {
        if (lowerMsg === "#bot") {
          await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid);
          return NextResponse.json({ success: true, action: "bot_reactivated_global" });
        }
        await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: "GLOBAL", paused_until: new Date(Date.now() + PAUSE_MINUTES * 60 * 1000).toISOString() });
        return NextResponse.json({ success: true, action: "bot_paused_global" });
      }
    }

    // Verificar si el bot está pausado para este número o globalmente
    const { data: pauses } = await supabase
      .from("whatsapp_pauses")
      .select("paused_until, phone_number")
      .eq("owner_id", uid)
      .in("phone_number", ["GLOBAL", sender]);

    const activePause = pauses?.find(p => new Date(p.paused_until) > new Date());
    if (activePause) {
       console.log(`[WEBHOOK] 🛑 Bot pausado para ${sender} o de forma Global. Ignorando.`);
       return NextResponse.json({ success: true, ignored: true, reason: "En Pausa Activa." });
    }

    // Detección Antifraude (Estafadores y Recargas)
    // El LLM usará todo el contexto, pero dejamos esta pequeña protección dura
    const rechargeKeywords = ["recarga", "recargar", "deposito", "depositar", "cargar"];
    const isRechargeRequest = rechargeKeywords.some((kw) => messageText.toLowerCase().includes(kw));
    if (isRechargeRequest) {
      const cleanPhone = sender.replace("@c.us", "");
      const { data: scammerData } = await supabase
        .from("scammers")
        .select("id")
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.0${cleanPhone.slice(-10)},phone_number.eq.593${cleanPhone.slice(-10)}`)
        .limit(1);

      if (scammerData && scammerData.length > 0) {
        await supabase.from("whatsapp_recargas").insert({ owner_id: uid, phone_number: sender, client_name: senderName, amount: null, status: "rejected", is_scammer: true });
        await sendWAMessage("Lo sentimos, no podemos procesar su solicitud. Comuníquese directamente con soporte humano.");
        return NextResponse.json({ success: true, action: "scammer_rejected" });
      }
    }

    // Indicador de escritura
    fetch(`${waBaseUrl}/waInstance${providerConfig.idInstance}/sendAction/${providerConfig.apiTokenInstance}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: sender, action: "typing" }), signal: AbortSignal.timeout(3000)
    }).catch(() => {});

    // =====================================================
    // 5. GENERACIÓN CON GEMINI (RÁPIDO Y DIRECTO)
    // =====================================================
    if (!geminiKey) return NextResponse.json({ error: "No Gemini Key" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { 
        maxOutputTokens: 250,  // Muy cortos
        temperature: 0.3,       // Foco analítico, menos rodeos
      },
    });

    const systemPrompt = `ERES UN ASISTENTE DE WHATSAPP DIRECTO Y EFICIENTE PARA ESTA EMPRESA.

REGLAS DE IDENTIDAD E-INTEGRIDAD:
1. NUNCA DES RODEOS NI EXPLIQUES TUS ACCIONES. SE CONCISO.
2. RESPONDE DIRECTO AL GRANO. Si te piden algo, dilo en máximo 2 oraciones.
3. SI TE MANDAN UN COMPROBANTE/IMAGEN/ARCHIVO asume que es el ticket de pago/solicitud. Agradécelo y diles cordialmente que en unos instantes se procesará de acuerdo con las políticas.
4. No intentes inventar datos o URLs que no estén en tu base de datos y conocimiento.
5. NO saludes si el contexto de la conversación ya está avanzado. Solo responde lo que te pregunta directamente.
6. NO escribas parrafos. Máximo texto permitido son tres o cuatro renglones.

TU COMPORTAMIENTO Y PERSONALIDAD:
${aiPersona}

TU BASE DE CONOCIMIENTO Y MENÚS DE PRECIOS:
${knowledgeBase}

Cliente: ${senderName}. Responde usando emojis moderados, usa listas breves si debes, y nunca pongas firmas (ej: "Atentamente el asistente").`;

    // Recuperamos el historial con los últimos mensajes, incluyendo los múltiples que pasaron por el Buffer!
    const { data: pastMessages } = await supabase
      .from("whatsapp_chats")
      .select("role, content")
      .eq("owner_id", uid)
      .eq("phone_number", sender)
      .order("created_at", { ascending: false })
      .limit(8);

    const chronologicalHistory = (pastMessages || []).reverse();
    
    // Unir mensajes seguidos del usuario para darle más contexto limpio al modelo
    const chatHistory: any[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido, seré directo y aplicaré las configuraciones estrictas indicadas." }] }
    ];

    // Formatear conversaciones preservando roles
    for (const msg of chronologicalHistory) {
      if (msg.role === "agent") continue; // Los humanos no entran al prompt por temas de colusión de identidad
      chatHistory.push({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    let aiResponse = "";
    try {
      const chat = model.startChat({ history: chatHistory });
      // Usaremos un trigger vacío porque todo el mensaje ya se agrupó en la historia que acabamos de meter
      // O le mandamos un ping de análisis: "Analiza el contexto y responde al usuario, manteniendo las reglas de concisión."
      const result = await chat.sendMessage("Responde orgánicamente siguiendo el último flujo del usuario que acabas de leer.");
      
      const finishReason = result.response?.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY" || finishReason === "OTHER") {
        aiResponse = "Derivaremos tu solicitud a un canal humano. Por favor, espera.";
      } else {
        aiResponse = result.response.text()?.trim() || "";
      }
    } catch (gemErr: any) {
      console.error(`[WEBHOOK] Error Gemini:`, gemErr.message);
      aiResponse = "En este momento experimentamos alta demanda. Por favor reinténtalo luego.";
    }

    if (!aiResponse) aiResponse = "🤖 Algo falló al procesar tu mensaje.";

    // Guardar la respuesta bot
    await supabase.from("whatsapp_chats").insert({ owner_id: uid, phone_number: sender, role: "model", content: aiResponse });

    await sendWAMessage(aiResponse);
    console.log("[WEBHOOK] ✅ Ejecución completada. Respuesta generada de forma optimizada.");

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[WEBHOOK] ❌ ERROR CRITICO:", error.message || String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", mode: "optimized_buffer_v2" });
}
