import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const geminiKey = process.env.GEMINI_API_KEY;
const PAUSE_MINUTES = 30; // Minutos que el bot se pausa cuando el agente humano responde

export async function POST(request: Request) {
  console.log("[WEBHOOK] ========== NUEVA PETICIÓN ==========");

  try {
    // 1. Obtener UID del query param
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) {
      return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });
    }

    // 2. Extraer el Payload del Webhook (Green-API format)
    const payload = await request.json();
    const webhookType = payload.typeWebhook;
    console.log("[WEBHOOK] typeWebhook:", webhookType, "| uid:", uid);

    // =====================================================
    // IGNORAR TIPOS QUE NO NOS INTERESAN
    // =====================================================
    // Ignorar mensajes salientes del bot enviados via API (evita loops infinitos)
    if (webhookType === "outgoingAPIMessageReceived") {
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje propio del bot" });
    }

    // Solo procesamos mensajes entrantes de chat (texto del cliente)
    if (webhookType !== "incomingMessageReceived") {
      console.log("[WEBHOOK] Ignorado - tipo no procesable:", webhookType);
      return NextResponse.json({ success: true, ignored: true, reason: "Tipo no procesable" });
    }

    // =====================================================
    // EXTRAER DATOS CLAVE DEL MENSAJE ENTRANTE
    // =====================================================
    const sender: string = payload.senderData?.sender || "";
    const senderName: string = payload.senderData?.senderName || "Cliente";
    const messageId: string = payload.idMessage || "";

    // Ignorar mensajes propios o de grupos
    if (!sender || sender.includes("@g.us") || sender === payload.instanceData?.wid) {
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje propio o grupo" });
    }

    // Ignorar mensajes viejos (más de 2 minutos, posibles webhooks retenidos por Vercel)
    const msgTimestamp: number = payload.messageData?.timestamp || payload.timestamp || 0;
    if (msgTimestamp) {
      const msgAge = Date.now() / 1000 - msgTimestamp;
      if (msgAge > 120) {
        console.log(`[WEBHOOK] ⏭️ Ignorado por antiguo (${Math.round(msgAge)}s de edad)`);
        return NextResponse.json({ success: true, ignored: true, reason: "Mensaje retenido/viejo" });
      }
    }

    // Extraer texto del mensaje
    const typeMessage = payload.messageData?.typeMessage;
    let messageText = "";
    let isNonTextMessage = false;

    if (typeMessage === "textMessage") {
      messageText = payload.messageData?.textMessageData?.textMessage || "";
    } else if (typeMessage === "extendedTextMessage") {
      messageText = payload.messageData?.extendedTextMessageData?.text || "";
    } else {
      isNonTextMessage = true;
    }

    if (!messageText && !isNonTextMessage) {
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje vacío" });
    }

    console.log(`[WEBHOOK] Mensaje de ${senderName} (${sender}): "${messageText.substring(0, 80)}"`);

    // =====================================================
    // ANTI-DUPLICADOS: Idempotency Key por messageId
    // Si este messageId ya fue procesado, ignorar inmediatamente.
    // Protege contra retries de Vercel y envíos dobles de Green API.
    // =====================================================
    if (messageId) {
      // Intentar insertar — si ya existe lanzará un error de duplicate key
      const { error: dedupError } = await supabase
        .from("whatsapp_processed_messages")
        .insert({ message_id: messageId });

      if (dedupError) {
        // El código 23505 es "unique_violation" en Postgres
        if (dedupError.code === "23505") {
          console.log(`[WEBHOOK] ⏭️ DUPLICADO ignorado. messageId ya procesado: ${messageId}`);
          return NextResponse.json({ success: true, ignored: true, reason: "Mensaje duplicado" });
        }
        // Otro error de BD — continuar igual (la idempotencia es best-effort)
        console.warn("[WEBHOOK] Advertencia en dedup:", dedupError.message);
      }
    }

    // =====================================================
    // CARGAR CONFIGURACIÓN DEL AGENTE EN CLERK
    // =====================================================
    console.log("[WEBHOOK] Buscando usuario en Clerk:", uid);
    const client = await clerkClient();
    const user = await client.users.getUser(uid);

    if (!user) throw new Error("Usuario no encontrado en Clerk");

    const settings = user.publicMetadata?.whatsappSettings as any;

    if (!settings || !settings.isActive) {
      return NextResponse.json({ success: true, ignored: true, reason: "Agente IA desactivado" });
    }

    const { providerConfig, aiPersona, knowledgeBase } = settings;
    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      return NextResponse.json({ success: true, ignored: true, reason: "API telefonía no configurada" });
    }

    const waBaseUrl = providerConfig.apiUrl.replace(/\/$/, "");

    // Helper: enviar mensaje de WhatsApp (con 2 intentos)
    const sendWAMessage = async (message: string): Promise<boolean> => {
      const endpoint = `${waBaseUrl}/waInstance${providerConfig.idInstance}/sendMessage/${providerConfig.apiTokenInstance}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId: sender, message }),
            signal: AbortSignal.timeout(12000),
          });
          if (res.ok) return true;
          console.warn(`[WEBHOOK] Green-API intento ${attempt + 1} falló: ${res.status}`);
        } catch (e: any) {
          console.warn(`[WEBHOOK] Green-API intento ${attempt + 1} excepción: ${e.message}`);
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 2500));
      }
      return false;
    };

    // =====================================================
    // COMANDOS ESPECIALES #pause / #bot
    // El AGENTE los envía desde su propio teléfono al cliente.
    // Como los webhooks "outgoing from phone" pueden no estar activos,
    // la alternativa es que el agente envíe el comando en un chat con
    // su propio número (self-chat), o bien lo reconocemos si viene
    // del wid de la instancia.
    // NUEVO: También detectamos si el mensaje entrante proviene del
    // número del propio agente (el wid de la instancia de Green API).
    // Green API a veces enruta esos mensajes como "incomingMessageReceived"
    // cuando el agente escribe desde otro teléfono conectado a la misma cuenta.
    // =====================================================
    const instanceWid: string = payload.instanceData?.wid || "";
    const isFromAgent = sender === instanceWid || sender.replace("@c.us", "") === instanceWid.replace("@c.us", "");
    const lowerMsg = messageText.trim().toLowerCase();

    if (isFromAgent) {
      // Comandos del propio agente
      if (lowerMsg === "#bot") {
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid);
        console.log(`[WEBHOOK] 🤖 Bot REACTIVADO globalmente por el agente`);
        return NextResponse.json({ success: true, action: "bot_reactivated_global" });
      }
      if (lowerMsg.startsWith("#pause") || lowerMsg === "#pausa") {
        // #pause o #pause 60 (minutos opcionales)
        const parts = lowerMsg.split(" ");
        const customMin = parts[1] ? parseInt(parts[1]) : PAUSE_MINUTES;
        const minutes = isNaN(customMin) ? PAUSE_MINUTES : customMin;
        const pauseUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        // Pausa global: borra todas las pausas de este agente e inserta una para ""
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", "GLOBAL");
        await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: "GLOBAL", paused_until: pauseUntil });
        console.log(`[WEBHOOK] 🛑 Bot PAUSADO globalmente por ${minutes} minutos.`);
        return NextResponse.json({ success: true, action: "bot_paused_global" });
      }
      // Mensaje normal del agente (no es comando) → ignorar para no auto-responderse
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje del propio agente" });
    }

    // =====================================================
    // VERIFICAR PAUSA GLOBAL O POR NÚMERO
    // =====================================================
    // Pausa global
    const { data: globalPause } = await supabase
      .from("whatsapp_pauses")
      .select("paused_until")
      .eq("owner_id", uid)
      .eq("phone_number", "GLOBAL")
      .maybeSingle();

    if (globalPause?.paused_until && new Date(globalPause.paused_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(globalPause.paused_until).getTime() - Date.now()) / 60000);
      console.log(`[WEBHOOK] 🛑 Bot pausado GLOBALMENTE — quedan ${minutesLeft} min.`);
      return NextResponse.json({ success: true, ignored: true, reason: `Bot pausado globalmente. Reanuda en ${minutesLeft} min.` });
    }

    // Pausa por número específico
    const { data: pauseData } = await supabase
      .from("whatsapp_pauses")
      .select("paused_until")
      .eq("owner_id", uid)
      .eq("phone_number", sender)
      .maybeSingle();

    if (pauseData?.paused_until && new Date(pauseData.paused_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(pauseData.paused_until).getTime() - Date.now()) / 60000);
      console.log(`[WEBHOOK] 🛑 Bot pausado para ${sender} — quedan ${minutesLeft} min.`);
      return NextResponse.json({ success: true, ignored: true, reason: `Bot pausado para este número. Reanuda en ${minutesLeft} min.` });
    }

    // =====================================================
    // MENSAJES NO-TEXTO (imágenes, audio, etc.)
    // =====================================================
    if (isNonTextMessage) {
      await sendWAMessage("🤖 Solo puedo responder *mensajes de texto*. Si necesitas ayuda, escríbeme tu consulta.");
      return NextResponse.json({ success: true, action: "non_text_reply_sent" });
    }

    // =====================================================
    // GUARDAR MENSAJE DEL CLIENTE EN HISTORIAL
    // =====================================================
    await supabase.from("whatsapp_chats").insert({
      owner_id: uid,
      phone_number: sender,
      role: "user",
      content: messageText,
    });

    // =====================================================
    // DETECCIÓN DE RECARGAS + CRUCE CON ESTAFADORES
    // =====================================================
    const rechargeKeywords = ["recarga", "recargar", "deposito", "depositar", "cargar", "carga"];
    const isRechargeRequest = rechargeKeywords.some((kw) => messageText.toLowerCase().includes(kw));
    const amountMatch = messageText.match(/\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:usd|USD|dolar|dólares|dolares)?/);
    const detectedAmount = amountMatch ? parseFloat(amountMatch[1]) : null;

    if (isRechargeRequest) {
      const cleanPhone = sender.replace("@c.us", "");
      const { data: scammerData } = await supabase
        .from("scammers")
        .select("id")
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.0${cleanPhone.slice(-10)},phone_number.eq.593${cleanPhone.slice(-10)}`)
        .limit(1);

      const isScammer = scammerData && scammerData.length > 0;

      if (isScammer) {
        console.log(`[WEBHOOK] 🚨 ESTAFADOR DETECTADO: ${sender}`);
        await supabase.from("whatsapp_recargas").insert({ owner_id: uid, phone_number: sender, client_name: senderName, amount: detectedAmount, status: "rejected", is_scammer: true });
        await sendWAMessage("Lo sentimos, no podemos procesar su solicitud en este momento. Para más información, comuníquese directamente con soporte.");
        return NextResponse.json({ success: true, action: "scammer_rejected" });
      }

      await supabase.from("whatsapp_recargas").insert({ owner_id: uid, phone_number: sender, client_name: senderName, amount: detectedAmount, status: "pending", is_scammer: false });
      console.log(`[WEBHOOK] 💰 Recarga pendiente: ${senderName} - $${detectedAmount || "?"}`);
    }

    // =====================================================
    // INDICADOR DE ESCRITURA (UX)
    // =====================================================
    try {
      await fetch(`${waBaseUrl}/waInstance${providerConfig.idInstance}/sendAction/${providerConfig.apiTokenInstance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: sender, action: "typing" }),
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* No crítico */ }

    // =====================================================
    // GENERAR RESPUESTA CON GEMINI IA
    // =====================================================
    if (!geminiKey) {
      await sendWAMessage("🤖 El asistente tiene un problema de configuración. Contacta a soporte.");
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { 
        maxOutputTokens: 350,  // Forzar respuestas cortas
        temperature: 0.4,       // Más predecible y menos "creativo" en excesos
      },
    });

    const systemPrompt = `Eres un asistente de WhatsApp. Sigues estas reglas de manera ESTRICTA e INNEGOCIABLE:

REGLAS DE COMPORTAMIENTO:
1. Responde ÚNICAMENTE al ÚLTIMO mensaje del cliente. Ignora el contexto anterior si no es directamente relevante.
2. Máximo 3 oraciones cortas por respuesta. NUNCA escribas párrafos largos.
3. NUNCA repitas información que ya dijiste en mensajes anteriores. El cliente ya la leyó.
4. Si el cliente saluda ("hola", "que tal", "buenos días", etc.), responde solo con un saludo amigable y pregunta en qué puedes ayudar. NO des información de procesos sin que te lo pidan.
5. Si el cliente pregunta algo, responde puntualmente esa pregunta. Solo eso.
6. NO uses listas largas ni bullets a menos que sea ESTRICTAMENTE necesario y máximo 3 puntos.
7. Si no sabes algo o está fuera de tu conocimiento, di "No tengo esa información, te conectaré con un agente humano." y para.

TU IDENTIDAD Y COMPORTAMIENTO:
${aiPersona}

BASE DE CONOCIMIENTO (usa SOLO esto. Si te preguntan algo fuera de aquí, deriva a soporte):
${knowledgeBase}

Cliente: ${senderName}.
Formato WhatsApp (*negrita*). Respuesta CORTA. Solo responde al ÚLTIMO mensaje.`;


    // Recuperar historial reciente (últimos 6 mensajes = 3 intercambios)
    const { data: pastMessages } = await supabase
      .from("whatsapp_chats")
      .select("role, content")
      .eq("owner_id", uid)
      .eq("phone_number", sender)
      .order("created_at", { ascending: false })
      .limit(6);

    const chronologicalHistory = (pastMessages || []).reverse();

    const chatHistory: any[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Responderé según las instrucciones anteriores." }] },
    ];

    for (const msg of chronologicalHistory) {
      if (msg.role === "agent") continue; // Omitir mensajes del agente humano
      chatHistory.push({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    // Gemini con retry (2 intentos)
    let aiResponse = "";
    const FALLBACK_MSG = "🤖 En este momento tengo dificultades técnicas. Por favor escríbeme nuevamente en un momento, ¡gracias por tu paciencia!";

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(messageText);
        const finishReason = result.response?.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY" || finishReason === "OTHER") {
          aiResponse = "Lo siento, no puedo responder esa consulta. Por favor contáctate directamente con soporte.";
          break;
        }
        const candidate = result.response.text()?.trim();
        if (candidate) { aiResponse = candidate; break; }
        console.warn(`[WEBHOOK] Gemini intento ${attempt + 1}: respuesta vacía`);
      } catch (gemErr: any) {
        console.error(`[WEBHOOK] Gemini ERROR intento ${attempt + 1}:`, gemErr.message);
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
    }

    if (!aiResponse) aiResponse = FALLBACK_MSG;

    console.log("[WEBHOOK] Respuesta IA:", aiResponse.substring(0, 150));

    // Guardar respuesta del modelo en BD
    await supabase.from("whatsapp_chats").insert({
      owner_id: uid,
      phone_number: sender,
      role: "model",
      content: aiResponse,
    });

    // Enviar respuesta vía Green-API
    const sent = await sendWAMessage(aiResponse);
    if (!sent) {
      console.error("[WEBHOOK] ❌ Green-API falló. Respuesta NO enviada.");
      return NextResponse.json({ success: false, error: "Green-API no disponible" }, { status: 503 });
    }

    console.log("[WEBHOOK] ✅ Respondido exitosamente");
    return NextResponse.json({ success: true, message: "Mensaje respondido con IA." });

  } catch (error: any) {
    console.error("[WEBHOOK] ❌ ERROR GENERAL:", error.message || String(error));
    return NextResponse.json({ error: "Error procesando webhook", details: error.message }, { status: 500 });
  }
}

// GET para verificar que el endpoint está vivo
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiKeyPresent: !!process.env.GEMINI_API_KEY,
    clerkKeyPresent: !!process.env.CLERK_SECRET_KEY,
  });
}
