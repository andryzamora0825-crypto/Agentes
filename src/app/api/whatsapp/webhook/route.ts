import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45; // Previene caída prematura en Vercel si el plan lo permite

const PAUSE_HUMAN_MINUTES = 10;    // Auto-pausa por intervención del agente humano
const ESCALATION_PAUSE_MIN = 30;   // Pausa cuando el bot escala a humano

// =====================================================
// HELPER: ENVIAR MENSAJE DE TEXTO SIMPLE VÍA GREEN-API
// =====================================================
function makeWASender(waBaseUrl: string, idInstance: string, apiToken: string, chatId: string) {
  const send = async (message: string): Promise<boolean> => {
    try {
      const res = await fetch(`${waBaseUrl}/waInstance${idInstance}/sendMessage/${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch (e: any) {
      console.warn(`[WEBHOOK] sendMessage falló: ${e.message}`);
      return false;
    }
  };
  return { send };
}

// =====================================================
// HERRAMIENTAS OPENAI (FUNCTION CALLING)
// =====================================================
const BOT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "registrar_recarga",
      description: "Registra una solicitud de recarga del cliente en el sistema. Llama a esta herramienta SOLO cuando el cliente haya confirmado el monto Y el banco. No inventes datos.",
      parameters: {
        type: "object",
        properties: {
          monto: { type: "number", description: "Monto en USD que el cliente quiere recargar" },
          banco: { type: "string", description: "Nombre del banco que el cliente eligió" },
        },
        required: ["monto", "banco"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "etiquetar_contacto",
      description: "Etiqueta al contacto para organización interna. Úsala cuando quede claro el estado del cliente.",
      parameters: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Etiqueta: 'lead', 'vip', 'recarga_pendiente', 'retiro_pendiente', 'escalado'" },
        },
        required: ["tag"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalar_a_humano",
      description: "Transfiere la conversación a un agente humano cuando el bot no puede resolver el problema, o cuando el cliente pide hablar con una persona.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Razón breve de la escalación para el registro interno" },
        },
        required: ["motivo"],
      },
    },
  },
];

// =====================================================
// EJECUTOR DE HERRAMIENTAS
// =====================================================
async function executeTool(
  name: string,
  args: Record<string, any>,
  ctx: { uid: string; sender: string; senderName: string; adminEmail: string; waBaseUrl: string; idInstance: string; apiToken: string; }
): Promise<string> {

  if (name === "registrar_recarga") {
    const { monto, banco } = args;
    await supabase.from("whatsapp_recargas").insert({
      owner_id: ctx.uid,
      phone_number: ctx.sender,
      client_name: ctx.senderName,
      amount: monto,
      bank: banco,
      status: "pending",
      is_scammer: false,
    });
    await supabase.from("whatsapp_contact_tags")
      .upsert({ owner_id: ctx.uid, phone_number: ctx.sender, tag: "recarga_pendiente" }, { onConflict: "owner_id,phone_number,tag" });
    console.log(`[TOOL] ✅ Recarga registrada: $${monto} - ${banco}`);
    return `Recarga de $${monto} en ${banco} registrada exitosamente. El cliente debe enviar el comprobante.`;
  }

  if (name === "etiquetar_contacto") {
    const { tag } = args;
    await supabase.from("whatsapp_contact_tags")
      .upsert({ owner_id: ctx.uid, phone_number: ctx.sender, tag }, { onConflict: "owner_id,phone_number,tag" });
    console.log(`[TOOL] 🏷️ Contacto etiquetado: ${tag}`);
    return `Contacto etiquetado como '${tag}'.`;
  }

  if (name === "escalar_a_humano") {
    const { motivo } = args;
    // Pausar el bot para este número por ESCALATION_PAUSE_MIN minutos
    const pauseUntil = new Date(Date.now() + ESCALATION_PAUSE_MIN * 60 * 1000).toISOString();
    await supabase.from("whatsapp_pauses").delete().eq("owner_id", ctx.uid).eq("phone_number", ctx.sender);
    await supabase.from("whatsapp_pauses").insert({ owner_id: ctx.uid, phone_number: ctx.sender, paused_until: pauseUntil });

    // Etiqueta como escalado
    await supabase.from("whatsapp_contact_tags")
      .upsert({ owner_id: ctx.uid, phone_number: ctx.sender, tag: "escalado" }, { onConflict: "owner_id,phone_number,tag" });

    // Notificar al admin via tabla chats (mensaje interno)
    if (ctx.adminEmail) {
      await supabase.from("chats").insert({
        sender_email: "bot@zamtools.com",
        sender_name: "🤖 Bot WhatsApp",
        receiver_email: ctx.adminEmail,
        content: `⚠️ *Escalación requerida*\n📱 Cliente: ${ctx.senderName} (${ctx.sender.replace("@c.us", "")})\n📋 Motivo: ${motivo}\n⏸ Bot pausado por ${ESCALATION_PAUSE_MIN} min.`,
        is_read: false,
      });
    }
    console.log(`[TOOL] 🚨 Escalado a humano. Motivo: ${motivo}`);
    return `¡ACCIÓN COMPLETADA! El chat ha sido pausado de tu parte. AHORA RESPONDE AL CLIENTE con naturalidad que un compañero lo atenderá y DESPÍDETE. NUNCA menciones que lo has 'escalado' o has 'pausado' tus sistemas.`;
  }

  return "Herramienta no reconocida.";
}

// =====================================================
// WEBHOOK PRINCIPAL (LATENCIA ULTRA-BAJA)
// =====================================================
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const payload = await request.json();
    const webhookType = payload.typeWebhook;
    const chatId: string = payload.senderData?.chatId || payload.chatId || "";

    // ── BLOQUEO DEFINITIVO DE GRUPOS Y BOTS ──
    if (webhookType === "outgoingAPIMessageReceived" || chatId.includes("@g.us")) {
      return NextResponse.json({ success: true, ignored: true });
    }

    // ── INTERCEPCIÓN DE COMANDOS MANUALES Y AUTOPAUSA (HUMANO INTERVIENE) ──
    if (webhookType === "outgoingMessage" || webhookType === "outgoingMessageReceived") {
      if (!chatId) return NextResponse.json({ success: true, ignored: true });

      const outText = (payload.messageData?.textMessageData?.textMessage || payload.messageData?.extendedTextMessageData?.text || "").toLowerCase().trim();

      if (outText === "#contact") {
        const pauseUntil = new Date(Date.now() + 52560000 * 60 * 1000).toISOString();
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
        await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: chatId, paused_until: pauseUntil });
        return NextResponse.json({ success: true, action: "paused_permanent" });
      }

      if (outText === "#pause") {
        const pauseUntil = new Date(Date.now() + PAUSE_HUMAN_MINUTES * 60 * 1000).toISOString();
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
        await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: chatId, paused_until: pauseUntil });
        return NextResponse.json({ success: true, action: "paused_temp" });
      }

      if (outText === "#resume") {
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
        return NextResponse.json({ success: true, action: "resumed" });
      }

      // Evitar sobreescribir pausa permanente si el humano escribe
      const { data: existingPause } = await supabase.from("whatsapp_pauses")
        .select("paused_until").eq("owner_id", uid).eq("phone_number", chatId).limit(1).single();

      if (existingPause && (new Date(existingPause.paused_until).getTime() - Date.now() > 24 * 60 * 60 * 1000)) {
        return NextResponse.json({ success: true, action: "long_pause_preserved" });
      }

      // Autopausa corta genérica
      const autoPause = new Date(Date.now() + PAUSE_HUMAN_MINUTES * 60 * 1000).toISOString();
      await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
      await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: chatId, paused_until: autoPause });
      return NextResponse.json({ success: true, action: "auto_paused" });
    }

    if (webhookType !== "incomingMessageReceived") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const sender: string = payload.senderData?.sender || "";
    const instanceWid: string = payload.instanceData?.wid || "";
    if (!sender || sender === instanceWid) return NextResponse.json({ success: true });

    // ── EXTRACCIÓN SÓLIDA DEL TEXTO O MULTIMEDIA ──
    const typeMessage: string = payload.messageData?.typeMessage || "";
    let messageText = "";

    if (typeMessage === "textMessage") messageText = payload.messageData?.textMessageData?.textMessage || "";
    else if (typeMessage === "extendedTextMessage") messageText = payload.messageData?.extendedTextMessageData?.text || "";
    else if (typeMessage === "buttonsResponseMessage") messageText = payload.messageData?.buttonsResponseMessage?.selectedDisplayText || "";
    else if (typeMessage === "contactMessage" || typeMessage === "contactsArrayMessage") {
      const vcard = payload.messageData?.contactMessageData?.vcard || payload.messageData?.contactMessage?.vcard || "";
      const displayName = payload.messageData?.contactMessageData?.displayName || payload.messageData?.contactMessage?.displayName || "Contacto";
      const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
      const phone = phoneMatch ? phoneMatch[1].replace(/[\s-]/g, "") : "";
      messageText = phone ? `[CONTACTO_REENVIADO] Nombre: ${displayName}, Teléfono: ${phone}` : `[CONTACTO_REENVIADO] Nombre: ${displayName}`;
    } 
    else if (['imageMessage', 'documentMessage'].includes(typeMessage)) messageText = "[COMPROBANTE_ENVIADO]";
    else if (typeMessage === 'audioMessage') messageText = "[NOTA_DE_VOZ_RECIBIDA]";
    else messageText = `[ARCHIVO_${typeMessage}_RECIBIDO]`;

    if (!messageText.trim()) return NextResponse.json({ success: true });

    // ── DEDUPLICACIÓN DE INMEDIATO ──
    const messageId = payload.idMessage || "";
    if (messageId) {
      const { error: dedupErr } = await supabase.from("whatsapp_processed_messages").insert({ message_id: messageId });
      if (dedupErr?.code === "23505") return NextResponse.json({ success: true, ignored: true, reason: "Duplicado" });
    }

    // ── VERIFICAR PAUSAS ESTRICTAS DE RESPUESTA ──
    const { data: pauses } = await supabase.from("whatsapp_pauses").select("paused_until")
      .eq("owner_id", uid).in("phone_number", ["GLOBAL", sender]);
    if (pauses?.some(p => new Date(p.paused_until) > new Date())) {
      return NextResponse.json({ success: true, ignored: true, reason: "Pausado" });
    }

    const senderName = payload.senderData?.senderName || "Cliente";

    // CARGAR CONFIG Y EARLY TYPING
    const clerkClient_ = await clerkClient();
    const user = await clerkClient_.users.getUser(uid);
    if (!user) throw new Error("Usuario no encontrado");

    const settings = user.publicMetadata?.whatsappSettings as any;
    if (!settings?.isActive) return NextResponse.json({ success: true, ignored: true, reason: "Bot desactivado" });

    const { providerConfig, aiPersona, knowledgeBase, banksInfo, rechargeSteps, withdrawSteps, greetingMenu } = settings;
    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      return NextResponse.json({ success: true, ignored: true, reason: "No API" });
    }

    const waBaseUrl = providerConfig.apiUrl.replace(/\/$/, "");
    const { send } = makeWASender(waBaseUrl, providerConfig.idInstance, providerConfig.apiTokenInstance, sender);
    const adminEmail = (user.emailAddresses?.[0]?.emailAddress || "") as string;

    // SCAMMER CHECK INSTANTÁNEO (Básico: si el mensaje parece pedir recarga o ya está catalogado)
    const cleanPhone = sender.replace("@c.us", "");
    const { data: scammerData } = await supabase.from("scammers").select("id")
      .or(`phone_number.eq.${cleanPhone},phone_number.eq.0${cleanPhone.slice(-10)},phone_number.eq.593${cleanPhone.slice(-10)}`).limit(1);
    
    if (scammerData && scammerData.length > 0) {
      await send("Lo sentimos, por motivos de seguridad no podemos procesar su solicitud. Comuníquese directamente con un asesor humano.");
      return NextResponse.json({ success: true, action: "scammer" });
    }

    // INDICADOR TYPING (No bloquea)
    fetch(`${waBaseUrl}/waInstance${providerConfig.idInstance}/sendAction/${providerConfig.apiTokenInstance}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: sender, action: "typing" }), signal: AbortSignal.timeout(3000),
    }).catch(() => {});

    // INSERCIÓN DIRECTA SIN BUFFER
    await supabase.from("whatsapp_chats").insert({ owner_id: uid, phone_number: sender, role: "user", content: messageText });

    // ── HISTORIAL DE CONVERSACIÓN RAPIDO ──
    const { data: rawHistory } = await supabase.from("whatsapp_chats")
      .select("role, content").eq("owner_id", uid).eq("phone_number", sender)
      .order("created_at", { ascending: true }).limit(30);

    const history = rawHistory || [];

    // ── CONTRATO ABSOLUTO DEL SYSTEM PROMPT ──
    const systemPrompt = `Eres un asesor de Whatsapp hiper-realista, fluido y carismático, NO ERES UN ROBOT NI DEBES ACTUAR COMO TAL.
REGLAS VITALES:
1. RESPONDE NATURAL. Cero menús numerados (ej: 1. Hacer esto, 2. Hacer aquello). Todo es charla fluida.
2. NO PIDAS DATOS QUE YA TE DIERON. Lee el historial y avanza directamente.
3. SI EL MENSAJE ES UN SALUDO CORTO("Hola"), responde en una o dos líneas amigables y ofrece tu ayuda. Guiate por este norte: "${greetingMenu || '¿En qué te puedo ayudar hoy?'}". NUNCA ENLISTES SERVICIOS DIRECTAMENTE si solo te han dicho "hola".
4. ESCALA RAPIDO SI HAY ENOJO, GROSERIAS O REQUERIMIENTOS ESPECIALES. Usa 'escalar_a_humano' y diles: "Dame un par de minutos, le paso tu caso a un compañero/a para que te dé una mano de inmediato." PROHIBIDO utilizar lenguajes técnicos.
5. CERO AUDIOS. Si ves "[NOTA_DE_VOZ_RECIBIDA]", diles rápido: "Disculpa, no puedo oír audios ahorita, me lo escribes por favor? 🙏"
6. NO DIGAS QUE ERES IA. Eres humano a los ojos del cliente.

===== FLUJO RECARGA (DEPÓSITOS) =====
* PROTOCOLO: "${rechargeSteps || "Averigua qué monto depositará y qué banco usará."}"
* BANCOS: ${banksInfo || "Debes apoyarte de un humano, usa tu herramienta de escalar."}
* ALERTA DE SISTEMA: Apenas determines con exactitud un MONTO numérico y la elección de BANCO del cliente, EJECUTA DE INMEDIATO LA ACCIÓN 'registrar_recarga'. Dile en tu mensaje final que envíe comprobante cuando pague.
* SI ENVIAN FOTO (Gritan "[COMPROBANTE_ENVIADO]"): Tú solo confirma maravillosamente que ya lo recibiste y va en cola, y ejecuta EN SEGUNDO PLANO la acción 'etiquetar_contacto' como recarga_pendiente.

===== FLUJO RETIROS =====
* PROTOCOLO: "${withdrawSteps || "Pídele monto y número de cuenta."}"
* ALERTA: Retiros piden trabajo manual. Reunidos sus datos de cuenta, llama obligatoriamente a 'escalar_a_humano' para dárselo a tu colega.

PERSONALIDAD DEL AGENTE: ${aiPersona || "Excelente trato financiero, amable, profesional, seguro de sí."}
KNOWLEDGE BASE: ${knowledgeBase || ""}
NOMBRE DE TU CLIENTE: ${senderName}`;

    // ── LLAMADA DIRECTA A OPENAI ──
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: "No API Key" }, { status: 500 });
    const openai = new OpenAI({ apiKey: openaiKey });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }];
    
    // Inyectar el historial (excluyendo el último porque el LLM lo verá como el "prompt")
    // O mejor aún, pasamos TODO el historial si ya se incluyó `messageText` como la última fila en DB.
    for (const msg of history) {
      messages.push({ role: msg.role === "model" ? "assistant" : "user", content: msg.content });
    }

    let aiResponse = "";
    try {
      let completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: BOT_TOOLS,
        tool_choice: "auto",
        max_tokens: 300,
        temperature: 0.35,
      });

      // Lógica nativa de Tool execution (max 3 rondas)
      for (let round = 0; round < 3; round++) {
        const choice = completion.choices[0];
        if (choice.finish_reason === "tool_calls" || choice.message.tool_calls?.length) {
          messages.push(choice.message);
          
          for (const toolCall of choice.message.tool_calls || []) {
            if (toolCall.type !== 'function') continue;
            let args = {}; try { args = JSON.parse(toolCall.function.arguments); } catch {}
            
            console.log(`[WEBHOOK] 🔧 Ejecutando Tool: ${toolCall.function.name}`, args);
            const toolResult = await executeTool(toolCall.function.name, args, {
              uid, sender, senderName, adminEmail, waBaseUrl,
              idInstance: providerConfig.idInstance, apiToken: providerConfig.apiTokenInstance,
            });
            messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
          }

          completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages, tools: BOT_TOOLS, tool_choice: "auto", max_tokens: 300, temperature: 0.35,
          });
        } else {
          break; // Fin del proceso LLM
        }
      }

      if (completion.choices[0]?.finish_reason === "content_filter") {
        aiResponse = "Disculpe, por ahora no puedo ayudarle con eso. ¿Gusta que le comunique con un asesor?";
      } else {
        aiResponse = completion.choices[0]?.message?.content?.trim() || "";
      }
    } catch (e: any) {
      console.error("[WEBHOOK/OPENAI] Error:", e.message);
      aiResponse = "¡Hola! ¿Dime cómo te podemos ayudar hoy? (Disculpa, he tenido una fallita técnica breve)";
    }

    if (!aiResponse) aiResponse = "¿En qué te puedo ayudar?"; // Safe fallback

    // ── DESPACHO CERO LATENCIA ──
    await send(aiResponse);

    // Guardar lo que la IA respondió en la DB
    await supabase.from("whatsapp_chats").insert({ owner_id: uid, phone_number: sender, role: "model", content: aiResponse });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[WEBHOOK/CRASH]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", version: "v5_pure_ai" });
}
