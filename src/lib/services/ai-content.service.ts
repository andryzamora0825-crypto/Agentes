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
const NANO_BANANA_PRO = "gemini-3-pro-image-preview";

/**
 * Helper: Generates text using OpenAI GPT-4o-mini (replaces the unstable Gemini text model)
 */
async function generateTextOpenAI(systemPrompt: string): Promise<string> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        max_tokens: 300,
        temperature: 0.7,
      });

      return response.choices[0].message.content || "";
    } catch (error: any) {
      lastError = error;
      if (error?.status === 429 && attempt < 3) {
        await new Promise(res => setTimeout(res, attempt * 2000));
        continue;
      }
      break;
    }
  }

  throw new Error(`OpenAI falló generando texto con el error: ${lastError?.message || JSON.stringify(lastError)}`);
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
- Sé creativo y genera alta interacción (engagement)
`;

  const caption = await generateTextOpenAI(systemPrompt);
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
[INSTRUCCIÓN CRÍTICA DE IDENTIDAD DE MARCA Y CREATIVIDAD]: 
Estás generando una imagen para la agencia: "${aiSettings.agencyName || 'Sin Nombre'}". 
REGLAS DE ORO PARA EVITAR REPETICIÓN:
1. PRIORIDAD ABSOLUTA AL TEMA PEDIDO: La imagen debe representar PRIMERO lo que el usuario pide en su idea principal.
2. DIVERSIDAD EXTREMA: NUNCA repitas la misma escena aburrida (EJ: prohíbo terminantemente usar siempre mostradores, cajas registradoras, o personas de pie apuntando a la cámara).
3. VARÍA EL CONTEXTO: Usa ángulos creativos, fondos abstractos, vistas desde arriba, escenas en exteriores, acción dinámica, o tecnología moderna, dependiendo de la idea.
4. INTEGRACIÓN DE MARCA SUTIL Y ELEGANTE: 
   - Estilo: ${aiSettings.agencyDesc || 'Estándar, profesional'}
   - Aplica sutilmente Colores Primario (${aiSettings.primaryColor || '#FFDE00'}) y Secundario (${aiSettings.secondaryColor || '#000000'}) en la iluminación, fondos, o detalles, pero sin forzar a que toda la ropa sea amarilla/negra si no tiene sentido con la petición.
   - Si encaja naturalmente en la escena, incluye el teléfono: ${aiSettings.contactNumber || ''} ${aiSettings.extraContact ? ' / ' + aiSettings.extraContact : ''}.`;
    finalPrompt = `${finalPrompt}\n\n${agencyContext}`;

    // --- INYECCIÓN DE PERSONAJE (idéntico a Estudio IA) ---
    if (aiSettings.characterImageUrl) {
      finalPrompt += `\n\n[INSTRUCCIÓN DE PERSONAJE]: DEBES incluir en la imagen al personaje/representante de la agencia (su rostro de referencia ha sido adjuntado). 
REGLAS PARA EL PERSONAJE:
- Mantén su apariencia y rasgos reconocibles.
- EXTREMADAMENTE IMPORTANTE: Varía dinámicamente sus posiciones (volando, saltando, caminando, ángulos de cámara variados, tomas cinematográficas). PROHIBIDO hacer a la persona simplemente "sentada frente a una laptop" o "parada mirando a la cámara aburrida" a menos que se pida estrictamente.`;
    }
  }

  // --- RECOPILAR IMÁGENES DE REFERENCIA (logos, brand, personaje) ---
  const referenceImages: { base64: string; mimeType: string }[] = [];
  if (aiSettings) {
    const urlsToFetch = [
      aiSettings.agencyLogoUrl, 
      aiSettings.inspLogoUrl, 
      aiSettings.brandLogoUrl,
      aiSettings.characterImageUrl
    ].filter(Boolean);
    
    for (const url of urlsToFetch) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          referenceImages.push({
            base64: Buffer.from(arrayBuffer).toString("base64"),
            mimeType: res.headers.get('content-type') || "image/png"
          });
        }
      } catch (e) {
        console.error("[SOCIAL] Error descargando imagen de referencia:", e);
      }
    }
  }

  // Construir el contenido final: texto + imágenes de referencia (idéntico a Estudio IA)
  const contentParts: any[] = [{ text: finalPrompt }];
  for (const refImg of referenceImages) {
    contentParts.push({
      inlineData: { data: refImg.base64, mimeType: refImg.mimeType }
    });
  }

  let response;
  try {
    const hasRefImages = referenceImages.length > 0;
    const modelToUse = hasRefImages ? NANO_BANANA_PRO : NANO_BANANA_2;

    // Llamada DIRECTA sin reintentos (si falla, falla rápido en 20s y no a los 2 minutos)
    response = await ai.models.generateContent({
      model: modelToUse,
      contents: contentParts,
    });
  } catch (err: any) {
    console.error("🔴 Error DENTRO de Nano Banana Gemini:", err);
    throw new Error(`El modelo de imagen de Google falló: ${err?.message || "Error desconocido"}`);
  }

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

  const modelNameUsed = referenceImages.length > 0 ? "Nano Banana Pro 🍌" : "Nano Banana 2 🍌";

  return {
    imageUrl: publicUrlData.publicUrl,
    model: modelNameUsed,
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

  // 1. Generar texto de la publicación adaptativo usando OpenAI
  const caption = await generateCaption({ ...params, customTemplate: undefined });

  // 2. Usar el prompt base o caption generado para la imagen
  const imagePrompt = params.topic.trim(); // Lo pasamos directo como en Estudio IA

  // 3. Generar la imagen visual adaptada a la marca y personajes (Nano Banana)
  const { imageUrl, model } = await generateImage(
    imagePrompt,
    userId,
    params.imageFormat || "square",
    aiSettings
  );

  return { caption, imageUrl, imagePrompt, model };
}
