import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI, FunctionCallingMode, SchemaType } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

const geminiKey = process.env.GEMINI_API_KEY;
const PAUSE_HUMAN_MINUTES = 10;    // Auto-pausa por intervención del agente humano
const ESCALATION_PAUSE_MIN = 30;   // Pausa cuando el bot escala a humano
const BUFFER_DELAY_MS = 3500;      // Espera para unificar mensajes rápidos consecutivos

// =====================================================
// TIPOS DE INTENCIÓN
// =====================================================
type Intent = 'greeting' | 'recarga' | 'retiro' | 'comprobante' | 'queja' | 'button_reply' | 'consulta';

function classifyIntent(text: string, typeMessage: string): Intent {
  // Respuesta a botón interactivo de WhatsApp
  if (typeMessage === 'buttonsResponseMessage') return 'button_reply';
  // Imagen / documento / video → comprobante
  if (['imageMessage', 'documentMessage', 'videoMessage', 'audioMessage'].includes(typeMessage)) return 'comprobante';

  const lower = text.toLowerCase().trim();
  const is = (words: string[]) => words.some(w => lower.includes(w));

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
            buttons: chunk.map((text, idx) => ({ buttonId: String(idx + 1), buttonText: { displayText: text } })),
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
// HERRAMIENTAS GEMINI (FUNCTION CALLING)
// =====================================================
const BOT_TOOLS: any[] = [{
  functionDeclarations: [
    {
      name: "registrar_recarga",
      description: "Registra una solicitud de recarga del cliente en el sistema. Llama a esta herramienta SOLO cuando el cliente haya confirmado el monto Y el banco. No inventes datos.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          monto: { type: SchemaType.NUMBER, description: "Monto en USD que el cliente quiere recargar" },
          banco: { type: SchemaType.STRING, description: "Nombre del banco que el cliente eligió" },
        },
        required: ["monto", "banco"],
      },
    },
    {
      name: "etiquetar_contacto",
      description: "Etiqueta al contacto para organización interna. Úsala cuando quede claro el estado del cliente.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          tag: { type: SchemaType.STRING, description: "Etiqueta: 'lead', 'vip', 'recarga_pendiente', 'retiro_pendiente', 'escalado'" },
        },
        required: ["tag"],
      },
    },
    {
      name: "escalar_a_humano",
      description: "Transfiere la conversación a un agente humano cuando el bot no puede resolver el problema, o cuando el cliente pide hablar con una persona. Después de escalar, avisa al cliente.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          motivo: { type: SchemaType.STRING, description: "Razón breve de la escalación para el registro interno" },
        },
        required: ["motivo"],
      },
    },
  ],
}];

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
    console.log(`[TOOL] 🚨 Escalado a humano: ${motivo}`);
    return `Cliente escalado a agente humano. El bot se pausará para este chat por ${ESCALATION_PAUSE_MIN} minutos.`;
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
    } else if (['imageMessage', 'documentMessage', 'videoMessage', 'audioMessage'].includes(typeMessage)) {
      isComprobante = true;
      messageText = "[COMPROBANTE_ENVIADO]";
    } else {
      messageText = "[ARCHIVO_DESCONOCIDO]";
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

    // ── CLASIFICAR INTENCIÓN ──
    const intent: Intent = isComprobante ? 'comprobante' : classifyIntent(messageText, typeMessage);
    console.log(`[WEBHOOK] 📨 ${senderName} → intención: ${intent} | "${messageText.substring(0, 60)}"`);

    // ── GUARDAR MENSAJE EN HISTORIAL ──
    const { data: insertedChat, error: chatErr } = await supabase
      .from("whatsapp_chats")
      .insert({ owner_id: uid, phone_number: sender, role: "user", content: messageText })
      .select("id").single();
    if (chatErr) throw chatErr;
    const insertedId = insertedChat.id;

    // ── BUFFER: esperar para unificar mensajes rápidos ──
    await new Promise(r => setTimeout(r, BUFFER_DELAY_MS));

    const { data: latestMsg } = await supabase
      .from("whatsapp_chats")
      .select("id")
      .eq("owner_id", uid).eq("phone_number", sender).eq("role", "user")
      .order("created_at", { ascending: false }).limit(1).single();

    if (latestMsg && latestMsg.id !== insertedId) {
      console.log("[WEBHOOK] ⏱️ Buffer: otro mensaje llegó después. Abortando este hilo.");
      return NextResponse.json({ success: true, ignored: true, reason: "Consolidado" });
    }

    // ── CARGAR CONFIGURACIÓN DEL AGENTE DESDE CLERK ──
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

    // ── VERIFICAR PAUSA ──
    const { data: pauses } = await supabase
      .from("whatsapp_pauses")
      .select("paused_until, phone_number")
      .eq("owner_id", uid)
      .in("phone_number", ["GLOBAL", sender]);

    if (pauses?.some(p => new Date(p.paused_until) > new Date())) {
      console.log(`[WEBHOOK] 🛑 En pausa para ${sender}`);
      return NextResponse.json({ success: true, ignored: true, reason: "Pausado" });
    }

    // ── ANTIFRAUDE PARA RECARGAS ──
    if (intent === 'recarga') {
      const cleanPhone = sender.replace("@c.us", "");
      const { data: scammerData } = await supabase.from("scammers").select("id")
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.0${cleanPhone.slice(-10)},phone_number.eq.593${cleanPhone.slice(-10)}`)
        .limit(1);
      if (scammerData && scammerData.length > 0) {
        await send("Lo sentimos, no podemos procesar su solicitud. Comuníquese directamente con un asesor humano.");
        return NextResponse.json({ success: true, action: "scammer_rejected" });
      }
    }

    // ── INDICADOR DE ESCRITURA ──
    fetch(`${waBaseUrl}/waInstance${providerConfig.idInstance}/sendAction/${providerConfig.apiTokenInstance}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: sender, action: "typing" }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});

    // ── RESPUESTA DIRECTA SIN IA PARA SALUDO (BOTONES) ──
    if (intent === 'greeting') {
      const customMenu = greetingMenu || "¿En qué te puedo ayudar hoy? 👇";
      await sendButtons(customMenu, ["💰 Recargar", "📤 Retirar", "❓ Consulta", "🆘 Soporte"]);
      // Guardar respuesta en BD como modelo
      await supabase.from("whatsapp_chats").insert({ owner_id: uid, phone_number: sender, role: "model", content: customMenu });
      return NextResponse.json({ success: true, action: "greeting_with_buttons" });
    }

    // ── PROMPT CONTEXTUAL POR INTENCIÓN ──
    let intentContext = "";
    if (intent === 'recarga') {
      intentContext = `\n\n[CONTEXTO OPERACIÓN: El cliente quiere hacer una RECARGA]\nPasos del proceso de recarga que debes seguir:
${rechargeSteps || "1. Pregunta el monto. 2. Muestra los bancos disponibles con botones. 3. Da los datos de la cuenta del banco elegido. 4. Pide el comprobante."}
BANCOS DISPONIBLES (para ofrecer con botones):
${banksInfo || "No hay bancos configurados. Indica al cliente que se comunique con soporte."}
IMPORTANTE: Si ya sabes el monto Y el banco, usa la herramienta 'registrar_recarga'. Luego pide el comprobante.`;
    } else if (intent === 'retiro') {
      intentContext = `\n\n[CONTEXTO OPERACIÓN: El cliente quiere hacer un RETIRO]
${withdrawSteps || "1. Pide el monto que desea retirar. 2. Pide su número de cuenta y banco. 3. Escala a humano para procesar el retiro, ya que requiere aprobación manual."}
Los retiros requieren verificación humana. Usa 'escalar_a_humano' cuando tengas todos los datos.`;
    } else if (intent === 'comprobante') {
      intentContext = `\n\n[CONTEXTO: El cliente acaba de ENVIAR UN COMPROBANTE DE PAGO]
Confirma la recepción de forma corta y cordial. Indícale que procesarán en breve. Usa 'etiquetar_contacto' con tag 'recarga_pendiente'.`;
    } else if (intent === 'queja') {
      intentContext = `\n\n[CONTEXTO: El cliente tiene un PROBLEMA O QUEJA]
Sé empático y breve. Si no puedes resolverlo directamente, usa 'escalar_a_humano' indicando el motivo.`;
    } else if (intent === 'button_reply') {
      intentContext = `\n\n[CONTEXTO: El cliente respondió un botón del menú: "${messageText}"]
Interpreta su elección y actúa de inmediato según la opción elegida.`;
    }

    const systemPrompt = `Eres un asistente de WhatsApp para esta empresa. Reglas INQUEBRANTABLES:
1. RESPONDE DIRECTO AL GRANO. Máximo 3-4 líneas.
2. NUNCA expliques lo que estás haciendo ni te presentes en cada mensaje.
3. NO uses firmas ni despedidas formales.
4. USA emojis con moderación, solo cuando añaden valor.
5. Si te piden una operación, actúa con las herramientas disponibles sin pedir confirmación innecesaria.
6. Cuando ofrezcas opciones de bancos o tipos de operación, los botones ya se envían por separado — NO los listes en texto.

IDENTIDAD Y PERSONALIDAD:
${aiPersona || "Asistente amigable y profesional."}

BASE DE CONOCIMIENTO:
${knowledgeBase || "Empresa de servicios financieros."}
${intentContext}

Nombre del cliente: ${senderName}`;

    // ── HISTORIAL DE CONVERSACIÓN ──
    const { data: pastMessages } = await supabase
      .from("whatsapp_chats")
      .select("role, content")
      .eq("owner_id", uid).eq("phone_number", sender)
      .order("created_at", { ascending: false })
      .limit(10);

    const history = (pastMessages || []).reverse();

    // ── GENERACIÓN CON GEMINI + FUNCTION CALLING ──
    if (!geminiKey) return NextResponse.json({ error: "No Gemini Key" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      tools: BOT_TOOLS,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
      generationConfig: { maxOutputTokens: 280, temperature: 0.3 },
    });

    // Construir contenidos de la conversación para Gemini
    const contents: any[] = [];
    for (const msg of history.slice(0, -1)) { // Todo menos el último (el actual)
      if (msg.role === "agent") continue;
      contents.push({ role: msg.role === "model" ? "model" : "user", parts: [{ text: msg.content }] });
    }
    // Último mensaje del usuario (el actual)
    contents.push({ role: "user", parts: [{ text: messageText }] });

    let aiResponse = "";
    try {
      const chat = model.startChat({ history: contents.slice(0, -1) });
      let result = await chat.sendMessage(messageText);

      // ── MANEJAR FUNCTION CALLS (máx 2 rondas) ──
      for (let round = 0; round < 2; round++) {
        const candidate = result.response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part?.functionCall) {
          const { name, args } = part.functionCall;
          console.log(`[WEBHOOK] 🔧 Tool call: ${name}`, args);

          const toolResult = await executeTool(name, args as Record<string, any>, {
            uid, sender, senderName, adminEmail, waBaseUrl,
            idInstance: providerConfig.idInstance, apiToken: providerConfig.apiTokenInstance,
          });

          // Enviar resultado al modelo y pedir respuesta final
          result = await chat.sendMessage([{
            functionResponse: { name, response: { result: toolResult } }
          }]);

          // Si fue escalar_a_humano, podemos querer enviar también botones específicos
        } else {
          // Ya es texto — salir del loop
          break;
        }
      }

      const finishReason = result.response.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY" || finishReason === "OTHER") {
        aiResponse = "No puedo responder esa consulta. Por favor contáctate con un asesor.";
      } else {
        aiResponse = result.response.text()?.trim() || "";
      }
    } catch (err: any) {
      console.error("[WEBHOOK] Error Gemini:", err.message);
      aiResponse = "Tenemos dificultades técnicas. Por favor intenta de nuevo en un momento.";
    }

    if (!aiResponse) aiResponse = "🤖 No pude procesar tu mensaje. Inténtalo de nuevo.";

    // ── POST-PROCESO PARA ENVÍO CON BOTONES (si la IA menciona bancos) ──
    let sentWithButtons = false;
    if (intent === 'recarga' && banksInfo) {
      // Extraer lista de bancos de banksInfo para ofrecerlos como botones
      const bankLines = (banksInfo as string).split('\n').filter((l: string) => l.trim());
      const bankNames = bankLines.map((line: string) => line.split(':')[0].trim()).filter(Boolean).slice(0, 6); // máx 6
      if (bankNames.length > 0 && aiResponse.toLowerCase().includes('banco') || aiResponse.toLowerCase().includes('cual banco') || aiResponse.toLowerCase().includes('qué banco')) {
        await send(aiResponse);
        await sendButtons("¿Qué banco usarás?", bankNames);
        sentWithButtons = true;
      }
    }

    if (!sentWithButtons) {
      await send(aiResponse);
    }

    // ── GUARDAR RESPUESTA DEL BOT ──
    await supabase.from("whatsapp_chats").insert({ owner_id: uid, phone_number: sender, role: "model", content: aiResponse });

    console.log("[WEBHOOK] ✅ Completado.");
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[WEBHOOK] ❌ ERROR CRÍTICO:", error.message || String(error));
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", version: "v3_function_calling" });
}
