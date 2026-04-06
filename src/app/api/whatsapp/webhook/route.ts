import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializa Gemini (asegúrate de que en el .env coincida el nombre de la variable de entorno)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    // 1. Validar el destino y la URL (Buscamos el User ID)
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json({ error: "Missing uid parameter" }, { status: 400 });
    }

    // 2. Extraer el Payload del Webhook (Green-API format)
    const payload = await request.json();

    // Validar si es una notificación de mensaje entrante
    if (payload.typeWebhook !== "incomingMessageReceived") {
      // Respondemos OK para otras notificaciones (estado de mensaje, device status, etc) para que Green API no intente reenviar.
      return NextResponse.json({ success: true, ignored: true });
    }

    // Extraer datos clave
    const sender = payload.senderData?.sender; // ej. 1234567890@c.us
    const senderName = payload.senderData?.senderName || "Cliente";
    
    // Ignorar si el mensaje fue enviado por el propio bot/usuario desde el celular (evitar loop infinito)
    // O ignorar si proviene de un grupo (@g.us)
    if (sender === payload.instanceData?.wid || sender?.includes("@g.us")) {
       return NextResponse.json({ success: true, ignored: true, reason: "Mensaje propio o grupo" });
    }

    // Obtener texto. Green API puede enviar texto o extended text (si tiene link)
    const typeMessage = payload.messageData?.typeMessage;
    let messageText = "";

    if (typeMessage === "textMessage") {
      messageText = payload.messageData?.textMessageData?.textMessage;
    } else if (typeMessage === "extendedTextMessage") {
      messageText = payload.messageData?.extendedTextMessageData?.text;
    } else {
      // Ignorar audios, imágenes, stickers por ahora
      return NextResponse.json({ success: true, ignored: true, reason: "No es un mensaje de texto" });
    }

    if (!messageText) {
      return NextResponse.json({ success: true, ignored: true, reason: "Mensaje vacío" });
    }

    // 3. Buscar la configuración del usuario en Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(uid);
    if (!user) throw new Error("Usuario no encontrado");

    const settings = user.publicMetadata?.whatsappSettings as any;
    
    if (!settings || !settings.isActive) {
      return NextResponse.json({ success: true, ignored: true, reason: "El Agente IA está apagado o no configurado" });
    }

    // Extraer Configuración
    const { providerConfig, aiPersona, knowledgeBase } = settings;
    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      return NextResponse.json({ success: true, ignored: true, reason: "API de telefonía no configurada" });
    }

    // 4. Procesar Respuesta con GEMINI IA
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const chat = model.startChat({
       history: [
         { role: "user", parts: [{ text: systemPrompt }] },
         { role: "model", parts: [{ text: "Entendido. Respondere basado en las reglas anteriores y el conocimiento limitado." }]}
       ]
    });

    const result = await chat.sendMessage(messageText);
    const aiResponse = result.response.text();

    // 5. Enviar Mensaje de Vuelta vía Green-API
    // URL format: https://{apiUrl}/waInstance{idInstance}/sendMessage/{apiTokenInstance}
    
    // Limpiar la url por si acaso
    const cleanUrl = providerConfig.apiUrl.replace(/\/$/, "");
    const sendEndpoint = `${cleanUrl}/waInstance${providerConfig.idInstance}/sendMessage/${providerConfig.apiTokenInstance}`;

    const sendRes = await fetch(sendEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: sender,
        message: aiResponse
      })
    });

    if (!sendRes.ok) {
       console.error("Error enviando mensaje vía Green API", await sendRes.text());
       throw new Error("Green API falló");
    }

    return NextResponse.json({ success: true, message: "Mensaje respondido con IA correctamente." });

  } catch (error: any) {
    console.error("WhatsApp Webhook Error:", error);
    return NextResponse.json({ error: "Error procesando webhook" }, { status: 500 });
  }
}
