import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

const PAUSE_HUMAN_MINUTES = 10;    // Auto-pausa por intervención del agente humano
const ESCALATION_PAUSE_MIN = 30;   // Pausa cuando el bot escala a humano

// =====================================================
// TIPOS DE INTENCIÓN
// =====================================================
type Intent = 'greeting' | 'recarga' | 'retiro' | 'comprobante' | 'queja' | 'button_reply' | 'escalacion' | 'consulta';

function classifyIntent(text: string, typeMessage: string): Intent {
  // Respuesta a botón interactivo de WhatsApp
  if (typeMessage === 'buttonsResponseMessage') return 'button_reply';
  // Imagen / documento / video → comprobante
  if (['imageMessage', 'documentMessage', 'videoMessage', 'audioMessage'].includes(typeMessage)) return 'comprobante';

  const lower = text.toLowerCase().trim();
  const is = (words: string[]) => words.some(w => lower.includes(w));

  // Escalación: cliente pide hablar con humano
  if (is(['hablar con un humano', 'hablar con humano', 'hablar con una persona', 'quiero un humano',
    'no quiero robot', 'no quiero un robot', 'no quiero que me responda un robot', 'no quiero bot',
    'agente humano', 'persona real', 'asesor humano', 'necesito un humano', 'pásame con alguien',
    'operador', 'quiero hablar con alguien'])) return 'escalacion';

  if (is(['hola', 'buenas', 'buenos', 'buen dia', 'buen día', 'hi ', 'hey', 'ey ', 'saludos', 'buenas noches', 'buenas tardes']) || lower === 'hola' || lower === 'hi') return 'greeting';
  if (is(['recarga', 'recargar', 'depositar', 'deposito', 'cargar saldo', 'quiero cargar'])) return 'recarga';
  if (is(['retiro', 'retirar', 'sacar', 'cobrar', 'quiero retirar', 'quiero sacar'])) return 'retiro';
  if (is(['problema', 'queja', 'reclamo', 'error', 'falla', 'no funciona', 'no me llega', 'no aparece'])) return 'queja';

  return 'consulta';
}

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

  // Enviar botones interactivos (máx 3 botones en WhatsApp)
  const sendButtons = async (message: string, buttons: string[], footer?: string): Promise<boolean> => {
    // Green-API limita a 3 botones. Si hay más, los partimos en múltiples envíos.
    const chunks: string[][] = [];
    for (let i = 0; i < buttons.length; i += 3) chunks.push(buttons.slice(i, i + 3));

    for (const chunk of chunks) {
      try {
        const res = await fetch(`${waBaseUrl}/waInstance${idInstance}/sendButtons/${apiToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message,
            buttons: chunk.map((text, idx) => ({ buttonId: String(idx + 1), buttonText: text })),
            footer: footer || "",
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          // Si Green-API no soporta botones en esta cuenta, caer a texto normal
          console.warn('[WEBHOOK] sendButtons falló, enviando texto alternativo');
          const fallback = `${message}\n\n${chunk.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;
          await send(fallback);
        }
        message = "También puedes elegir:"; // Header para chunk 2+
      } catch (e: any) {
        console.warn(`[WEBHOOK] sendButtons excepción: ${e.message}`);
        const fallback = `${message}\n\n${chunk.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;
        await send(fallback);
      }
    }
    return true;
  };

  return { send, sendButtons };
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
      description: "Transfiere la conversación a un agente humano cuando el bot no puede resolver el problema, o cuando el cliente pide hablar con una persona. Después de escalar, avisa al cliente.",
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
    return `¡ACCIÓN COMPLETADA! El chat ha sido pausado. AHORA RESPONDE AL CLIENTE: dile de forma natural que un asesor o compañero lo atenderá en breve. PROHIBIDO mencionar las palabras "escalar", "bot", "IA" o "pausa".`;
  }

  return "Herramienta no reconocida.";
}

// =====================================================
// WEBHOOK PRINCIPAL
// =====================================================
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const payload = await request.json();
    const webhookType = payload.typeWebhook;

    // Ignorar mensajes del propio bot enviados por API
    if (webhookType === "outgoingAPIMessageReceived") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const chatId: string = payload.senderData?.chatId || payload.chatId || "";

    // ── BLOQUEO DEFINITIVO DE GRUPOS ──
    if (chatId.includes("@g.us")) {
      return NextResponse.json({ success: true, ignored: true, reason: "Grupo" });
    }

    // ── AUTO-PAUSA POR INTERVENCIÓN DE HUMANO ──
    if (webhookType === "outgoingMessage" || webhookType === "outgoingMessageReceived") {
      if (!chatId) return NextResponse.json({ success: true, ignored: true });

      const outText = (payload.messageData?.textMessageData?.textMessage || payload.messageData?.extendedTextMessageData?.text || "").toLowerCase().trim();

      // ── COMANDOS EXPLÍCITOS (procesar y salir inmediatamente) ──
      if (outText === "#contact") {
        // Pausa permanente (100 años)
        const pauseUntil = new Date(Date.now() + 52560000 * 60 * 1000).toISOString();
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
        await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: chatId, paused_until: pauseUntil });
        console.log(`[WEBHOOK] 🛑 Comando #contact: Bot pausado PERMANENTEMENTE en ${chatId}`);
        return NextResponse.json({ success: true, action: "paused_permanent" });
      }

      if (outText === "#pause") {
        const pauseUntil = new Date(Date.now() + PAUSE_HUMAN_MINUTES * 60 * 1000).toISOString();
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
        await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: chatId, paused_until: pauseUntil });
        console.log(`[WEBHOOK] ⏸ Comando #pause: Bot pausado ${PAUSE_HUMAN_MINUTES} min en ${chatId}`);
        return NextResponse.json({ success: true, action: "paused_temp" });
      }

      if (outText === "#resume") {
        await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
        console.log(`[WEBHOOK] ▶️ Comando #resume: Bot reactivado para ${chatId}`);
        return NextResponse.json({ success: true, action: "resumed" });
      }

      // ── MENSAJE NORMAL DEL AGENTE HUMANO ──
      // Verificar si ya existe una pausa de larga duración (>24h) para este chat.
      // Si existe, NO la sobreescribimos (protege la pausa de #contact).
      const { data: existingPause } = await supabase
        .from("whatsapp_pauses")
        .select("paused_until")
        .eq("owner_id", uid)
        .eq("phone_number", chatId)
        .limit(1)
        .single();

      if (existingPause) {
        const timeLeftMs = new Date(existingPause.paused_until).getTime() - Date.now();
        const hoursLeft = timeLeftMs / (1000 * 60 * 60);
        if (hoursLeft > 24) {
          // Hay una pausa de larga duración activa (#contact o similar). No sobreescribir.
          console.log(`[WEBHOOK] 🔒 Pausa permanente activa para ${chatId} (${Math.round(hoursLeft)}h restantes). No sobreescribir.`);
          return NextResponse.json({ success: true, action: "long_pause_preserved" });
        }
      }

      // Auto-pausa corta por intervención manual del humano
      const pauseUntil = new Date(Date.now() + PAUSE_HUMAN_MINUTES * 60 * 1000).toISOString();
      await supabase.from("whatsapp_pauses").delete().eq("owner_id", uid).eq("phone_number", chatId);
      await supabase.from("whatsapp_pauses").insert({ owner_id: uid, phone_number: chatId, paused_until: pauseUntil });
      console.log(`[WEBHOOK] 🛑 Humano intervino. Pausa de ${PAUSE_HUMAN_MINUTES}min para ${chatId}`);
      return NextResponse.json({ success: true, action: "auto_paused" });
    }

    if (webhookType !== "incomingMessageReceived") {
      return NextResponse.json({ success: true, ignored: true, reason: "Tipo no procesable" });
    }

    const sender: string = payload.senderData?.sender || "";
    const instanceWid: string = payload.instanceData?.wid || "";
    if (!sender || sender === instanceWid) {
      return NextResponse.json({ success: true, ignored: true, reason: "Loop evitado" });
    }

    // ── PREVENCIÓN: MENSAJES VIEJOS (> 2 min) ──
    const msgTimestamp = payload.messageData?.timestamp || payload.timestamp || 0;
    if (msgTimestamp && Date.now() / 1000 - msgTimestamp > 120) {
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje antiguo" });
    }

    // ── EXTRACCIÓN DEL TEXTO / TIPO ──
    const typeMessage: string = payload.messageData?.typeMessage || "";
    let messageText = "";
    let isComprobante = false;

    if (typeMessage === "textMessage") {
      messageText = payload.messageData?.textMessageData?.textMessage || "";
    } else if (typeMessage === "extendedTextMessage") {
      messageText = payload.messageData?.extendedTextMessageData?.text || "";
    } else if (typeMessage === "buttonsResponseMessage") {
      // Respuesta a un botón interactivo
      messageText = payload.messageData?.buttonsResponseMessage?.selectedDisplayText || "";
    } else if (typeMessage === "contactMessage" || typeMessage === "contactsArrayMessage") {
      // ── CONTACTO REENVIADO (vCard) ──
      const vcard = payload.messageData?.contactMessageData?.vcard
        || payload.messageData?.contactMessage?.vcard || "";
      const displayName = payload.messageData?.contactMessageData?.displayName
        || payload.messageData?.contactMessage?.displayName || "Contacto";
      // Extraer teléfono del vCard
      const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
      const phone = phoneMatch ? phoneMatch[1].replace(/[\s-]/g, "") : "";
      messageText = phone
        ? `[CONTACTO_REENVIADO] Nombre: ${displayName}, Teléfono: ${phone}`
        : `[CONTACTO_REENVIADO] Nombre: ${displayName}`;
    } else if (['imageMessage', 'documentMessage'].includes(typeMessage)) {
      isComprobante = true;
      messageText = "[COMPROBANTE_ENVIADO]";
    } else if (typeMessage === 'audioMessage') {
      messageText = "[NOTA_DE_VOZ_RECIBIDA]";
    } else {
      messageText = `[ARCHIVO_TIPO_${typeMessage}_RECIBIDO]`;
    }

    if (!messageText.trim()) {
      return NextResponse.json({ success: true, ignored: true, reason: "Vacío" });
    }

    // ── ANTI-DUPLICADO ──
    const messageId = payload.idMessage || "";
    if (messageId) {
      const { error: dedupErr } = await supabase.from("whatsapp_processed_messages").insert({ message_id: messageId });
      if (dedupErr?.code === "23505") {
        return NextResponse.json({ success: true, ignored: true, reason: "Duplicado" });
      }
    }

    const senderName = payload.senderData?.senderName || "Cliente";

    // ── CARGAR CONFIGURACIÓN DEL AGENTE Y EARLY TYPING ──
    const clerkClient_ = await clerkClient();
    const user = await clerkClient_.users.getUser(uid);
    if (!user) throw new Error("Usuario no encontrado");

    const settings = user.publicMetadata?.whatsappSettings as any;
    if (!settings?.isActive) return NextResponse.json({ success: true, ignored: true, reason: "Bot desactivado" });

    const { providerConfig, aiPersona, knowledgeBase, banksInfo, rechargeSteps, withdrawSteps, greetingMenu } = settings;
    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      return NextResponse.json({ success: true, ignored: true, reason: "API no configurada" });
    }

    const adminEmail = (user.emailAddresses?.[0]?.emailAddress || "") as string;
    const waBaseUrl = providerConfig.apiUrl.replace(/\/$/, "");
    const { send, sendButtons } = makeWASender(waBaseUrl, providerConfig.idInstance, providerConfig.apiTokenInstance, sender);

    // ── VERIFICAR PAUSA (Early check) ──
    const { data: pauses } = await supabase
      .from("whatsapp_pauses")
      .select("paused_until, phone_number")
      .eq("owner_id", uid)
      .in("phone_number", ["GLOBAL", sender]);

    if (pauses?.some(p => new Date(p.paused_until) > new Date())) {
      console.log(`[WEBHOOK] 🛑 En pausa para ${sender}`);
      return NextResponse.json({ success: true, ignored: true, reason: "Pausado" });
    }

    const initialIntent = isComprobante ? 'comprobante' : classifyIntent(messageText, typeMessage);

    // ── ANTIFRAUDE PARA RECARGAS (Early) ──
    if (initialIntent === 'recarga') {
      const cleanPhone = sender.replace("@c.us", "");
      const { data: scammerData } = await supabase.from("scammers").select("id")
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.0${cleanPhone.slice(-10)},phone_number.eq.593${cleanPhone.slice(-10)}`)
        .limit(1);
      if (scammerData && scammerData.length > 0) {
        await send("Lo sentimos, no podemos procesar su solicitud. Comuníquese directamente con un asesor humano.");
        return NextResponse.json({ success: true, action: "scammer_rejected" });
      }
    }

    // ── INDICADOR DE ESCRITURA INMEDIATO ──
    fetch(`${waBaseUrl}/waInstance${providerConfig.idInstance}/sendAction/${providerConfig.apiTokenInstance}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: sender, action: "typing" }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => { });

    // ── GUARDAR MENSAJE EN BASE DE DATOS ──
    const { data: insertedChat, error: chatErr } = await supabase
      .from("whatsapp_chats")
      .insert({ owner_id: uid, phone_number: sender, role: "user", content: messageText })
      .select("id").single();
    if (chatErr) throw chatErr;
    const insertedId = insertedChat.id;

    // ── BUFFER DINÁMICO (Debounce) ──
    const isShortMessage = messageText.length < 15;
    const isGreeting = initialIntent === 'greeting';
    // Esperamos 8000ms si es corto o saludo puro. Si aporta más info, 2500ms.
    const dynamicBufferMs = (isGreeting || isShortMessage) ? 8000 : 2500;
    await new Promise(r => setTimeout(r, dynamicBufferMs));

    const { data: latestMsg } = await supabase
      .from("whatsapp_chats")
      .select("id")
      .eq("owner_id", uid).eq("phone_number", sender).eq("role", "user")
      .order("created_at", { ascending: false }).limit(1).single();

    if (latestMsg && latestMsg.id !== insertedId) {
      console.log(`[WEBHOOK] ⏱️ Hilo abortado: llegaron más mensajes en la ventana de ${dynamicBufferMs}ms.`);
      return NextResponse.json({ success: true, ignored: true, reason: "Consolidado" });
    }

    // ==============================================================
    // A PARTIR DE AQUÍ SOLO LLEGA 1 HILO (El último de la ráfaga)
    // ==============================================================

    // ── HISTORIAL DE CONVERSACIÓN (Extracción Lote) ──
    const { data: pastMessages } = await supabase
      .from("whatsapp_chats")
      .select("role, content")
      .eq("owner_id", uid).eq("phone_number", sender)
      .order("created_at", { ascending: true }) // Creciente para unificar bien
      .limit(40);

    const rawHistory = pastMessages || [];

    // ── UNIFICADOR DE CASCADA ──
    const unifiedHistory: { role: string, content: string }[] = [];
    for (const msg of rawHistory) {
      if (msg.role === "agent") continue;

      const roleStr = msg.role === "model" ? "assistant" : "user";
      if (unifiedHistory.length > 0 && unifiedHistory[unifiedHistory.length - 1].role === roleStr) {
        // Sumar al globo anterior
        unifiedHistory[unifiedHistory.length - 1].content += `\n${msg.content}`;
      } else {
        unifiedHistory.push({ role: roleStr, content: msg.content });
      }
    }

    const finalUserMessage = unifiedHistory.length > 0 && unifiedHistory[unifiedHistory.length - 1].role === "user"
      ? unifiedHistory[unifiedHistory.length - 1].content
      : messageText;

    console.log(`[WEBHOOK] 📨 ${senderName} | "Resumen: ${finalUserMessage.substring(0, 60)}"`);

    // ── SISTEMA DE RESPUESTA BASADO ÍNTEGRAMENTE EN IA (Prompt Dinámico) ──
    const systemPrompt = `Eres un agente de atención al cliente empático, inteligente y con alta fluidez humana resolviendo dudas y dando soporte a usuarios directamente a través de WhatsApp.
Reglas INQUEBRANTABLES:
1. RESPONDE DE MANERA CONVERSACIONAL Y CERCANA. ¡PROHIBIDO ESCRIBIR COMO UN MENÚ NUMERADO RIGIDO! Comunícate como una persona fluida y lista, no como un sistema automatizado o cajero de banco.
2. NUNCA EXPLIQUES tus acciones internas ni te presentes, no uses firmas en cada mensaje y sé breve.
3. Eres un ASESOR VIRTUAL con carisma y de carne y hueso a los ojos del cliente. NO uses palabras como "bot", "IA", "asistente de Inteligencia artificial", ni que estás ejecutando herramientas de sistema.
4. ANTES DE RESPONDER, REVISA LO QUE EL CLIENTE YA HABÍA DICHO. Si en algún mensaje anterior él ya te confesó que iba a cargar '50 dólares' o ya escogió el banco 'Pichincha', por favor NO LE VUELVAS a preguntar monto y banco de nuevo como un sistema fallido de disco rayado. ¡Usa esa información adquirida orgánicamente!
5. DEBES ADAPTARTE Y PREVER: Si te equivocas seguido, o el cliente se desespera o te exige alguien superior, no titubees en ejecutar pacíficamente "escalar_a_humano" para salvaguardarle la buena experiencia.
6. LOS SALUDOS DEBEN SER AMIGABLES. Si su mensaje inicial es algo como "Hola", "Buenas", "Que tal", contesta solo un saludo natural y cálido en menos de dos líneas: "¿Hola, qué tal? ¿En qué te puedo asesorar el día de hoy?". Toma esta configuración si existe: "${greetingMenu || '¿En qué te ayudo?'}". Jamás recites inmediatamente tus listados de cosas como retiro y depósito salvo que te lo pregunten.
7. ESCALACIÓN ORGÁNICA E INVISIBLE: Si recurres a usar tu capacidad técnica real de "escalar_a_humano", diles con mucha sutileza antes de frenar tu actividad: "Claro, aguárdame un instante y enseguida contacto con uno de mis compañeros para que venga a ayudarte."
8. RESTRICCIONES DE ARCHIVOS: Si llega un "[NOTA_DE_VOZ_RECIBIDA]", responde sueltamente "Ups, no me envíes audios en este momento por favor, escríbeme lo que necesitas 🙏".
9. PRECISIÓN INTACTA: IDs largos que te pasen o cuentas de cliente se repiten con alta fidelidad y sin inventar.

====== CONTEXTO Y FLUJOS VITALES A SEGUIR ==================
* RECARGAS / DEPÓSITOS: Si notas por contexto que desea realizar una RECARGA, tus pasos naturales son: "${rechargeSteps || "1. Averiguar monto con tacto. 2. Guiar a elegir banco. 3. Brindarle el número de cuenta de ese banco preferido. 4. Exigir la foto del comprobante."}"
  -- Estos bancos existen acá: ${banksInfo || "Debes comunicarle que solicite esta info a un compañero tuyo."}
  -- ALERTA OBLIGATORIA: Tan pronto consolides y averigües con éxito el "Monto numérico" y un "Banco", en tu próxima interacción EJECUTA LA HERRAMIENTA 'registrar_recarga' SIN LUGAR A DUDAS para el registro administrativo y alíentalo a enviarte su foto comprobante.
  -- GESTIÓN DE COMPROBANTES: Si el último texto o mensaje en la plática actual dice textualmente "[COMPROBANTE_ENVIADO]", tú lo agradeces calmadamente "De lujo, acuso recibo de tu comprobante, ya se valida pronto"; e inmediatamente ejecutas tu herramienta 'etiquetar_contacto' con valor "recarga_pendiente".

* RETIROS: Si requieren cobrar o retirar plata, aplícalo orgánico: "${withdrawSteps || "1. Averigua la cantidad a extraer y su Nro de cuenta."}"
  -- Todo retiro depende de soporte en persona, así que la herramienta 'escalar_a_humano' será vital usarla luego de reunirle los datos a tu colega.

====== IDENTIDAD DE ASESOR Y BASE DE AYUDAS ======
${aiPersona || "Ponte la camiseta de tu plataforma financiera e interactúa empático, dando la mejor atención, seguro."}
${knowledgeBase || ""}

Dato adicional para tratarlo con cortesía: 
Identificador de contacto del cliente: ${senderName}`;

    // ── GENERACIÓN CON OPENAI (ChatGPT) + FUNCTION CALLING ──
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: "No OpenAI Key" }, { status: 500 });

    const openai = new OpenAI({ apiKey: openaiKey });

    // Construir mensajes para OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Extraer todos excepto el último (que es el usuario actual unificado)
    const historyWithoutLastUser = unifiedHistory.slice(0, -1);
    for (const msg of historyWithoutLastUser) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    // Agregar el mensaje actual del usuario
    messages.push({ role: "user", content: finalUserMessage });

    let aiResponse = "";
    try {
      let completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: BOT_TOOLS,
        tool_choice: "auto",
        max_tokens: 300,
        temperature: 0.3,
      });

      // ── MANEJAR FUNCTION CALLS (tool_calls, máx 3 rondas) ──
      for (let round = 0; round < 3; round++) {
        const choice = completion.choices[0];

        if (choice.finish_reason === "tool_calls" || choice.message.tool_calls?.length) {
          const toolCalls = choice.message.tool_calls || [];

          // Agregar el mensaje del asistente con los tool_calls al historial
          messages.push(choice.message);

          // Ejecutar cada tool call
          for (const toolCall of toolCalls) {
            // Solo procesamos function tool calls (no custom)
            if (toolCall.type !== 'function') continue;
            const fnName = toolCall.function.name;
            let fnArgs: Record<string, any> = {};
            try {
              fnArgs = JSON.parse(toolCall.function.arguments);
            } catch {
              fnArgs = {};
            }

            console.log(`[WEBHOOK] 🔧 Tool call: ${fnName}`, fnArgs);

            const toolResult = await executeTool(fnName, fnArgs, {
              uid, sender, senderName, adminEmail, waBaseUrl,
              idInstance: providerConfig.idInstance, apiToken: providerConfig.apiTokenInstance,
            });

            // Agregar la respuesta de la herramienta al historial
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }

          // Pedir respuesta final al modelo con los resultados de las herramientas
          completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            tools: BOT_TOOLS,
            tool_choice: "auto",
            max_tokens: 300,
            temperature: 0.3,
          });
        } else {
          // Ya es texto final — salir del loop
          break;
        }
      }

      const finishReason = completion.choices[0]?.finish_reason;
      if (finishReason === "content_filter") {
        aiResponse = "No puedo responder esa consulta. Por favor contáctate con un asesor.";
      } else {
        aiResponse = completion.choices[0]?.message?.content?.trim() || "";
      }
    } catch (err: any) {
      console.error("[WEBHOOK] Error OpenAI:", err.message);
      aiResponse = "¡Hola! ¿Necesitas ayuda con recargas o retiros en este momento?";
    }

    if (!aiResponse) aiResponse = "¡Hola! ¿Dime cómo puedo asesorarte hoy?";

    // Sin pos-proceso errático, se envía puramente la inteligencia natural
    await send(aiResponse);

    // ── GUARDAR RESPUESTA DEL BOT ──
    await supabase.from("whatsapp_chats").insert({ owner_id: uid, phone_number: sender, role: "model", content: aiResponse });

    console.log("[WEBHOOK] ✅ Completado (OpenAI).");
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[WEBHOOK] ❌ ERROR CRÍTICO:", error.message || String(error));
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", version: "v4_openai" });
}
