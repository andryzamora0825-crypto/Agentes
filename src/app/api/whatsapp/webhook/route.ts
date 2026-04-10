import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import OpenAI, { toFile } from "openai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45; // Previene caída prematura en Vercel si el plan lo permite

const PAUSE_HUMAN_MINUTES = 10;    // Auto-pausa por intervención del agente humano
const ESCALATION_PAUSE_MIN = 10;   // Pausa cuando el bot escala a humano (antes estaba en 30)

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
      .upsert([
        { owner_id: ctx.uid, phone_number: ctx.sender, tag: "recarga_pendiente" },
        { owner_id: ctx.uid, phone_number: ctx.sender, tag: "cuentas_entregadas" }
      ], { onConflict: "owner_id,phone_number,tag" });
    console.log(`[TOOL] ✅ Recarga registrada: $${monto} - ${banco}`);
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
      const { data: existingPause, error: pauseErr } = await supabase.from("whatsapp_pauses")
        .select("paused_until").eq("owner_id", uid).eq("phone_number", chatId).limit(1).maybeSingle();

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
    else if (['imageMessage', 'documentMessage'].includes(typeMessage)) {
      messageText = "[COMPROBANTE_ENVIADO]";
    }
    else if (typeMessage === 'audioMessage') {
      const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl;
      if (downloadUrl) {
        try {
          const audioRes = await fetch(downloadUrl);
          const audioBuffer = await audioRes.arrayBuffer();
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

    // INSERCIÓN DIRECTA
    const { data: insertedChat } = await supabase.from("whatsapp_chats")
      .insert({ owner_id: uid, phone_number: sender, role: "user", content: messageText })
      .select('id').single();

    // ── DEBOUNCE INTELIGENTE PARA MENSAJES FRAGMENTADOS (5 SEGS) ──
    // Espera 5 segundos antes de procesar para capturar todos los mensajes del mismo turno.
    // Si el usuario manda 3 mensajes rápidos, solo el último invoca a OpenAI con todos agrupados.
    await new Promise(resolve => setTimeout(resolve, 5000));

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

    // Typing justo antes de procesar (debounce ya pasó, ahora sí vamos a responder)
    fetch(`${waBaseUrl}/waInstance${providerConfig.idInstance}/sendAction/${providerConfig.apiTokenInstance}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: sender, action: "typing" }), signal: AbortSignal.timeout(3000),
    }).catch(() => { });

    // ── HISTORIAL DE CONVERSACIÓN ──
    const { data: rawHistory } = await supabase.from("whatsapp_chats")
      .select("role, content").eq("owner_id", uid).eq("phone_number", sender)
      .order("created_at", { ascending: true }).limit(40);

    const history = rawHistory || [];

    // ── AGRUPAR MENSAJES DEL TURNO ACTUAL ──
    // Detectar todos los mensajes del cliente desde la última respuesta del bot.
    // Si mandó 3 mensajes seguidos, los agrupamos en un solo "turno" para OpenAI.
    let turnStart = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "model") {
        turnStart = i + 1;
        break;
      }
    }
    const currentTurnMsgs = history.slice(turnStart).filter(m => m.role === "user");
    const isMultiTurn = currentTurnMsgs.length > 1;
    if (isMultiTurn) {
      console.log(`[WEBHOOK] 📦 Turno multi-mensaje: ${currentTurnMsgs.length} mensajes agrupados para análisis`);
    }

    // ── OBTENER TAGS DEL CLIENTE PARA CONTEXTO ──
    const { data: userTags } = await supabase.from("whatsapp_contact_tags")
      .select("tag").eq("owner_id", uid).eq("phone_number", sender);
    const clientTags = userTags?.map(t => t.tag).join(", ") || "";

    // ── SYSTEM PROMPT — Configuración del usuario va PRIMERO para que el modelo la priorice ──
    const systemPrompt = `# ROL Y PERSONALIDAD (PRIORIDAD MÁXIMA)
${aiPersona || "Eres un asesor comercial experto, amable, fluido y muy preciso. Hablas como humano, nunca como robot."}
Eres humano. Bajo ninguna circunstancia admitas ser IA o bot.

${greetingMenu ? `# MENÚ Y BIENVENIDA\n${greetingMenu}\n` : ""}
${knowledgeBase ? `# BASE DE CONOCIMIENTO ESPECÍFICA (úsala siempre que aplique)\n${knowledgeBase}\n` : ""}

# CONTEXTO DE ESTA CONVERSACIÓN
- Cliente: ${senderName}
- Tags del cliente: ${clientTags || "Ninguno (Cliente Nuevo)"}

# BANCOS DISPONIBLES (extrae cuentas exactas de aquí para dar al cliente)
${banksInfo || "No tienes bancos cargados — usa escalar_a_humano si piden recarga."}

# PROTOCOLO DE RECARGAS
${rechargeSteps || "Averigua monto y banco antes de registrar la recarga."}

REGLA DE CUENTAS BANCARIAS:
- Cliente SIN tags 'cuentas_entregadas' / 'recarga_pendiente' → CLIENTE NUEVO: averigua monto y banco, dale la cuenta exacta al ejecutar registrar_recarga.
- Cliente CON esos tags → CLIENTE FRECUENTE: ya tiene las cuentas guardadas. JAMÁS le mandes ni ofrezcas la lista de bancos a menos que él lo pida explícitamente.
- Al registrar recarga SIEMPRE incluye los datos bancarios completos en tu respuesta y SIEMPRE añade: "Recuerde que el titular de la cuenta bancaria DEBE SER EL MISMO dueño de la cuenta Ecuabet."
- Nunca des por terminada una recarga sin haberle pedido el ID de su cuenta Ecuabet (puedes pedirlo antes, durante o después de darle la cuenta, pero es obligatorio).

SI RECIBES [COMPROBANTE_ENVIADO]:
- Cliente frecuente: asume que depositó, pide su ID, confirma que está en proceso, ejecuta 'etiquetar_contacto' con 'cuentas_entregadas'.
- Cliente nuevo: agradece, confirma validación, ejecuta 'etiquetar_contacto' con 'cuentas_entregadas', despídete.

# PROTOCOLO DE RETIROS
${withdrawSteps || "Recopila monto y número de cuenta del cliente."}
Los retiros son manuales — una vez recopilados los datos ejecuta OBLIGATORIAMENTE 'escalar_a_humano'.

# SOPORTE TÉCNICO ECUABET (NO escales directamente — atiende primero)
- Apuesta ganada marcada como pérdida → parte superior izquierda de Ecuabet → Chat → describir el problema.
- Perdió/olvidó contraseña → "Olvidaste tu contraseña" en la página → código al correo. Sin acceso al correo → chat de soporte.
- Tiene cuenta Ecuabet pero no el correo vinculado → chat de soporte (superior izq.) → formulario para registrar nuevo correo.
- Problema al iniciar sesión / pantalla bloqueada → borrar caché del navegador e intentar de nuevo. Si sigue → cuenta bloqueada por incumplir normas o jineteo.
- Jineteo = recargar y retirar repetidamente sin jugar, solo para generar comisiones al agente.
- Pasos para nota de retiro → superior izquierda → Gestión → Retirar → Local Ecuador → cantidad → confirmar con código al correo.
- Se descontó saldo pero no salió la nota → chat de soporte de Ecuabet, le devolverán el saldo para reintentarlo.
- CAMBIO DE CORREO → el usuario debe enviar UN SOLO correo a soporte@ecuabet.com con lo siguiente:
  Datos en el cuerpo del mail:
  • ID de la cuenta Ecuabet
  • Nombre completo
  • Número de documento de identidad (CI o PASAPORTE)
  • Correo actual
  • Correo nuevo
  Fotografías adjuntas (NO en PDF, NO escaneadas, NO copia — deben ser fotos originales):
  • Foto de ambos lados del documento de identidad ORIGINAL (CI o PASAPORTE)
  • Selfie sosteniendo el documento y una carta (escrita o impresa, firmada a mano con firma idéntica a la cédula) con el siguiente texto exacto: "Yo [nombre], titular de la cédula [número] identificado en ECUABET con la cuenta ID [id], hoy [DIA-MES-AÑO] Solicito la modificación de mi correo"
  La carta puede ser escrita o impresa (letra legible) pero DEBE estar firmada a mano y con la fecha de la solicitud.

# REGLAS DE COMPORTAMIENTO (obligatorias)
1. MEMORIA: Nunca vuelvas a saludar si ya lo hiciste. Habla directo, conversación continua.
2. MENSAJES MÚLTIPLES: Si ves mensajes agrupados con [1] [2] [3] ..., analízalos TODOS y responde en UN SOLO mensaje coherente que cubra todo.
3. FRAGMENTOS INCOMPLETOS: Si el último mensaje es una palabra suelta o frase sin sentido accionable ("quiero", "una", "de", "20" sin contexto), responde ÚNICAMENTE: [ESPERANDO_FRAGMENTO]
4. BANCO NO DISPONIBLE: Si piden un banco que no está en tu lista, dilo amablemente y ofrece los que sí tienes.
5. DISPONIBILIDAD: Si preguntan si estás activo/trabajando/hay línea → responde con entusiasmo que SÍ, 100% operativos.
6. ESCALACIÓN: Quejas, enojos, insultos o retiros complejos → ejecuta 'escalar_a_humano', informa que un colega lo atenderá (sin tecnicismos).
7. AUDIOS: Etiqueta [NOTA_DE_VOZ_RECIBIDA: "..."] → lee la transcripción y responde normalmente. Si dice "ininteligible" → pide que escriba.
8. LEADS (silencioso): Si el cliente menciona su nombre o ciudad genuinos → ejecuta 'recolectar_datos_contacto' discretamente.
9. OFF-TOPIC: Preguntas de cultura general, historia, ciencia → niégate amablemente, solo puedes ayudar con servicios de la plataforma.`;

    // ── LLAMADA DIRECTA A OPENAI ──
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: "No API Key" }, { status: 500 });
    const openai = new OpenAI({ apiKey: openaiKey });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }];

    if (isMultiTurn) {
      // Inyectar historial hasta antes del turno actual
      const historyBeforeTurn = history.slice(0, turnStart);
      for (const msg of historyBeforeTurn) {
        messages.push({ role: msg.role === "model" ? "assistant" : "user", content: msg.content });
      }
      // Agrupar los mensajes del turno en uno solo para que la IA los analice juntos
      const grouped = currentTurnMsgs.map((m, i) => `[${i + 1}] ${m.content}`).join("\n");
      messages.push({
        role: "user",
        content: `[IMPORTANTE: El cliente envió ${currentTurnMsgs.length} mensajes seguidos. Analízalos todos como una sola consulta y responde TODO en un único mensaje coherente.]\n${grouped}`,
      });
    } else {
      // Turno normal: inyectar historial completo
      for (const msg of history) {
        messages.push({ role: msg.role === "model" ? "assistant" : "user", content: msg.content });
      }
    }

    let aiResponse = "";
    try {
      let completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: BOT_TOOLS,
        tool_choice: "auto",
        max_tokens: 600,
        temperature: 0.3,
      });

      // Lógica nativa de Tool execution (max 3 rondas)
      for (let round = 0; round < 3; round++) {
        const choice = completion.choices[0];
        if (choice.finish_reason === "tool_calls" || choice.message.tool_calls?.length) {
          messages.push(choice.message);

          for (const toolCall of choice.message.tool_calls || []) {
            if (toolCall.type !== 'function') continue;
            let args = {}; try { args = JSON.parse(toolCall.function.arguments); } catch { }

            console.log(`[WEBHOOK] 🔧 Ejecutando Tool: ${toolCall.function.name}`, args);
            const toolResult = await executeTool(toolCall.function.name, args, {
              uid, sender, senderName, adminEmail, waBaseUrl,
              idInstance: providerConfig.idInstance, apiToken: providerConfig.apiTokenInstance,
            });
            messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
          }

          completion = await openai.chat.completions.create({
            model: "gpt-4o", messages, tools: BOT_TOOLS, tool_choice: "auto", max_tokens: 600, temperature: 0.3,
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
      console.error("[WEBHOOK/OPENAI] Error:", e.stack || e.message);
      aiResponse = "¡Hola! ¿Dime cómo te podemos ayudar hoy? (Disculpa, tuvimos una breve actualización técnica)";
    }

    if (!aiResponse) aiResponse = "¿En qué te puedo ayudar?"; // Safe fallback

    // ── INTERCEPTOR DE SILENCIO CEREBRAL ──
    if (aiResponse.includes("[ESPERANDO_FRAGMENTO]")) {
      console.log(`[WEBHOOK] 🤫 IA detectó mensaje cortado, guardando silencio...`);
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje Fragmentado (AI)" });
    }

    // ── DESPACHO CEREBRAL ──
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
