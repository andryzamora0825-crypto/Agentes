import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// DIAGNOSTIC: verificar que la key existe al cargar el módulo
const geminiKey = process.env.GEMINI_API_KEY;
console.log("[WEBHOOK MODULE LOAD] GEMINI_API_KEY present:", !!geminiKey);

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
    console.log("[WEBHOOK] typeWebhook:", payload.typeWebhook);
    console.log("[WEBHOOK] sender:", payload.senderData?.sender);
    console.log("[WEBHOOK] typeMessage:", payload.messageData?.typeMessage);

    // Validar si es una notificación de mensaje entrante
    if (payload.typeWebhook !== "incomingMessageReceived") {
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
    console.log("[WEBHOOK] Settings:", JSON.stringify({
      isActive: settings?.isActive,
      isUnlocked: settings?.isUnlocked,
      hasProviderConfig: !!settings?.providerConfig,
      hasApiUrl: !!settings?.providerConfig?.apiUrl,
      hasIdInstance: !!settings?.providerConfig?.idInstance,
      hasToken: !!settings?.providerConfig?.apiTokenInstance,
      hasPersona: !!settings?.aiPersona,
      hasKnowledge: !!settings?.knowledgeBase
    }));
    
    if (!settings || !settings.isActive) {
      console.log("[WEBHOOK] Ignorado - El Agente IA está apagado o no configurado");
      return NextResponse.json({ success: true, ignored: true, reason: "El Agente IA está apagado o no configurado" });
    }

    // Extraer Configuración
    const { providerConfig, aiPersona, knowledgeBase } = settings;
    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      console.log("[WEBHOOK] ERROR: API de telefonía no configurada", {
        apiUrl: !!providerConfig?.apiUrl,
        idInstance: !!providerConfig?.idInstance,
        apiTokenInstance: !!providerConfig?.apiTokenInstance
      });
      return NextResponse.json({ success: true, ignored: true, reason: "API de telefonía no configurada" });
    }

    // 4. Procesar Respuesta con GEMINI IA
    console.log("[WEBHOOK] Generando respuesta con Gemini...");
    
    if (!geminiKey) {
      console.error("[WEBHOOK] ERROR FATAL: GEMINI_API_KEY no está configurada en las variables de entorno");
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        maxOutputTokens: 250,
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

    const chat = model.startChat({
       history: [
         { role: "user", parts: [{ text: systemPrompt }] },
         { role: "model", parts: [{ text: "Entendido. Respondere basado en las reglas anteriores y el conocimiento limitado." }]}
       ]
    });

    const result = await chat.sendMessage(messageText);
    const aiResponse = result.response.text();
    console.log("[WEBHOOK] Respuesta IA generada:", aiResponse.substring(0, 150));

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

// GET para verificar que el endpoint está vivo (útil para diagnosticar)
export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    geminiKeyPresent: !!process.env.GEMINI_API_KEY,
    clerkKeyPresent: !!process.env.CLERK_SECRET_KEY,
  });
}
