// ══════════════════════════════════════════════
// AI Content Service — Gemini (Nano Banana) Integration
// Same technology as Estudio IA module
// Generates captions with text model + images with image model
// ══════════════════════════════════════════════

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import type { GenerateContentParams } from "@/lib/types/social.types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

  // Mapeamos a los formatos nativos de DALL-E 3
  let size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";
  if (imageFormat === "vertical" || imageFormat === "portrait") size = "1024x1792";
  if (imageFormat === "horizontal") size = "1792x1024";

  let finalPrompt = `${imagePrompt}

IMPORTANTE: Esta imagen es para publicar en redes sociales. Debe ser visualmente impactante y profesional, con una excelente composición. 
SE ESTRICTO: NO DEBE HABER TEXTO, LETRAS NI PALABRAS SUPERPUESTAS EN LA IMAGEN (A menos que la idea lo pida explícitamente).`;

  if (aiSettings) {
    const agencyContext = `
[IDENTIDAD DE MARCA]: 
Incorpora sutil y orgánicamente la identidad de la marca "${aiSettings.agencyName || 'Agencia'}":
- Tono/Estilo fotográfico o ilustración: ${aiSettings.agencyDesc || 'Estándar, profesional'}
- Esquema de colores primario: (${aiSettings.primaryColor || '#FFDE00'}). Resalta luces, vestimentas o elementos protagónicos de la imagen con este color.
`;
    finalPrompt = `${finalPrompt}\n\n${agencyContext}`;
  }

  // Usamos DALL-E 3 de forma directa y estable
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: finalPrompt,
    size: size,
    quality: "standard",
    n: 1,
  });

  const generatedUrl = response.data?.[0]?.url;
  if (!generatedUrl) {
    throw new Error("DALL-E 3 no devolvió ninguna imagen. Intenta de nuevo.");
  }

  // Descargamos la imagen temporal de OpenAI para subirla a nuestro propio Supabase
  const imageResponse = await fetch(generatedUrl);
  const arrayBuffer = await imageResponse.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  
  const fileName = `social_${userId}_${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from("ai-generations")
    .upload(fileName, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("ai-generations")
    .getPublicUrl(fileName);

  return {
    imageUrl: publicUrlData.publicUrl,
    model: "DALL-E 3 ✨",
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
