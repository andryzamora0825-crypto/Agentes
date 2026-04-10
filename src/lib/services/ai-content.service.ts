// ══════════════════════════════════════════════
// AI Content Service — Gemini (Nano Banana) Integration
// Same technology as Estudio IA module
// Generates captions with text model + images with image model
// ══════════════════════════════════════════════

import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";
import type { GenerateContentParams } from "@/lib/types/social.types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Same primary models used in Estudio IA
const NANO_BANANA_2 = "gemini-3.1-flash-image-preview";

/**
 * Helper: Intenta generar texto garantizando reintentos severos sobre gemini-2.5-flash.
 * Si falla, mostramos el error EXACTO para entender qué pasa.
 */
async function generateText(params: any) {
  const model = "gemini-2.5-flash";
  let lastError: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: model,
      });
      return response;
    } catch (error: any) {
      lastError = error;
      const is503 = error?.status === 503 || 
                    error?.status === "UNAVAILABLE" || 
                    error?.message?.includes("503") || 
                    error?.message?.includes("high demand") ||
                    error?.message?.includes("overloaded") ||
                    error?.message?.includes("Too Many Requests");

      if (is503 && attempt < 3) {
        console.warn(`[SOCIAL AI TEXT] ${model} 503 Congestión. Retraso de ${attempt * 3}s (Intento ${attempt}/3)...`);
        await new Promise(res => setTimeout(res, attempt * 3000));
        continue;
      }
      
      // Si el error NO es 503, rompemos inmediatamente porque es otro problema (ej. 400, auth)
      if (!is503) break;
    }
  }

  // Si falló todas las veces o hubo un error fatal (400, etc), lanzamos el error original de Google.
  throw new Error(`Google AI falló generando texto con el error: ${lastError?.message || JSON.stringify(lastError)}`);
}

/**
 * Helper para Imagen: Solo reintenta con 3.1 (porque sabemos que este sí funciona y existe)
 */
async function generateImageWithRetry(params: any, modelToUse: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: modelToUse,
      });
      return response;
    } catch (error: any) {
      if (attempt < retries) {
        console.warn(`[SOCIAL AI IMAGE RETRY] ${modelToUse} falló. Reintentando en ${attempt * 2}s...`);
        await new Promise(res => setTimeout(res, attempt * 2000));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Nano Banana no pudo generar la imagen tras ${retries} intentos.`);
}

/**
 * Generates a social media caption using Gemini text model
 */
export async function generateCaption(params: GenerateContentParams): Promise<string> {
  const { topic, brandVoice = "profesional", platform = "facebook", customTemplate } = params;

  const platformInstructions: Record<string, string> = {
    facebook: "para Facebook. Usa un tono conversacional, incluye emojis relevantes, y mantén el texto entre 100-300 caracteres. Incluye un call-to-action sutil.",
    instagram: "para Instagram. Usa hashtags relevantes (5-10), emojis estratégicos, y mantén el texto entre 150-500 caracteres. El tono debe ser visual y aspiracional.",
    both: "que funcione tanto para Facebook como Instagram. Usa emojis, un tono versátil, entre 150-300 caracteres, y añade 3-5 hashtags al final.",
  };

  const systemPrompt = customTemplate || `
Eres un experto en marketing digital y copywriting para redes sociales.
Tu tono de marca es: ${brandVoice}.
Genera SOLO el texto del caption (sin explicaciones adicionales).
El caption debe ser ${platformInstructions[platform] || platformInstructions.facebook}
Tema/idea del post: ${topic}

REGLAS:
- NO incluyas comillas alrededor del texto
- NO añadas "Caption:" ni etiquetas
- Escribe directamente el texto listo para publicar
- Usa español latinoamericano
- Sé creativo y engagement-oriented
`;

  const response = await generateText(
    { contents: [{ text: systemPrompt }] }
  );

  const caption = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return caption.trim();
}

/**
 * Generates a social media image using Gemini (Nano Banana 2)
 * Same approach as Estudio IA module
 */
export async function generateImage(
  imagePrompt: string,
  userId: string,
  imageFormat: string = "square",
  aiSettings?: any
): Promise<{ imageUrl: string; model: string }> {

  // Format instructions (same as Estudio IA)
  const FORMAT_MAP: Record<string, string> = {
    square: "OBLIGATORIO: La imagen DEBE ser CUADRADA (1:1), como 1024x1024 píxeles.",
    vertical: "OBLIGATORIO: La imagen DEBE ser VERTICAL (9:16), como 768x1365 píxeles. Formato Stories/Reels.",
    horizontal: "OBLIGATORIO: La imagen DEBE ser HORIZONTAL (16:9), como 1365x768 píxeles.",
    portrait: "OBLIGATORIO: La imagen DEBE ser VERTICAL tipo RETRATO (4:5), como 819x1024 píxeles.",
  };
  const formatInstruction = FORMAT_MAP[imageFormat] || FORMAT_MAP.square;

  let finalPrompt = `[INSTRUCCIÓN DE FORMATO CRÍTICA - MÁXIMA PRIORIDAD]: ${formatInstruction}

${imagePrompt}

IMPORTANTE: Esta imagen es para publicar en redes sociales. Debe ser:
- Visualmente impactante y profesional
- Con colores vibrantes y buena composición
- Sin texto superpuesto (a menos que se pida específicamente)
- Alta calidad fotográfica o estilo gráfico premium`;

  if (aiSettings) {
    const agencyContext = `
[INSTRUCCIÓN CRÍTICA DE IDENTIDAD DE MARCA]: 
Estás generando una imagen para la agencia: "${aiSettings.agencyName || 'Sin Nombre'}". 
A menos que la petición del usuario indique estrictamente lo contrario, DEBES incorporar la identidad de su marca:
- Tono/Estilo: ${aiSettings.agencyDesc || 'Estándar, profesional'}
- Colores representativos: Primario (${aiSettings.primaryColor || '#FFDE00'}), Secundario (${aiSettings.secondaryColor || '#000000'}). Refleja abundantemente estos colores en ropa, fondos, decoraciones o iluminación.
- Contactos (añade creativamente a carteles/letreros si es orgánico): ${aiSettings.contactNumber || ''} ${aiSettings.extraContact ? ' / ' + aiSettings.extraContact : ''}.
`;
    finalPrompt = `${finalPrompt}\n\n${agencyContext}`;
  }

  const response = await generateImageWithRetry(
    { contents: [{ text: finalPrompt }] },
    NANO_BANANA_2
  );

  // Extract image from response (same pattern as Estudio IA)
  let imageBase64: string | null = null;
  let imageMimeType = "image/png";

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if ((part as any).inlineData) {
      imageBase64 = (part as any).inlineData.data;
      imageMimeType = (part as any).inlineData.mimeType || "image/png";
      break;
    }
  }

  if (!imageBase64) {
    throw new Error("Nano Banana no generó una imagen. Probablemente Google sirvió texto al caer en servidor de respaldo. Intenta de nuevo.");
  }

  // Upload to Supabase Storage (same bucket as Estudio IA)
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
  const fileName = `social_${userId}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("ai-generations")
    .upload(fileName, imageBuffer, {
      contentType: imageMimeType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("ai-generations")
    .getPublicUrl(fileName);

  return {
    imageUrl: publicUrlData.publicUrl,
    model: "Nano Banana 2 🍌",
  };
}

/**
 * Generates both caption and image for a social media post
 */
export async function generateFullPost(
  params: GenerateContentParams,
  userId: string,
  aiSettings?: any
): Promise<{ caption: string; imageUrl: string; imagePrompt: string; model: string }> {

  // 🔴 MEDIDA DE EXTREMA URGENCIA (SOLUCIÓN DEFINITIVA):
  // El maldito modelo de texto de Google sigue fallando con 503 globalmente.
  // Por orden del usuario, he ANULADO la generación del caption (copys, hashtags, etc) por IA.
  // Hemos replicado EXACTAMENTE el flujo de Estudio IA: solo agarramos el string bruto 
  // y lo mandamos de frente al generador de imágenes.
  
  const caption = params.topic.trim(); // Usamos lo que escribiste como "caption" temporal
  const imagePrompt = params.topic.trim(); // Lo pasamos directamente a Nano Banana 2

  // Esta es la llamada idéntica de Estudio IA (que sabemos que funciona).
  const { imageUrl, model } = await generateImage(
    imagePrompt,
    userId,
    params.imageFormat || "square",
    aiSettings
  );

  return { caption, imageUrl, imagePrompt, model };
}
