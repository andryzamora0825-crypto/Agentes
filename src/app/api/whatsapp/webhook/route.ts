import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const geminiKey = process.env.GEMINI_API_KEY;
const PAUSE_MINUTES = 10; // Minutos que el bot se pausa cuando el agente humano responde

export async function POST(request: Request) {
  console.log("[WEBHOOK] ========== NUEVA PETICIÓN ==========");
  
  try {
    // 1. Obtener UID del query param
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    console.log("[WEBHOOK] uid:", uid);

    if (!uid) {
      console.log("[WEBHOOK] ERROR: Missing uid");
      return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });
    }

    // 2. Extraer el Payload del Webhook (Green-API format)
    const payload = await request.json();
    const webhookType = payload.typeWebhook;
    console.log("[WEBHOOK] typeWebhook:", webhookType);

    // =====================================================
    // DETECCIÓN DE MENSAJE SALIENTE (El agente humano habló)
    // =====================================================
    if (webhookType === "outgoingMessage" || webhookType === "outgoingMessageReceived") {
      // Para mensajes salientes, el chatId es el DESTINATARIO (hacia quien se envió)
      // Green-API lo manda en diferentes campos según la versión:
      const recipient = 
        payload.senderData?.chatId ||
        payload.chatId ||
        payload.messageData?.chatId ||
        null;

      // Obtener el texto del mensaje para analizar si es un comando (#bot, #pausa)
      const typeMessage = payload.messageData?.typeMessage;
      let humanMsg = "";
      if (typeMessage === "textMessage") {
          humanMsg = payload.messageData?.textMessageData?.textMessage || "";
      } else if (typeMessage === "extendedTextMessage") {
          humanMsg = payload.messageData?.extendedTextMessageData?.text || "";
      }

      const lowerHumanMsg = humanMsg.trim().toLowerCase();
      console.log(`[WEBHOOK] Mensaje SALIENTE detectado. Recipient: ${recipient}, Texto: "${humanMsg.substring(0,50)}"`);

      // Ignorar si el destinatario es un grupo o no hay recipient
      if (!recipient || recipient.includes("@g.us")) {
        return NextResponse.json({ success: true, action: "outgoing_ignored_group" });
      }

      if (lowerHumanMsg === '#bot') {
          await supabase.from('whatsapp_pauses').delete().eq('owner_id', uid).eq('phone_number', recipient);
          console.log(`[WEBHOOK] 🤖 Bot REACTIVADO manualmente para ${recipient}`);
          return NextResponse.json({ success: true, action: "bot_reactivated" });
      }

      let pauseMinutes = PAUSE_MINUTES;
      if (lowerHumanMsg === '#pausa') {
          pauseMinutes = PAUSE_MINUTES;
      }

      const pauseUntil = new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();
      
      const { data: existingPause } = await supabase
        .from('whatsapp_pauses')
        .select('id')
        .eq('owner_id', uid)
        .eq('phone_number', recipient)
        .maybeSingle();

      if (existingPause) {
        await supabase.from('whatsapp_pauses').update({ paused_until: pauseUntil }).eq('id', existingPause.id);
      } else {
        await supabase.from('whatsapp_pauses').insert({ owner_id: uid, phone_number: recipient, paused_until: pauseUntil });
      }
      
      console.log(`[WEBHOOK] 🛑 Bot PAUSADO para ${recipient} por ${pauseMinutes} minutos.`);

      // Registrar la intervención humana en el historial
      const contentToSave = humanMsg || "[Intervención de Agente Humano]";
      await supabase.from('whatsapp_chats').insert({
        owner_id: uid, 
        phone_number: recipient, 
        role: 'agent', 
        content: contentToSave
      });

      return NextResponse.json({ success: true, action: "pause_registered" });
    }

    // IGNORAR mensajes enviados por la API (el propio bot respondiendo)
    if (webhookType === "outgoingAPIMessageReceived") {
        console.log("[WEBHOOK] Ignorado - Mensaje enviado por la API (Bot).");
        return NextResponse.json({ success: true, ignored: true, reason: "Mensaje propio del bot" });
    }

    // =====================================================
    // SOLO PROCESAMOS MENSAJES ENTRANTES
    // =====================================================
    if (webhookType !== "incomingMessageReceived") {
      console.log("[WEBHOOK] Ignorado - no es incomingMessageReceived");
      return NextResponse.json({ success: true, ignored: true });
    }

    // Extraer datos clave
    const sender = payload.senderData?.sender;
    const senderName = payload.senderData?.senderName || "Cliente";
    
    // Ignorar mensajes propios o de grupos
    if (sender === payload.instanceData?.wid || sender?.includes("@g.us")) {
      console.log("[WEBHOOK] Ignorado - mensaje propio o grupo");
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje propio o grupo" });
    }

    // Obtener texto
    const typeMessage = payload.messageData?.typeMessage;
    let messageText = "";

    if (typeMessage === "textMessage") {
      messageText = payload.messageData?.textMessageData?.textMessage;
    } else if (typeMessage === "extendedTextMessage") {
      messageText = payload.messageData?.extendedTextMessageData?.text;
    } else {
      console.log("[WEBHOOK] Ignorado - tipo de mensaje no soportado:", typeMessage);
      return NextResponse.json({ success: true, ignored: true, reason: "No es un mensaje de texto" });
    }

    if (!messageText) {
      console.log("[WEBHOOK] Ignorado - mensaje vacío");
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje vacío" });
    }

    console.log("[WEBHOOK] Mensaje recibido de", senderName, ":", messageText.substring(0, 100));

    // =====================================================
    // IGNORAR MENSAJES VIEJOS / RETENIDOS (más de 2 min)
    // =====================================================
    const msgTimestamp = payload.messageData?.timestamp || payload.timestamp;
    if (msgTimestamp) {
      const msgAge = Date.now() / 1000 - msgTimestamp;
      if (msgAge > 30) { // Más de 30 segundos de antigüedad
        console.log(`[WEBHOOK] ⏭️ Mensaje IGNORADO por antiguo (${Math.round(msgAge)}s de edad)`);
        return NextResponse.json({ success: true, ignored: true, reason: "Mensaje retenido/viejo ignorado" });
      }
    }

    // =====================================================
    // COMANDOS ESPECIALES DEL AGENTE (desde el propio WhatsApp)
    // =====================================================
    const lowerMsg = messageText.trim().toLowerCase();
    
    // #pausa → Pausar bot 1 hora para todos los clientes de este agente
    // #bot → Reactivar bot (borrar pausa para este número)
    // Nota: estos comandos los enviaría el cliente, pero realmente
    // el agente los usa desde su propio teléfono vía outgoing.
    // Sin embargo, si el agente quiere pausar DESDE el chat,
    // estos comandos se pueden activar también.

    // 3. Buscar la configuración del usuario en Clerk
    console.log("[WEBHOOK] Buscando usuario en Clerk con uid:", uid);
    const client = await clerkClient();
    const user = await client.users.getUser(uid);
    
    if (!user) {
      console.log("[WEBHOOK] ERROR: Usuario no encontrado en Clerk");
      throw new Error("Usuario no encontrado");
    }
    console.log("[WEBHOOK] Usuario encontrado:", user.primaryEmailAddress?.emailAddress);

    const settings = user.publicMetadata?.whatsappSettings as any;
    
    if (!settings || !settings.isActive) {
      console.log("[WEBHOOK] Ignorado - El Agente IA está apagado o no configurado");
      return NextResponse.json({ success: true, ignored: true, reason: "El Agente IA está apagado o no configurado" });
    }

    // Extraer Configuración
    const { providerConfig, aiPersona, knowledgeBase } = settings;
    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      console.log("[WEBHOOK] ERROR: API de telefonía no configurada");
      return NextResponse.json({ success: true, ignored: true, reason: "API de telefonía no configurada" });
    }

    // =====================================================
    // VERIFICAR SI EL BOT ESTÁ PAUSADO PARA ESTE NÚMERO
    // =====================================================
    // Medida 1: Usar maybeSingle() para evitar caídas si no hay registros
    const { data: pauseData } = await supabase
      .from('whatsapp_pauses')
      .select('paused_until')
      .eq('owner_id', uid)
      .eq('phone_number', sender)
      .maybeSingle();

    if (pauseData?.paused_until) {
      const pausedUntil = new Date(pauseData.paused_until);
      if (pausedUntil > new Date()) {
        const minutesLeft = Math.ceil((pausedUntil.getTime() - Date.now()) / 60000);
        console.log(`[WEBHOOK] 🛑 Bot PAUSADO para ${sender} — quedan ${minutesLeft} min. El agente humano está atendiendo.`);
        return NextResponse.json({ 
          success: true, 
          ignored: true, 
          reason: `Bot pausado por agente humano. Reanuda en ${minutesLeft} min.` 
        });
      }
    }

    // Medida 2: Redundancia - Verificar el historial reciente en whatsapp_chats
    const tenMinutesAgo = new Date(Date.now() - PAUSE_MINUTES * 60 * 1000).toISOString();
    const { data: recentAgentMessage } = await supabase
      .from('whatsapp_chats')
      .select('created_at')
      .eq('owner_id', uid)
      .eq('phone_number', sender)
      .eq('role', 'agent')
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentAgentMessage) {
       console.log(`[WEBHOOK] 🛑 Bot PAUSADO por medida redundante (Historial reciente del agente).`);
       return NextResponse.json({ 
          success: true, 
          ignored: true, 
          reason: `Bot pausado por intervención reciente en historial.` 
       });
    }

    // =====================================================
    // DEBOUNCE: Guardar mensaje AHORA, esperar rafága
    // =====================================================
    // Guardar el mensaje del usuario en la BD ANTES de esperar,
    // así todos los mensajes de la rafága quedan registrados.
    const { data: savedMsg } = await supabase
      .from('whatsapp_chats')
      .insert({ owner_id: uid, phone_number: sender, role: 'user', content: messageText })
      .select('created_at')
      .single();

    const thisMsgTime = savedMsg?.created_at || new Date().toISOString();

    // Esperar 4 segundos (debounce)
    console.log(`[WEBHOOK] ⏳ Debounce: esperando 4s para ver si hay más mensajes en rafága...`);
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Verificar si llegó un mensaje MÁS NUEVO de este mismo remitente
    const { data: newerMessages } = await supabase
      .from('whatsapp_chats')
      .select('id')
      .eq('owner_id', uid)
      .eq('phone_number', sender)
      .eq('role', 'user')
      .gt('created_at', thisMsgTime)
      .limit(1);

    if (newerMessages && newerMessages.length > 0) {
      console.log(`[WEBHOOK] ⏭️ Debounce: hay un mensaje más nuevo. Este handler se omite.`);
      return NextResponse.json({ success: true, ignored: true, reason: "Debounce - rafága de mensajes" });
    }

    console.log(`[WEBHOOK] ✅ Debounce: este es el último mensaje. Generando respuesta...`);

    // =====================================================
    // DETECCIÓN DE RECARGAS + CRUCE CON ESTAFADORES
    // =====================================================
    const rechargeKeywords = ['recarga', 'recargar', 'deposito', 'depositar', 'cargar', 'carga'];
    const lowerMessage = messageText.toLowerCase();
    const isRechargeRequest = rechargeKeywords.some(kw => lowerMessage.includes(kw));
    
    // Extraer monto si existe (busca patrones como $15, 15 usd, 15 dólares, 15 dolares, etc.)
    const amountMatch = messageText.match(/\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:usd|USD|dolar|dólares|dolares)?/);
    const detectedAmount = amountMatch ? parseFloat(amountMatch[1]) : null;

    if (isRechargeRequest) {
      // Cruzar número con base de datos de estafadores
      const cleanPhone = sender.replace('@c.us', '');
      const { data: scammerData } = await supabase
        .from('scammers')
        .select('id, name')
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.0${cleanPhone.slice(-10)},phone_number.eq.593${cleanPhone.slice(-10)}`)
        .limit(1);

      const isScammer = scammerData && scammerData.length > 0;

      if (isScammer) {
        console.log(`[WEBHOOK] 🚨 ESTAFADOR DETECTADO: ${sender} intentó recargar`);
        
        // Registrar intento de recarga como rechazado
        await supabase.from('whatsapp_recargas').insert({
          owner_id: uid,
          phone_number: sender,
          client_name: senderName,
          amount: detectedAmount,
          status: 'rejected',
          is_scammer: true
        });

        // Enviar mensaje de rechazo
        const rejectMsg = "Lo sentimos, no podemos procesar su solicitud en este momento. Para más información, comuníquese directamente con soporte.";
        const cleanUrl = providerConfig.apiUrl.replace(/\/$/, "");
        const sendEndpoint = `${cleanUrl}/waInstance${providerConfig.idInstance}/sendMessage/${providerConfig.apiTokenInstance}`;
        
        await fetch(sendEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: sender, message: rejectMsg })
        });

        return NextResponse.json({ success: true, action: "scammer_rejected" });
      }

      // No es estafador → registrar recarga como pendiente
      await supabase.from('whatsapp_recargas').insert({
        owner_id: uid,
        phone_number: sender,
        client_name: senderName,
        amount: detectedAmount,
        status: 'pending',
        is_scammer: false
      });
      console.log(`[WEBHOOK] 💰 Recarga pendiente registrada: ${senderName} - $${detectedAmount || '?'}`);
    }

    // =====================================================
    // 4. PROCESAR RESPUESTA CON GEMINI IA
    // =====================================================
    console.log("[WEBHOOK] Generando respuesta con Gemini...");
    
    if (!geminiKey) {
      console.error("[WEBHOOK] ERROR FATAL: GEMINI_API_KEY no está configurada");
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7
      }
    });

    const systemPrompt = `
Eres un asistente de Inteligencia Artificial respondiendo a clientes vía WhatsApp.
Tus instrucciones de comportamiento e identidad son:
${aiPersona}

A continuación tienes tu Base de Conocimiento (reglas, enlaces útiles, precios, políticas), usa SOLO esta información si se te pregunta algo relacionado. Si te preguntan algo fuera de este conocimiento, deriva amablemente a soporte humano.
BASE DE CONOCIMIENTO:
${knowledgeBase}

El usuario que te escribe se llama: ${senderName}.
Usa formato compatible con WhatsApp (puedes usar *negrita* o _cursiva_).
No seas excesivamente robótico, mantén el tono de comportamiento indicado.
`;

    // A. Recuperar el historial reciente de este teléfono (Máximo últimos 10 mensajes)
    const { data: pastMessages, error: historyError } = await supabase
      .from('whatsapp_chats')
      .select('role, content')
      .eq('owner_id', uid)
      .eq('phone_number', sender)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (historyError) {
      console.error("[WEBHOOK] Error obteniendo historial:", historyError.message);
    }
    
    // Invertimos el array porque vienen ordenados descendentemente por fecha
    const chronologicalHistory = (pastMessages || []).reverse();

    // B. Construir el historial compatible con Gemini
    const chatHistory = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Responderé basado en las reglas anteriores y el conocimiento limitado." }]}
    ];

    for (const msg of chronologicalHistory) {
      chatHistory.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    const chat = model.startChat({ history: chatHistory });

    const result = await chat.sendMessage(messageText);
    const aiResponse = result.response.text();
    console.log("[WEBHOOK] Respuesta IA generada:", aiResponse.substring(0, 150));

    // C. Guardar SOLO la respuesta del modelo (el mensaje del usuario ya fue guardado antes del debounce)
    const { error: insertError } = await supabase.from('whatsapp_chats').insert([
      { owner_id: uid, phone_number: sender, role: 'model', content: aiResponse }
    ]);
    
    if (insertError) {
      console.error("[WEBHOOK] Error guardando nuevo chat:", insertError.message);
    }

    // 5. Enviar Mensaje de Vuelta vía Green-API
    const cleanUrl = providerConfig.apiUrl.replace(/\/$/, "");
    const sendEndpoint = `${cleanUrl}/waInstance${providerConfig.idInstance}/sendMessage/${providerConfig.apiTokenInstance}`;
    console.log("[WEBHOOK] Enviando respuesta vía Green-API a:", sender);

    const sendRes = await fetch(sendEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: sender,
        message: aiResponse
      })
    });

    if (!sendRes.ok) {
      const errorText = await sendRes.text();
      console.error("[WEBHOOK] ERROR enviando mensaje vía Green API:", sendRes.status, errorText);
      throw new Error(`Green API falló: ${sendRes.status}`);
    }

    console.log("[WEBHOOK] ✅ Mensaje respondido exitosamente");
    return NextResponse.json({ success: true, message: "Mensaje respondido con IA correctamente." });

  } catch (error: any) {
    console.error("[WEBHOOK] ❌ ERROR:", error.message || String(error));
    console.error("[WEBHOOK] Stack:", error.stack);
    return NextResponse.json({ error: "Error procesando webhook", details: error.message || String(error) }, { status: 500 });
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
