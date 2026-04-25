import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import OpenAI, { toFile } from "openai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45; // Previene caída prematura en Vercel si el plan lo permite

const PAUSE_HUMAN_MINUTES = 10;    // Auto-pausa por intervención del agente humano
const ESCALATION_PAUSE_MIN = 10;   // Pausa cuando el bot escala a humano (antes estaba en 30)
const MAX_REPLIES_PER_MINUTE = 5;  // Rate limit anti-loop por número

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
        signal: AbortSignal.timeout(15000),
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
      description: "Registra una solicitud de recarga del cliente en el sistema. Llama a esta herramienta SOLO cuando el cliente haya confirmado el monto Y el banco. IMPORTANTE: Antes o al mismo tiempo de usar esta herramienta, DEBES darle al cliente los datos exactos de la cuenta bancaria del banco elegido para que pueda hacer la transferencia. NUNCA pidas comprobante sin darle primero la cuenta.",
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
  {
    type: "function",
    function: {
      name: "recolectar_datos_contacto",
      description: "Ejecutar discretamente para almacenar a un prospecto en la base central si se obtiene su nombre y su ubicación (ciudad/país) durante la conversación. Hazlo sutil.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre extraído del cliente" },
          ubicacion: { type: "string", description: "Ciudad o País extraído del cliente" },
        },
        required: ["nombre", "ubicacion"],
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

    // ── DEDUPLICACIÓN: Si ya hay una recarga pendiente de este número, actualizar en vez de duplicar ──
    const { data: existing } = await supabase.from("whatsapp_recargas")
      .select("id")
      .eq("owner_id", ctx.uid)
      .eq("phone_number", ctx.sender)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from("whatsapp_recargas")
        .update({ amount: monto, bank: banco, client_name: ctx.senderName })
        .eq("id", existing.id);
      console.log(`[TOOL] ♻️ Recarga actualizada (dedup): $${monto} - ${banco}`);
    } else {
      await supabase.from("whatsapp_recargas").insert({
        owner_id: ctx.uid,
        phone_number: ctx.sender,
        client_name: ctx.senderName,
        amount: monto,
        bank: banco,
        status: "pending",
        is_scammer: false,
      });
      console.log(`[TOOL] ✅ Recarga registrada: $${monto} - ${banco}`);
    }

    await supabase.from("whatsapp_contact_tags")
      .upsert([
        { owner_id: ctx.uid, phone_number: ctx.sender, tag: "recarga_pendiente" },
        { owner_id: ctx.uid, phone_number: ctx.sender, tag: "cuentas_entregadas" }
      ], { onConflict: "owner_id,phone_number,tag" });
    return `¡ACCIÓN COMPLETADA! Recarga registrada. AHORA DEBES RESPONDER AL CLIENTE: Entrégale de forma amable los datos exactos de la cuenta bancaria del banco '${banco}' (búscalos en tu lista de BANCOS DISPONIBLES). Además de darle la cuenta, ES ABSOLUTAMENTE OBLIGATORIO que termines el mensaje diciéndole textualmente: "Me ayuda con el comprobante de la transferencia y el ID de su cuenta Ecuabet. Recuerde que el titular de la cuenta bancaria debe ser el mismo de la cuenta Ecuabet". NO PUEDES despedirte sin añadir esa frase exacta y los datos bancarios completos.`;
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

  if (name === "recolectar_datos_contacto") {
    const { nombre, ubicacion } = args;
    await supabase.from("whatsapp_contact_tags")
      .upsert({ owner_id: ctx.uid, phone_number: ctx.sender, tag: `LEAD|${nombre}|${ubicacion}` }, { onConflict: "owner_id,phone_number,tag" });
    console.log(`[TOOL] 🎣 Lead Capturado VIP: ${nombre} (${ubicacion})`);
    return `¡Datos Registrados! Actúa natural, la persona ya está en nuestra base VIP de remarketing.`;
  }

  return "Herramienta no reconocida.";
}

// =====================================================
// VERIFICACIÓN DE COMPROBANTES CON OPENAI VISION (GPT-4o-mini)
// =====================================================
// Migrado desde Gemini Vision para reducir costos y mejorar consistencia.
// GPT-4o-mini vision: $0.15/M input + $0.60/M output. Equivalente a Gemini en
// docs/tickets pero más estable y unificado con el resto del flujo (mismo SDK).
async function checkReceiptWithVision(params: {
  downloadUrl: string;
  ownerId: string;
  phoneNumber: string;
  chatMsgId: string;
  openaiKey: string;
}): Promise<{
  isValid: boolean;
  bank?: string;
  amount?: number;
  date?: string;
  reference?: string;
  titular?: string;
  raw: string;
}> {
  if (!params.openaiKey) {
    return { isValid: false, raw: "no_openai_key" };
  }

  try {
    const imgRes = await fetch(params.downloadUrl, { signal: AbortSignal.timeout(10_000) });
    if (!imgRes.ok) return { isValid: false, raw: `fetch_image_failed_${imgRes.status}` };
    const imgBuf = await imgRes.arrayBuffer();
    if (imgBuf.byteLength > 5 * 1024 * 1024) {
      return { isValid: false, raw: "image_too_large" };
    }
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    const base64 = Buffer.from(imgBuf).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const openai = new OpenAI({ apiKey: params.openaiKey });

    const prompt = `Eres un verificador de comprobantes de transferencia bancaria ecuatorianos.
Analiza la imagen y responde EXCLUSIVAMENTE con JSON válido (sin texto extra):
{
  "is_valid_receipt": true/false,
  "bank": "nombre del banco origen (o null)",
  "amount": número con 2 decimales (o null),
  "date": "DD/MM/YYYY o DD/MM (o null)",
  "reference": "número de referencia/transacción (o null)",
  "titular": "nombre del titular que transfirió (o null)"
}
Criterios para is_valid_receipt=true: debe mostrar claramente un movimiento bancario (transferencia, depósito o pago) con monto, fecha y algún identificador. Capturas de conversaciones, memes, selfies o documentos genéricos → false.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content || "";

    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { isValid: false, raw: text.slice(0, 300) };
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch { return { isValid: false, raw: text.slice(0, 300) }; }
    }

    supabase.from("whatsapp_receipt_checks").insert({
      owner_id: params.ownerId,
      phone_number: params.phoneNumber,
      chat_msg_id: params.chatMsgId,
      is_valid_receipt: !!parsed.is_valid_receipt,
      detected_bank: parsed.bank || null,
      detected_amount: typeof parsed.amount === "number" ? parsed.amount : null,
      detected_date: parsed.date || null,
      detected_reference: parsed.reference || null,
      detected_titular: parsed.titular || null,
      raw_response: text.slice(0, 500),
    }).then(() => {});

    return {
      isValid: !!parsed.is_valid_receipt,
      bank: parsed.bank || undefined,
      amount: typeof parsed.amount === "number" ? parsed.amount : undefined,
      date: parsed.date || undefined,
      reference: parsed.reference || undefined,
      titular: parsed.titular || undefined,
      raw: text.slice(0, 300),
    };
  } catch (e: any) {
    console.warn("[VISION] Error verificando comprobante:", e.message);
    return { isValid: false, raw: `error: ${e.message}` };
  }
}

// =====================================================
// SHORTCUTS TEMPLATED (evitan llamada a LLM para casos triviales)
// =====================================================
function tryTemplatedShortcut(text: string, hasHistory: boolean, greetingMenu: string | null): string | null {
  const t = text.toLowerCase().trim();

  // Saludo puro sin contexto y sin historial → menú de bienvenida
  if (!hasHistory && /^(hola|buenas|buen d[ií]a|buenas tardes|buenas noches|hi|hello|ola)\s*[.!¡]*$/i.test(t)) {
    return greetingMenu || null;
  }

  // Preguntas de disponibilidad
  if (/^(est[aá]s? activo|est[aá]n trabajando|hay l[ií]nea|atienden|est[aá]n ah[ií])\s*[?¿.!]*$/i.test(t)) {
    return "¡Sí, 100% operativos! 🚀 ¿En qué te ayudo?";
  }

  // Gracias y despedidas
  if (/^(gracias|muchas gracias|ok gracias|mil gracias)\s*[.!]*$/i.test(t)) {
    return "¡A ti! Cualquier cosa me escribes. 👋";
  }
  if (/^(chao|adi[oó]s|bye|hasta luego|nos vemos)\s*[.!]*$/i.test(t)) {
    return "¡Hasta pronto! Éxitos con tus apuestas. 🍀";
  }

  return null;
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
        .select("paused_until").eq("owner_id", uid).eq("phone_number", chatId).limit(1).maybeSingle();

      if (existingPause && (new Date(existingPause.paused_until).getTime() - Date.now() > 24 * 60 * 60 * 1000)) {
        return NextResponse.json({ success: true, action: "long_pause_preserved" });
      }

      // Autopausa corta genérica
      const autoPause = new Date(Date.now() + PAUSE_HUMAN_MINUTES * 60 * 1000).toISOString();
      await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
      await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: chatId, paused_until: autoPause });

      // ── LIMPIAR RECARGAS PENDIENTES: el humano ya atendió a este cliente ──
      await supabase.from("whatsapp_recargas")
        .delete()
        .eq("owner_id", uid)
        .eq("phone_number", chatId)
        .eq("status", "pending");

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
    else if (['imageMessage', 'documentMessage'].includes(typeMessage)) {
      const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl
        || payload.messageData?.imageMessage?.downloadUrl
        || payload.messageData?.documentMessage?.downloadUrl;

      // ── PRE-FILTRO DE CONTEXTO: solo gastar Vision si el cliente está en flujo de recarga ──
      // Si el cliente no tiene tag de recarga pendiente y el bot no le pidió comprobante recientemente,
      // probablemente la imagen es un meme/selfie/captura random — no malgastar Vision.
      const senderForCheck = payload.senderData?.sender || "";
      const [{ data: receiptTagsData }, { data: lastBotMsgs }] = await Promise.all([
        supabase.from("whatsapp_contact_tags")
          .select("tag")
          .eq("owner_id", uid)
          .eq("phone_number", senderForCheck)
          .in("tag", ["recarga_pendiente", "cuentas_entregadas"]),
        supabase.from("whatsapp_chats")
          .select("content")
          .eq("owner_id", uid)
          .eq("phone_number", senderForCheck)
          .eq("role", "model")
          .order("created_at", { ascending: false })
          .limit(2),
      ]);

      const inRechargeFlow = (receiptTagsData?.length || 0) > 0;
      const botAskedReceipt = (lastBotMsgs || []).some(m =>
        /comprobante|transferencia|dep[oó]sito|recibo|captura del pago/i.test(m.content || "")
      );

      const shouldVerify = downloadUrl && process.env.OPENAI_API_KEY && (inRechargeFlow || botAskedReceipt);

      if (!downloadUrl) {
        messageText = "[COMPROBANTE_ENVIADO]";
      } else if (!shouldVerify) {
        // Imagen sin contexto de recarga: dejamos que el LLM la maneje sin Vision
        messageText = "[IMAGEN_RECIBIDA_SIN_CONTEXTO: El cliente envió una imagen pero no estamos en flujo de recarga. Pregúntale brevemente qué necesita o si es un comprobante.]";
      } else {
        // ── RATE LIMIT: máx 8 verificaciones Vision por número/24h ──
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: visionCount } = await supabase.from("whatsapp_receipt_checks")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", uid)
          .eq("phone_number", senderForCheck)
          .gte("created_at", dayAgo);

        if ((visionCount || 0) >= 8) {
          console.warn(`[VISION] 🛑 Rate limit alcanzado para ${senderForCheck} (${visionCount} verificaciones/24h)`);
          messageText = "[COMPROBANTE_ENVIADO]";
        } else {
          const verify = await checkReceiptWithVision({
            downloadUrl,
            ownerId: uid,
            phoneNumber: senderForCheck,
            chatMsgId: payload.idMessage || "",
            openaiKey: process.env.OPENAI_API_KEY!,
          });
          if (verify.isValid) {
            const parts: string[] = ["[COMPROBANTE_ENVIADO_VERIFICADO]"];
            if (verify.amount !== undefined) parts.push(`monto=$${verify.amount.toFixed(2)}`);
            if (verify.bank) parts.push(`banco=${verify.bank}`);
            if (verify.date) parts.push(`fecha=${verify.date}`);
            if (verify.reference) parts.push(`ref=${verify.reference}`);
            if (verify.titular) parts.push(`titular=${verify.titular}`);
            messageText = parts.join(" | ");
          } else {
            messageText = "[COMPROBANTE_INVALIDO: La imagen enviada NO parece un comprobante de transferencia real (quizás es una captura distinta). Responde amablemente y pídele que envíe el comprobante real de la transferencia bancaria.]";
          }
        }
      }
    }
    else if (typeMessage === 'audioMessage') {
      const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl;
      if (downloadUrl) {
        try {
          const audioRes = await fetch(downloadUrl);
          const audioBuffer = await audioRes.arrayBuffer();
          
          // ── OPTIMIZACIÓN: LÍMITE DE AUDIO (Whisper cobra por segundo) ──
          // WhatsApp OGG Opus pesa ~15KB por cada 10 segs. 
          // 400KB son aprox. 3-4 minutos. Bloqueamos audios gigantes.
          if (audioBuffer.byteLength > 400 * 1024) {
            console.log(`[WEBHOOK] 🛑 Audio gigante bloqueado (${(audioBuffer.byteLength / 1024).toFixed(1)} KB)`);
            messageText = "[NOTA_DE_VOZ_RECIBIDA: Audio excesivamente largo. Pídele amablemente que envíe mensajes de voz más cortos o que escriba su petición.]";
          } else {
            // Transformamos nativo para la API de Whisper
            const audioFile = await toFile(audioBuffer, "audio.ogg", { type: "audio/ogg" });
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const transcription = await openai.audio.transcriptions.create({
              file: audioFile as any, // Bypass TS as ReadStream compatibility
              model: "whisper-1",
              language: "es",
            });
            messageText = `[NOTA_DE_VOZ_RECIBIDA: "${transcription.text}"]`;
            console.log(`[WEBHOOK] 🎤 Audio Transcrito con éxito: ${transcription.text}`);
          }
        } catch (e: any) {
          console.error("[WEBHOOK/WHISPER] Falla procesando audio:", e.message);
          messageText = "[NOTA_DE_VOZ_RECIBIDA: Audio ininteligible, pídele que lo escriba]";
        }
      } else {
        messageText = "[NOTA_DE_VOZ_RECIBIDA: (Inaccesible, archivo vacío)]";
      }
    }
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

    // ── RATE LIMIT POR NÚMERO (anti-loop / anti-abuso) ──
    // Si este número ya recibió >= MAX_REPLIES_PER_MINUTE respuestas del bot en el último minuto,
    // pausamos 10 min y escalamos (algo está mal — bucle, cliente insistente, bot del otro lado).
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentReplies } = await supabase.from("whatsapp_rate_log")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", uid)
      .eq("phone_number", sender)
      .gte("sent_at", oneMinuteAgo);

    if ((recentReplies || 0) >= MAX_REPLIES_PER_MINUTE) {
      console.warn(`[WEBHOOK] 🚨 Rate limit alcanzado para ${sender} (${recentReplies} respuestas/min). Pausando 10 min.`);
      const pauseUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", sender);
      await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: sender, paused_until: pauseUntil });
      return NextResponse.json({ success: true, ignored: true, reason: "rate_limited" });
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

    // SCAMMER CHECK INSTANTÁNEO — cubre todos los formatos posibles del número
    const cleanPhone = sender.replace("@c.us", "");
    const last10 = cleanPhone.slice(-10);
    const { data: scammerData } = await supabase.from("scammers").select("id")
      .or(`phone_number.eq.${cleanPhone},phone_number.eq.0${last10},phone_number.eq.593${last10},phone_number.eq.+593${last10},phone_number.eq.+${cleanPhone}`).limit(1);

    if (scammerData && scammerData.length > 0) {
      await send("Lo sentimos, por motivos de seguridad no podemos procesar su solicitud. Comuníquese directamente con un asesor humano.");
      return NextResponse.json({ success: true, action: "scammer" });
    }

    // INDICADOR TYPING (No bloquea)
    fetch(`${waBaseUrl}/waInstance${providerConfig.idInstance}/sendAction/${providerConfig.apiTokenInstance}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: sender, action: "typing" }), signal: AbortSignal.timeout(3000),
    }).catch(() => { });

    // INSERCIÓN DIRECTA
    const { data: insertedChat } = await supabase.from("whatsapp_chats")
      .insert({ owner_id: uid, phone_number: sender, role: "user", content: messageText })
      .select('id').single();

    // ── DEBOUNCE INTELIGENTE PARA MENSAJES FRAGMENTADOS (3 SEGS) ──
    // Vercel Pro nos permite esperar más. Si el cliente escribe otra línea rápidamente 
    // o si GreenAPI tiene latencia entregando los Webhooks, esto evitará el doble disparo.
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (insertedChat?.id) {
      const { data: latestMsg } = await supabase.from("whatsapp_chats")
        .select("id")
        .eq("owner_id", uid)
        .eq("phone_number", sender)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestMsg && latestMsg.id !== insertedChat.id) {
        console.log(`[WEBHOOK] 🛑 Mensaje fragmentado detectado. Abortando instancia vieja (${messageText}).`);
        return NextResponse.json({ success: true, ignored: true, reason: "Fragmentado" });
      }
    }

    // ── OPTIMIZACIÓN DE COSTOS: HISTORIAL DE CONVERSACIÓN CORTO ──
    // Antes traíamos 40 mensajes. Eso leía +3,000 tokens innecesarios por cada respuesta.
    // 8 mensajes (4 envíos del cliente, 4 del bot) son más que suficientes para retener contexto en ventas.
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: rawHistory } = await supabase.from("whatsapp_chats")
      .select("role, content").eq("owner_id", uid).eq("phone_number", sender)
      .gte("created_at", sixHoursAgo)
      .order("created_at", { ascending: true }).limit(8);

    const history = rawHistory || [];

    // ── SHORTCUT TEMPLATED: si el mensaje es trivial (saludo puro, gracias, despedida)
    // respondemos sin llamar al LLM. Ahorra ~800 tokens/msg y baja latencia 2s.
    const hasHistory = history.length > 1;
    const shortcut = tryTemplatedShortcut(messageText, hasHistory, greetingMenu || null);
    if (shortcut && typeMessage === "textMessage") {
      const sent = await send(shortcut);
      if (sent) {
        await supabase.from("whatsapp_chats").insert({
          owner_id: uid, phone_number: sender, role: "model", content: shortcut,
        });
        await supabase.from("whatsapp_rate_log").insert({ owner_id: uid, phone_number: sender });
      }
      return NextResponse.json({ success: true, shortcut: true });
    }

    // ── OBTENER TAGS DEL CLIENTE PARA CONTEXTO ──
    const { data: userTags } = await supabase.from("whatsapp_contact_tags")
      .select("tag").eq("owner_id", uid).eq("phone_number", sender);
    const clientTags = userTags?.map(t => t.tag).join(", ") || "";

    // ── CONTRATO ABSOLUTO DEL SYSTEM PROMPT ──
    const systemPrompt = `Eres un asesor comercial experto de WhatsApp para una plataforma de servicios. Eres humano, amable, fluido y MUY preciso.
REGLAS VITALES Y ESTRICTAS DE COMPORTAMIENTO:
1. FLUIDEZ Y MEMORIA (CERO REPETICIONES): Tienes memoria perfecta del historial. Nunca, bajo ninguna circunstancia, vuelvas a saludar con "¡Hola! Bienvenido" si ya lo hiciste en los mensajes anteriores recientes. Habla directo, como si estuvieran en una conversación continua.
2. ANÁLISIS DE FRAGMENTACIÓN: Si el usuario manda mensajes entrecortados (ej: "hola" y luego "ayudame con saldo"), fusiónalos en tu mente y responde SOLO UNA VEZ abarcando todo. No respondas a los fragmentos por separado.
3. ADAPTACIÓN AL CONTEXTO: Si el cliente ya te dio una instrucción (ej: "Hola, quiero recargar 10 en pichincha"), obvia los protocolos de bienvenida y atiéndelo inmediatamente mostrando la cuenta. No seas redundante. No respondas saludos secos si el cliente ya te dijo a qué venía en el siguiente mensaje del historial.
4. DETECCIÓN DE FRAGMENTOS (SÚPER IMPORTANTE): Si el ÚLTIMO mensaje del cliente es una palabra suelta, preposición, o una frase inconclusa que no tiene un significado claro o accionable por sí sola (ej: "una", "quiero", "de", "para", "20"), DEBES responder EXACTAMENTE Y ÚNICAMENTE con el texto: [ESPERANDO_FRAGMENTO] . Esta acción es como guardar silencio para que el cliente pueda terminar de escribir su idea completa en el siguiente mensaje. ¡Nunca trates de adivinar un mensaje a medias!
5. GESTIÓN DE BANCOS INEXISTENTES: Si el cliente te pide o menciona un banco que NO está en tu lista de BANCOS DISPONIBLES, dile directa pero amablemente que "No manejamos ese banco por el momento" e inmediatamente OFRÉCELE las opciones que SÍ tienes disponibles en tu lista. No seas sumiso ni le des la razón si se equivoca.
6. PROTOCOLO DE RECARGAS (ID FLEXIBLE): Si el cliente desea hacer una recarga, es imprescindible que obtengas su "ID" (identificador de usuario en la plataforma), OJO: no es necesario que te mande el ID para que tú le des el número de cuenta; SÍ puedes darle los datos bancarios primero. Tu misión es simplemente asegurarte de pedirle su ID en algún punto del proceso (puede ser al inicio, junto con las cuentas, o incluso después de que te envíe el comprobante), pero nunca dar por terminada la recarga sin haberle solicitado el ID.
7. DATOS FINANCIEROS Y DE TITULARIDAD (RECARGAS): Al registrar una recarga, ES ABSOLUTAMENTE OBLIGATORIO que incluyas en tu mensaje los datos bancarios completos. Además, DEBES ADVERTIR SIEMPRE al usuario textualmente lo siguiente: "Recuerde que el titular de la cuenta bancaria desde donde realiza la transferencia DEBE SER EL MISMO dueño de la cuenta Ecuabet". Jamás le pidas depositar sin darle la cuenta exacta y esta advertencia.
8. ESCALACIÓN INMEDIATA: Si hay quejas, enojos, insultos, o solicita retiros complejos, ejecuta la orden 'escalar_a_humano' e infórmale que le pasarás el chat a un colega humano. No uses lenguaje técnico.
9. COMPRENSIÓN DE AUDIOS: Si recibes una etiqueta que comienza con '[NOTA_DE_VOZ_RECIBIDA: "...", tu labor es LEER y ENTENDER la transcripción dentro de las comillas como si el cliente te la hubiera escrito, y responderle normalmente hablando del tema. Si marca "Ininteligible" o vacío, dile diplomáticamente que estás experimentando fallas con los audios y que te escriba.
10. CAPTURA DE LEADS (CRM): Cuando percibas en el chat o en la nota de voz que el cliente menciona su Ciudad, País o Nombre genuino, ejecuta la herramienta 'recolectar_datos_contacto'. Tu meta silenciosa es sacarles su ciudad de forma amena, por ejemplo: "¿desde qué ciudad nos escribes para brindarte atención local?". Hazlo con sutileza.
11. IDENTIDAD: Bajo ninguna circunstancia digas que eres una Inteligencia Artificial o un Bot.
12. PREGUNTAS DE DISPONIBILIDAD: Si el cliente pregunta cosas como "estás activo?", "¿están trabajando?", "¿hay línea?", responde SIEMPRE con mucho entusiasmo que SÍ, que están 100% operativos.
13. PREGUNTAS FUERA DE LUGAR (OFF-TOPIC): Si el cliente te hace preguntas de conocimiento general, historia, geografía (ej. "¿cuál es el río más largo?", "¿quién descubrió América?"), ciencia, o cualquier tema que no tenga relación con la plataforma de apuestas, DEBES negarte amablemente a responder. Indícale que eres un asesor de atención al cliente y que solo puedes ayudarle con servicios de la plataforma, saldos y retiros. ¡NUNCA respondas a la pregunta real!
14. COMPROBANTES VERIFICADOS CON IA: Si recibes "[COMPROBANTE_ENVIADO_VERIFICADO] monto=$X.XX banco=Y ...", significa que un sistema automático ya validó que la imagen ES un comprobante real y extrajo los datos. Úsalos: confirma amablemente el depósito usando esos datos concretos (ej: "Confirmado tu depósito de $10.00 del Banco Pichincha"). Si el monto extraído NO coincide con lo que el cliente dijo al inicio, PREGUNTA (sin acusar) cuál es el correcto. Si el titular extraído es diferente al cliente, recuérdale amablemente la regla de titularidad.
15. COMPROBANTES INVÁLIDOS: Si recibes "[COMPROBANTE_INVALIDO: ...]", la imagen NO es un comprobante real (puede ser una captura de chat, meme, selfie, documento genérico). Pídele cordialmente que envíe el comprobante oficial de la transferencia bancaria. NO uses palabras como "fraude" o "mentira" — simplemente "la imagen no se ve correctamente, ¿me la puede reenviar?".

===== SOPORTE Y RESOLUCIÓN DE PROBLEMAS (ECUABET) =====
ACTUACIÓN: Si el usuario pide ayuda técnica, usa frases como "me ayuda con un problema", "necesito ayuda", "tengo un problema" (o sinónimos), ATIÉNDELO usando ESTA información oficial. NO lo escales inmediatamente.
- Apuesta ganada pero marcada como pérdida: Dile que vaya a la parte superior izquierda de la página principal de Ecuabet, deslice hasta "Chat" y describa su problema para que Soporte de Ecuabet le dé solución.
- Perdió/olvidó contraseña: Que haga clic en "Olvidaste tu contraseña" para recibir un código a su correo. Si no tiene acceso al correo, debe ir al chat de soporte en la página y detallar su situación.
- Tiene acceso a la cuenta Ecuabet pero NO al correo vinculado: Que vaya al chat de soporte (parte superior izquierda), describa el problema y llene el formulario que le brindarán para registrar su nuevo correo.
- Problema al iniciar sesión o pantalla de bloqueo: Pídele que borre el caché de su navegador. Luego intente entrar de nuevo. Si la cuenta sigue sin abrir, infórmale que su cuenta ha sido bloqueada por incumplir normas o por actividad sospechosa como "jineteo".
- ¿Qué es Jineteo?: Es recargar y retirar dinero repetidamente sin jugar ni perder patrimonio, solo para generar comisiones al agente. (El dinero solo circula).
- Pasos para generar nota de retiro: Ir a la parte superior izquierda -> Gestión -> Retirar -> método "Local Ecuador" -> escribir cantidad -> y confirmar con el código que llega al correo.
- Se descontó el dinero de Ecuabet pero no se generó la nota de retiro: Indícale que vaya al chat de soporte de la página y describa la situación. El saldo perdido se le volverá a acreditar allí para que intente generar la nota de retiro nuevamente.
- CAMBIO DE CORREO: El usuario debe enviar UN SOLO correo a soporte@ecuabet.com con los siguientes datos en el cuerpo:
  • ID de la cuenta Ecuabet
  • Nombre completo
  • Número de documento de identidad (CI o PASAPORTE)
  • Correo actual
  • Correo nuevo
  Y debe adjuntar las siguientes fotografías (NO en PDF, NO escaneadas, NO copia — deben ser fotos originales directas):
  • Foto de ambos lados del documento de identidad ORIGINAL (CI o PASAPORTE)
  • Foto tipo selfie sosteniendo el documento y una carta (escrita o impresa con letra legible, firmada A MANO con firma idéntica a la cédula) con el siguiente texto exacto: "Yo [nombre completo], titular de la cédula de identidad [número] identificado en ECUABET con la cuenta ID [id], hoy [DIA-MES-AÑO] Solicito la modificación de mi correo"
  La carta puede ser escrita o impresa, pero DEBE estar firmada a mano y con la fecha de la solicitud.

===== FLUJO DE RECARGAS DE SALDO =====
PROTOCOLO: "${rechargeSteps || "Averigua monto y banco."}"
BANCOS DISPONIBLES (Extrae las cuentas de aquí): ${banksInfo || "No tienes bancos cargados, usa escalar_a_humano"}

REGLA DE OTORGAMIENTO DE CUENTAS BANCARIAS: 
- VERIFICA LOS "TAGS DEL CLIENTE". Si el cliente NO tiene el tag 'cuentas_entregadas' o 'recarga_pendiente' (es CLIENTE NUEVO), SIGUE EL PROTOCOLO NORMAL: averigua el monto y banco, ofrécele bancos si no sabe, y OBLIGATORIAMENTE dale el número de cuenta al ejecutar registrar_recarga.
- Si el cliente YA TIENE el tag 'cuentas_entregadas' o 'recarga_pendiente' (CLIENTE FRECUENTE), SIGNIFICA QUE YA GUARDÓ TUS CUENTAS. **JAMÁS le mandes ni le ofrezcas la lista de bancos ni le preguntes adónde depositó**, a menos que él lo pida explícitamente. Atiéndelo asumiendo que ya sabe a qué cuenta depositar y solo ayúdalo a validar su saldo.

ACCIÓN CONDICIONADA (NUEVOS): En cuanto tengas el MONTO y el BANCO confirmado, EJECUTA la función 'registrar_recarga'. Muestra los datos de la cuenta y pide el comprobante.
SI RECIBES COMPROBANTE ([COMPROBANTE_ENVIADO]): 
- Si es CLIENTE FRECUENTE: Asume que ya depositó (NUNCA le ofrezcas bancos). Asegúrate de tener su "ID", dile que su recarga está siendo procesada y ejecuta de forma oculta la herramienta 'etiquetar_contacto' con 'cuentas_entregadas'.
- Si es CLIENTE NUEVO: Agradece formalmente, dile que entró en validación, ejecuta 'etiquetar_contacto' con el tag 'cuentas_entregadas' y despídete amablemente.

===== FLUJO DE RETIROS (COBROS) =====
PROTOCOLO: "${withdrawSteps || "Pide monto y número de cuenta."}"
ACCIÓN CONDICIONADA: Los retiros requieren trabajo manual. Una vez recopilados los datos de cuenta del cliente, ejecuta OBLIGATORIAMENTE 'escalar_a_humano' para dárselo a tu colega de finanzas.

EMPATÍA FINAL: ${aiPersona || "Excelente trato financiero, amable, profesional."}
KNOWLEDGE BASE: ${knowledgeBase || ""}
${greetingMenu ? `MENÚ DE BIENVENIDA (Usa este menú SOLO en el PRIMER saludo del cliente, cuando no hay historial previo): ${greetingMenu}` : ""}
CLIENTE: ${senderName}
TAGS DEL CLIENTE: ${clientTags || "Ninguno (Cliente Nuevo)"}`;

    // ── LLAMADA DIRECTA A OPENAI ──
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: "No API Key" }, { status: 500 });
    const openai = new OpenAI({ apiKey: openaiKey });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }];

    // Inyectar historial EXCLUYENDO el último mensaje (ya se insertó en línea 358
    // y la IA lo vería duplicado si lo incluimos aquí)
    const historyWithoutLast = history.slice(0, -1);
    for (const msg of historyWithoutLast) {
      messages.push({ role: msg.role === "model" ? "assistant" : "user", content: msg.content });
    }
    // Agregar el mensaje actual como el último mensaje del usuario
    messages.push({ role: "user", content: messageText });

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
            let args: Record<string, any> = {};
            try { args = JSON.parse(toolCall.function.arguments); } catch {
              console.warn(`[WEBHOOK] ⚠️ Args malformados para ${toolCall.function.name}: ${toolCall.function.arguments}`);
              messages.push({ role: "tool", tool_call_id: toolCall.id, content: "Error: argumentos inválidos, no se ejecutó la herramienta." });
              continue;
            }

            // Validar que registrar_recarga tenga datos reales
            if (toolCall.function.name === "registrar_recarga" && (!args.monto || !args.banco)) {
              console.warn(`[WEBHOOK] ⚠️ registrar_recarga con datos incompletos: monto=${args.monto}, banco=${args.banco}`);
              messages.push({ role: "tool", tool_call_id: toolCall.id, content: "Error: falta el monto o el banco. Pregúntale al cliente." });
              continue;
            }

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

      // Si después de 3 rondas la IA sigue pidiendo tools sin dar texto, forzar respuesta final
      if (completion.choices[0]?.finish_reason === "tool_calls") {
        messages.push(completion.choices[0].message);
        // Responder los tool_calls pendientes con error para que la IA genere texto
        for (const tc of completion.choices[0].message.tool_calls || []) {
          messages.push({ role: "tool", tool_call_id: tc.id, content: "Límite de acciones alcanzado. Responde al cliente con lo que tienes." });
        }
        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini", messages, max_tokens: 300, temperature: 0.35,
        });
      }

      if (completion.choices[0]?.finish_reason === "content_filter") {
        aiResponse = "Disculpe, por ahora no puedo ayudarle con eso. ¿Gusta que le comunique con un asesor?";
      } else {
        aiResponse = completion.choices[0]?.message?.content?.trim() || "";
      }
    } catch (e: any) {
      console.error("[WEBHOOK/OPENAI] Error:", e.stack || e.message);
      aiResponse = "¡Hola! ¿Dime cómo te podemos ayudar hoy? (Disculpa, tuvimos una breve actualización técnica)";
    }

    if (!aiResponse) aiResponse = "¿En qué te puedo ayudar?"; // Safe fallback

    // ── INTERCEPTOR DE SILENCIO CEREBRAL ──
    if (aiResponse.includes("[ESPERANDO_FRAGMENTO]")) {
      console.log(`[WEBHOOK] 🤫 IA detectó mensaje cortado, guardando silencio...`);
      // Borrar el fragmento de la DB para no contaminar el historial
      if (insertedChat?.id) {
        await supabase.from("whatsapp_chats").delete().eq("id", insertedChat.id);
      }
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje Fragmentado (AI)" });
    }

    // ── SANITIZAR: eliminar instrucciones internas que la IA pueda filtrar ──
    aiResponse = aiResponse
      .replace(/\[ESPERANDO_FRAGMENTO\]/gi, "")
      .replace(/¡ACCIÓN COMPLETADA![^.]*\./gi, "")
      .replace(/\[INSTRUCCIÓN[^\]]*\]/gi, "")
      .replace(/\[TOOL[^\]]*\]/gi, "")
      .trim();
    if (!aiResponse) aiResponse = "¿En qué más te puedo ayudar?";

    // ── DESPACHO CEREBRAL ──
    const sent = await send(aiResponse);

    // Solo guardar en DB si el mensaje se envió correctamente
    if (sent) {
      await supabase.from("whatsapp_chats").insert({ owner_id: uid, phone_number: sender, role: "model", content: aiResponse });
      // Rate-limit log (best-effort)
      supabase.from("whatsapp_rate_log").insert({ owner_id: uid, phone_number: sender }).then(() => {});
    } else {
      console.warn(`[WEBHOOK] ⚠️ Mensaje NO enviado a ${sender}, no se guarda en historial.`);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[WEBHOOK/CRASH]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", version: "v5_pure_ai" });
}
