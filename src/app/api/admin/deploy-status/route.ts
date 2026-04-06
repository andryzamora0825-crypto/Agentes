import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

// Nota: maxDuration requiere plan Pro en Vercel.
// El flujo fue optimizado para terminar en <10s eliminando el paso uploadFile.
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const TEXT_MODEL = "gemini-2.5-flash";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const isAdmin = user.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";
    if (!isAdmin) return NextResponse.json({ error: "Permiso denegado" }, { status: 403 });

    const { agent, basePrompt } = await request.json();
    if (!agent || !basePrompt) return NextResponse.json({ error: "Datos faltantes" }, { status: 400 });

    const { providerConfig, aiPersona, agencyDesc, primaryColor, secondaryColor } = agent;

    if (!providerConfig?.apiUrl || !providerConfig?.idInstance || !providerConfig?.apiTokenInstance) {
      return NextResponse.json({ error: "El agente no tiene configurado su Green-API" }, { status: 400 });
    }

    // PASO 1: Adaptar el prompt al estilo del agente
    const promptAdaptationInstruction = `Eres un director de arte de marketing.
Voy a darte una IDEA PARA UN ESTADO y quiero que generes un PROMPT EN INGLÉS perfecto para generación de imágenes IA, adaptado exclusivamente para la marca de este agente/negocio.

IDENTIDAD DEL AGENTE:
- Personalidad: ${aiPersona}
- Estilo publicitario: ${agencyDesc}
- Colores representativos: Primario (${primaryColor}), Secundario (${secondaryColor})

IDEA BASE: "${basePrompt}"

INSTRUCCIONES:
- Escribe SOLO el prompt en inglés crudo. Sin saludos ni código.
- Incluye y prioriza los colores representativos de manera elegante.
- El estilo debe reflejar la personalidad indicada.
- Formato Vertical 9:16 portrait.`;

    const adaptationRes = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ text: promptAdaptationInstruction }],
    });

    let adaptedPrompt = adaptationRes.text || basePrompt;
    adaptedPrompt = `CRITICAL: VERTICAL image (9:16 portrait aspect ratio). NO horizontal or square.\n\n${adaptedPrompt.trim()}`;

    // PASO 2: Generar imagen con IA
    const generationRes = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ text: adaptedPrompt }],
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
      throw new Error(`Google AI no devolvió imagen. Prompt: ${adaptedPrompt.substring(0, 50)}...`);
    }

    // PASO 3: Subir a Supabase Storage (URL pública directa)
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
    console.log("[deploy-status] Imagen subida a Supabase:", publicUrl);

    // PASO 4: Publicar el estado vía Green-API usando la URL pública de Supabase.
    // Se omite el paso previo de uploadFile a Green-API (era el cuello de botella de ~20s).
    // Supabase devuelve URLs con Content-Type correcto que Green-API acepta directamente.
    const cleanUrl = providerConfig.apiUrl.replace(/\/$/, "");
    const sendEndpoint = `${cleanUrl}/waInstance${providerConfig.idInstance}/sendMediaStatus/${providerConfig.apiTokenInstance}`;

    console.log("[deploy-status] Enviando a Green-API sendMediaStatus:", sendEndpoint);

    const statusRes = await fetch(sendEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urlFile: publicUrl,
        fileName: `status_image.${ext}`,
      }),
      signal: AbortSignal.timeout(15000), // 15s máximo
    });

    const gApiStatusCode = statusRes.status;
    const gApiResponseText = await statusRes.text();
    console.log(`[deploy-status] GreenAPI Response (${gApiStatusCode}):`, gApiResponseText);

    if (!statusRes.ok) {
      throw new Error(`GreenAPI rechazó el estado. Código ${gApiStatusCode}: ${gApiResponseText}`);
    }

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      adaptedPrompt,
      gApiStatus: gApiStatusCode,
      gApiResponse: gApiResponseText,
    });

  } catch (error: any) {
    if (error.name === "AbortError") {
      return NextResponse.json({ error: "Tiempo de espera agotado con Green-API (>15s)." }, { status: 504 });
    }
    console.error("[deploy-status] Error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Error procesando el estado" }, { status: 500 });
  }
}
