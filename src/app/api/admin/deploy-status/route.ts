import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const NANO_BANANA_2 = "gemini-3.1-flash-image-preview";
const ADAPTATION_MODEL = "gemini-2.5-flash";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const isAdmin = user.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";
    if (!isAdmin) {
      return NextResponse.json({ error: "Permiso denegado" }, { status: 403 });
    }

    const { agent, basePrompt } = await request.json();

    if (!agent || !basePrompt) {
      return NextResponse.json({ error: "Datos faltantes" }, { status: 400 });
    }

    const { providerConfig, aiPersona, agencyDesc, primaryColor, secondaryColor } = agent;

    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      return NextResponse.json({ error: "El agente no tiene configurado su Green-API" }, { status: 400 });
    }

    // PASO 1: Adaptar el prompt usando la identidad del agente
    const promptAdaptationInstruction = `
Eres un director de arte de marketing.
Voy a darte una IDEA PARA UN ESTADO (Prompt Base) y quiero que generes un PROMPT EN INGLÉS perfecto para un modelo de generación de imágenes generativa, adaptado exclusivamente para la marca de est agente inmobiliario/negocio.

REGLAS DE IDENTIDAD DE LA AGENCIA DEL CLIENTE:
- Perfil/Personalidad: ${aiPersona}
- Estilo publicitario: ${agencyDesc}
- Colores representativos: Primario (${primaryColor}), Secundario (${secondaryColor})

IDEA PARA EL ESTADO:
"${basePrompt}"

INSTRUCCIONES PARA EL PROMPT DE GENERACIÓN:
- Escribe SOLO el prompt en inglés crudo. Sin saludos ni código.
- Asegúrate de incluir y priorizar los colores representativos de manera elegante en fondos, ropas o ambientes.
- El estilo visual resultante debe reflejar la personalidad indicada.
- Formato Vertical 9:16.
`;

    const adaptationRes = await ai.models.generateContent({
      model: ADAPTATION_MODEL,
      contents: [{ text: promptAdaptationInstruction }]
    });

    let adaptedPrompt = adaptationRes.text || basePrompt;
    
    // Inyectar forzosamente el requerimiento de imagen vertical (9:16)
    adaptedPrompt = `CRITICAL REQUIREMENT: This image MUST be VERTICAL (9:16 aspect ratio, portrait). Under no circumstances generate a horizontal or square image.\n\n${adaptedPrompt.trim()}`;

    // PASO 2: Generar la Imagen con Nano Banana (Sin descontar créditos al usuario final)
    const generationRes = await ai.models.generateContent({
      model: NANO_BANANA_2,
      contents: [{ text: adaptedPrompt }]
    });

    let imageBase64: string | null = null;
    let imageMimeType = "image/png";

    for (const part of generationRes.candidates?.[0]?.content?.parts || []) {
      if ((part as any).inlineData) {
        imageBase64 = (part as any).inlineData.data;
        imageMimeType = (part as any).inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageBase64) {
      throw new Error(`Google AI no devolvió una imagen para el prompt: ${adaptedPrompt.substring(0,50)}...`);
    }

    // PASO 3: Subir a Supabase Storage
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
    const fileName = `status_camp_${agent.id}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("ai-generations")
      .upload(fileName, imageBuffer, { contentType: imageMimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("ai-generations")
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // PASO 4: Publicar el estado vía Green-API (Usando uploadFile para evitar cuelgues/rechazos)
    const cleanUrl = providerConfig.apiUrl.replace(/\/$/, "");
    
    // 4.1 Subir archivo binario directo a Green API
    const uploadEndpoint = `${cleanUrl}/waInstance${providerConfig.idInstance}/uploadFile/${providerConfig.apiTokenInstance}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Max 20s para operaciones Green API

    let finalUrlFile = publicUrl; // Fallback al original de supabase

    try {
      const uploadRes = await fetch(uploadEndpoint, {
        method: "POST",
        headers: { 
          "Content-Type": imageMimeType,
          "GA-Filename": `status_image.${ext}`
        },
        body: imageBuffer,
        signal: controller.signal
      });
      
      if (uploadRes.ok) {
         const uploadData = await uploadRes.json();
         if (uploadData.urlFile) {
            finalUrlFile = uploadData.urlFile;
         }
      } else {
         console.warn("Retrying with direct URL, GreenAPI upload failed:", await uploadRes.text());
      }
    } catch(err: any) {
      if (err.name === 'AbortError') {
         throw new Error("Green-API tardó más de 20s en subir el archivo.");
      }
      console.warn("Upload indirecto falló, usando url directa.", err.message);
    }

    // 4.2 Enviar el Status 
    const sendEndpoint = `${cleanUrl}/waInstance${providerConfig.idInstance}/sendMediaStatus/${providerConfig.apiTokenInstance}`;
    console.log("[deploy-status] Sending to:", sendEndpoint);
    console.log("[deploy-status] urlFile:", finalUrlFile);
    
    const sendController = new AbortController();
    const sendTimeoutId = setTimeout(() => sendController.abort(), 20000);

    let gApiResponseText = "";
    let gApiStatusCode = 0;

    try {
      const statusRes = await fetch(sendEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urlFile: finalUrlFile,
          fileName: `status_image.${ext}`,
          caption: "✨ Generado por IA\n" + basePrompt 
        }),
        signal: sendController.signal
      });

      clearTimeout(sendTimeoutId);
      gApiStatusCode = statusRes.status;
      gApiResponseText = await statusRes.text();
      console.log(`[deploy-status] GreenAPI Response (${gApiStatusCode}):`, gApiResponseText);

      if (!statusRes.ok) {
        throw new Error(`GreenAPI rechazó el estado. Código ${gApiStatusCode}: ${gApiResponseText}`);
      }
    } catch(err: any) {
      clearTimeout(sendTimeoutId);
      if (err.name === 'AbortError') {
         throw new Error("Green-API tardó más de 20s en enviar el estado (Timeout).");
      }
      throw err;
    }

    clearTimeout(timeoutId);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      adaptedPrompt,
      gApiStatus: gApiStatusCode,
      gApiResponse: gApiResponseText
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
        return NextResponse.json({ error: "Tiempo de espera agotado (Servidor tardó mucho)." }, { status: 504 });
    }
    console.error("Error en deploy-status:", error);
    return NextResponse.json({ error: error?.message || "Error procesando el estado" }, { status: 500 });
  }
}
