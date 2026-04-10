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
  ctx: { uid: string; sender: string; senderName: string; adminEmail: string; waBaseUrl: string; idInstance: string; apiToken: string; settings?: any; }
): Promise<string> {

  if (name === "registrar_recarga") {
    const { monto, banco } = args;
    if (!monto || typeof monto !== "number" || monto <= 0 || monto > 50000) {
      return `Error: monto inválido (${monto}). Debe ser un número entre 1 y 50000.`;
    }
    if (!banco || typeof banco !== "string" || banco.trim() === "") {
      return "Error: banco no especificado o inválido.";
    }
    // Verificar que el banco existe en la lista configurada
    const banksList = ctx.settings?.banksList || [];
    const bankNames = banksList.map((b: any) => (b.name || "").toLowerCase());
    const bancoNormalizado = banco.toLowerCase().trim();
    const bancoValido = banksList.length === 0 || bankNames.some((bn: string) =>
      bancoNormalizado.includes(bn) || bn.includes(bancoNormalizado)
    );
    if (!bancoValido) {
      return `Error: el banco "${banco}" no está en la lista de bancos configurados. Los bancos disponibles son: ${banksList.map((b: any) => b.name).join(", ")}`;
    }
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
        const pauseUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
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
    const messageId = payload.idMessage || `${sender}_${typeMessage}_${Date.now()}`;
    if (messageId) {
      const { error: dedupErr } = await supabase.from("whatsapp_processed_messages").insert({ message_id: messageId });
      if (dedupErr?.code === "23505") return NextResponse.json({ success: true, ignored: true, reason: "Duplicado" });
    }

    // ── VERIFICAR PAUSAS ESTRICTAS DE RESPUESTA ──
    const { data: pauses, error: pausesErr } = await supabase.from("whatsapp_pauses").select("paused_until")
      .eq("owner_id", uid).in("phone_number", ["GLOBAL", sender]);
    if (pausesErr) console.error("[WEBHOOK/SUPABASE] Error leyendo pausas:", pausesErr.message);
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

    // ── HISTORIAL DE CONVERSACIÓN RAPIDO ──
    const { data: rawHistory } = await supabase.from("whatsapp_chats")
      .select("role, content").eq("owner_id", uid).eq("phone_number", sender)
      .order("created_at", { ascending: true }).limit(30);

    const history = rawHistory || [];

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

===== SOPORTE Y RESOLUCIÓN DE PROBLEMAS (ECUABET) =====
ACTUACIÓN: Si el usuario pide ayuda técnica, usa frases como "me ayuda con un problema", "necesito ayuda", "tengo un problema" (o sinónimos), ATIÉNDELO usando ESTA información oficial. NO lo escales inmediatamente.
- Apuesta ganada pero marcada como pérdida: Dile que vaya a la parte superior izquierda de la página principal de Ecuabet, deslice hasta "Chat" y describa su problema para que Soporte de Ecuabet le dé solución.
- Perdió/olvidó contraseña: Que haga clic en "Olvidaste tu contraseña" para recibir un código a su correo. Si no tiene acceso al correo, debe ir al chat de soporte en la página y detallar su situación.
- Tiene acceso a la cuenta Ecuabet pero NO al correo vinculado: Que vaya al chat de soporte (parte superior izquierda), describa el problema y llene el formulario que le brindarán para registrar su nuevo correo.
- Problema al iniciar sesión o pantalla de bloqueo: Pídele que borre el caché de su navegador. Luego intente entrar de nuevo. Si la cuenta sigue sin abrir, infórmale que su cuenta ha sido bloqueada por incumplir normas o por actividad sospechosa como "jineteo".
- ¿Qué es Jineteo?: Es recargar y retirar dinero repetidamente sin jugar ni perder patrimonio, solo para generar comisiones al agente. (El dinero solo circula).
- Pasos para generar nota de retiro: Ir a la parte superior izquierda -> Gestión -> Retirar -> método "Local Ecuador" -> escribir cantidad -> y confirmar con el código que llega al correo.
- Se descontó el dinero de Ecuabet pero no se generó la nota de retiro: Indícale que vaya al chat de soporte de la página y describa la situación. El saldo perdido se le volverá a acreditar allí para que intente generar la nota de retiro nuevamente.

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
CLIENTE: ${senderName}
TAGS DEL CLIENTE: ${clientTags || "Ninguno (Cliente Nuevo)"}`;

    // ── LLAMADA DIRECTA A OPENAI ──
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: "No API Key" }, { status: 500 });
    const openai = new OpenAI({ apiKey: openaiKey });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }];

    // Inyectar el historial (excluyendo el último porque el LLM lo verá como el "prompt")
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
      }, { timeout: 30000 });

      // Lógica nativa de Tool execution (max 3 rondas)
      for (let round = 0; round < 3; round++) {
        const choice = completion.choices[0];
        if (choice.finish_reason === "tool_calls" || choice.message.tool_calls?.length) {
          messages.push(choice.message);

          for (const toolCall of choice.message.tool_calls || []) {
            if (toolCall.type !== 'function') continue;
            let args: Record<string, any> = {};
            try { args = JSON.parse(toolCall.function.arguments); } catch {
              console.warn(`[WEBHOOK] Tool args parse error para ${toolCall.function.name}:`, toolCall.function.arguments);
            }
            if (toolCall.function.name === "registrar_recarga" && (!args.monto || !args.banco)) {
              messages.push({ role: "tool", tool_call_id: toolCall.id, content: "Error: argumentos incompletos para registrar_recarga." });
              continue;
            }

            console.log(`[WEBHOOK] 🔧 Ejecutando Tool: ${toolCall.function.name}`, args);
            const toolResult = await executeTool(toolCall.function.name, args, {
              uid, sender, senderName, adminEmail, waBaseUrl,
              idInstance: providerConfig.idInstance, apiToken: providerConfig.apiTokenInstance,
              settings,
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
      const isTimeout = e?.code === "ETIMEDOUT" || e?.type === "request-timeout" || e?.message?.includes("timeout");
      console.error(`[WEBHOOK/OPENAI] ${isTimeout ? "Timeout" : "Error"}:`, e.message);
      aiResponse = isTimeout
        ? "Disculpa, estamos atendiendo muchas consultas en este momento. ¿Puedes repetir tu mensaje en unos segundos?"
        : "¡Hola! ¿Dime cómo te podemos ayudar hoy? (Disculpa, tuvimos una breve actualización técnica)";
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
    const crashId = `crash_${Date.now()}`;
    console.error(`[WEBHOOK/CRASH][${crashId}]`, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Internal Server Error", ref: crashId }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", version: "v5_pure_ai" });
}
