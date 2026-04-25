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

// Helper: fetch con timeout agresivo para evitar cuelgues
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
  aiSettings?: any,
  targetPlatform: string = "",
  useAgencyIdentity: boolean = true,
  useAgencyCharacter: boolean = false
): Promise<{ imageUrl: string; model: string }> {

  // Format instructions (same as Estudio IA)
  const FORMAT_MAP: Record<string, string> = {
    square: "REGLA DE FORMATO: La imagen DEBE ser CUADRADA (1:1), como 1024x1024 píxeles.",
    vertical: "REGLA DE FORMATO: La imagen DEBE ser VERTICAL (9:16), como 768x1365 píxeles. Formato Stories/Reels.",
    horizontal: "REGLA DE FORMATO: La imagen DEBE ser HORIZONTAL (16:9), como 1365x768 píxeles.",
    portrait: "REGLA DE FORMATO: La imagen DEBE ser VERTICAL tipo RETRATO (4:5), como 819x1024 píxeles.",
  };
  const formatInstruction = FORMAT_MAP[imageFormat] || FORMAT_MAP.square;

  let finalPrompt = `[INSTRUCCIÓN DE FORMATO CRÍTICA - MÁXIMA PRIORIDAD]: ${formatInstruction}

${imagePrompt}

IMPORTANTE: Esta imagen es para publicar en redes sociales. Debe ser:
- Visualmente impactante y profesional
- Con colores vibrantes y buena composición
- Sin texto superpuesto (a menos que se pida específicamente)
- Alta calidad fotográfica o estilo gráfico premium`;

  if (useAgencyIdentity && aiSettings) {
    const agencyContext = `
[INSTRUCCIÓN CRÍTICA DE IDENTIDAD DE MARCA Y CREATIVIDAD]: 
Estás generando una imagen para la agencia: "${aiSettings.agencyName || 'Sin Nombre'}". 
REGLAS DE ORO PARA EVITAR REPETICIÓN:
1. PRIORIDAD ABSOLUTA AL TEMA PEDIDO: La imagen debe representar PRIMERO lo que el usuario pide en su idea principal.
2. DIVERSIDAD EXTREMA: NUNCA repitas la misma escena aburrida (EJ: prohíbo terminantemente usar siempre mostradores, cajas registradoras, o personas de pie apuntando a la cámara).
3. VARÍA EL CONTEXTO: Usa ángulos creativos, fondos abstractos, vistas desde arriba, escenas en exteriores, acción dinámica, o tecnología moderna, dependiendo de la idea.
4. INTEGRACIÓN DE MARCA SUTIL Y ELEGANTE: 
   - Estilo: ${aiSettings.agencyDesc || 'Estándar, profesional'}
   - Si encaja naturalmente en la escena, incluye el teléfono: ${aiSettings.contactNumber || ''} ${aiSettings.extraContact ? ' / ' + aiSettings.extraContact : ''}.`;
    finalPrompt = `${finalPrompt}\n\n${agencyContext}`;

    // --- INYECCIÓN DE PERSONAJE (idéntico a Estudio IA) ---
    if (useAgencyCharacter && aiSettings.characterImageUrl) {
      finalPrompt += `\n\n[INSTRUCCIÓN DE PERSONAJE]: DEBES incluir en la imagen al personaje/representante de la agencia (su rostro de referencia ha sido adjuntado). 
REGLAS PARA EL PERSONAJE:
- Mantén su apariencia y rasgos reconocibles.
- EXTREMADAMENTE IMPORTANTE: Varía dinámicamente sus posiciones (volando, saltando, caminando, ángulos de cámara variados, tomas cinematográficas). PROHIBIDO hacer a la persona simplemente "sentada frente a una laptop" o "parada mirando a la cámara aburrida" a menos que se pida estrictamente.`;
    }
  }

  // --- RECOPILAR IMÁGENES DE REFERENCIA (logos, brand, personaje) ---
  const referenceImages: { base64: string; mimeType: string; label?: string }[] = [];
  
  const itemsToFetch: { url: string; label: string }[] = [];

  if (useAgencyIdentity && aiSettings) {
    if (aiSettings.agencyLogoUrl) itemsToFetch.push({ url: aiSettings.agencyLogoUrl, label: "Logo Principal de la Agencia" });
    if (aiSettings.inspLogoUrl) itemsToFetch.push({ url: aiSettings.inspLogoUrl, label: "Estilo Visual Referencial" });
    // Legacy support via `brandLogoUrl` just in case
    if (aiSettings.brandLogoUrl) itemsToFetch.push({ url: aiSettings.brandLogoUrl, label: "Logo Secundario/Antiguo" });
  }

  const PLATFORM_COLORS: Record<string, {primary: string, secondary: string}> = {
    ecuabet: { primary: "Azul oscuro (#0B1C3D)", secondary: "Amarillo (#FFD700)" },
    doradobet: { primary: "Amarillo Dorado (#FFDE00)", secondary: "Negro oscuro (#000000)" },
    masparley: { primary: "Rojo vibrante (#FF0000)", secondary: "Negro (#000000)" },
    databet: { primary: "Celeste/Cyan (#00E1FF)", secondary: "Negro (#000000)" },
    astrobet: { primary: "Azul Intenso (#1A3A6B)", secondary: "Rojo Vibrante (#E8253A)" }
  };

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rslhlpaxcwwchpcyiifc.supabase.co";
  const cacheBuster = `?t=${Date.now()}`;
  const OFFICIAL_PLATFORMS: Record<string, string> = {
    ecuabet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_ecuabet.png${cacheBuster}`,
    doradobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_doradobet.png${cacheBuster}`,
    masparley: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_masparley.png${cacheBuster}`,
    databet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_databet.png${cacheBuster}`,
    astrobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_astrobet.png${cacheBuster}`,
  };

  if (targetPlatform) {
    const platKey = targetPlatform.toLowerCase().trim();
    let formattedPlat = platKey;
    if(platKey==='masparley') formattedPlat = 'MasParley';
    else if(platKey==='doradobet') formattedPlat = 'DoradoBet';
    else if(platKey==='databet') formattedPlat = 'DataBet';
    else if(platKey==='ecuabet') formattedPlat = 'Ecuabet';
    else if(platKey==='astrobet') formattedPlat = 'AstroBet';
    else formattedPlat = platKey.toUpperCase();

    const pColor = PLATFORM_COLORS[platKey]?.primary || aiSettings?.primaryColor || '#FFDE00';
    const sColor = PLATFORM_COLORS[platKey]?.secondary || aiSettings?.secondaryColor || '#000000';

    finalPrompt += `\n\n[PLATAFORMA Y COLORES ESTRICTOS]: DEBES generar esta imagen específicamente enfocada en promocionar la marca: ${formattedPlat}. 
Usa la siguiente paleta de colores para esta marca: 
- Color Primario: ${pColor}
- Color Secundario: ${sColor}
Refleja abundante y creativamente estos colores en la ropa, los fondos, las decoraciones o la iluminación para que la imagen concuerde perfectamente con la marca. Evita usar colores de otras marcas.
ALERTA DE ORTOGRAFÍA: Escribe el nombre exactamente como "${formattedPlat}", letra por letra. Usa creativamente EL LOGO OFICIAL DE ESTA PLATAFORMA (adjunto como imagen). NO INVENTES LOGOS NI COMETAS ERRORES DE ESCRITURA, calca exactamente el logo enviado.`;
    
    if (OFFICIAL_PLATFORMS[platKey]) {
      itemsToFetch.push({ url: OFFICIAL_PLATFORMS[platKey], label: `Logo OFICIAL de la casa de apuestas ${formattedPlat}` });
    }
  } else if (useAgencyIdentity && aiSettings) {
    // Fallback to agency colors if no platform selected
    finalPrompt += `\n\n[COLORES DE LA MARCA]: Usa los colores de la agencia:
- Color Primario: ${aiSettings.primaryColor || '#FFDE00'}
- Color Secundario: ${aiSettings.secondaryColor || '#000000'}
Refleja abundante y creativamente estos colores en la ropa, los fondos, las decoraciones o la iluminación.`;
  }


  // Fetch all images concurrently
  const fetchPromises = itemsToFetch.map(async (item) => {
    try {
      const res = await fetchWithTimeout(item.url, 8000);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        referenceImages.push({
          base64: Buffer.from(arrayBuffer).toString("base64"),
          mimeType: res.headers.get('content-type') || "image/png",
          label: item.label
        });
      }
    } catch (e) {
      console.error(`[SOCIAL] Error descargando imagen de referencia ${item.label}:`, e);
    }
  });
  await Promise.all(fetchPromises);

  if (useAgencyCharacter && aiSettings && aiSettings.characterImageUrl) {
    try {
      const res = await fetchWithTimeout(aiSettings.characterImageUrl, 8000);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        referenceImages.push({
          base64: Buffer.from(arrayBuffer).toString("base64"),
          mimeType: res.headers.get('content-type') || "image/png",
          label: "Foto del Representante/Personaje de la Agencia"
        });
      }
    } catch (e) {
      console.error("[SOCIAL] Error descargando imagen del personaje:", e);
    }
  }

  // Construir el contenido final: texto + imágenes de referencia (idéntico a Estudio IA)
  const contentParts: any[] = [{ text: finalPrompt }];
  for (const refImg of referenceImages) {
    if (refImg.label) {
       contentParts.push({ text: `\n[ESTA IMAGEN CORRESPONDE A: ${refImg.label}]\n` });
    }
    contentParts.push({
      inlineData: { data: refImg.base64, mimeType: refImg.mimeType }
    });
  }

  let response;
  // ═══ OPTIMIZACIÓN CRÍTICA DE COSTOS ═══
  // Antes: si había imágenes de referencia (logos/personaje/agencia) usaba NANO_BANANA_PRO,
  // que cuesta hasta 10x más. Como CASI SIEMPRE hay refs (marca + plataforma), siempre usaba Pro.
  // Ahora: Flash maneja referencias perfectamente. Solo Pro si se pidiera explícitamente.
  // El reintento también queda en Flash (no escalar a Pro automáticamente al fallar).
  const modelToUse = NANO_BANANA_2;

  const MAX_RETRIES = 2;
  let lastRetryError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const abortController = new AbortController();
    const geminiTimer = setTimeout(() => abortController.abort(), 60_000);

    try {
      console.log(`🎨 [SOCIAL] Intento ${attempt}/${MAX_RETRIES} con ${modelToUse}...`);
      response = await ai.models.generateContent({
        model: modelToUse,
        contents: contentParts,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });
      clearTimeout(geminiTimer);
      break;
    } catch (retryErr: any) {
      clearTimeout(geminiTimer);
      lastRetryError = retryErr;

      const errMsg = retryErr?.message || "";
      const errStr = typeof retryErr === 'object' ? JSON.stringify(retryErr) : String(retryErr);
      const combinedMsg = `${errMsg} ${errStr}`;
      const isTransient = combinedMsg.includes("503") || combinedMsg.includes("UNAVAILABLE")
        || combinedMsg.includes("429") || combinedMsg.includes("RESOURCE_EXHAUSTED")
        || combinedMsg.includes("high demand") || combinedMsg.includes("overloaded")
        || combinedMsg.includes("temporarily") || combinedMsg.includes("capacity");
      const isTimeout = retryErr?.name === "AbortError" || combinedMsg.includes("abort");

      if (isTimeout) {
        throw new Error("⏳ Timeout: el modelo tardó más de 50 segundos. Intenta con un prompt más simple.");
      }

      if (isTransient && attempt < MAX_RETRIES) {
        console.warn(`⏳ [SOCIAL] Gemini error transitorio — Reintento ${attempt}/${MAX_RETRIES} en 1.5s...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }

      throw new Error(
        isTransient
          ? "🔥 Los servidores de IA están saturados. Espera 2–3 minutos e intenta de nuevo."
          : `El modelo de imagen falló: ${errMsg.slice(0, 100) || "Error desconocido"}`
      );
    }
  }

  if (!response) {
    throw new Error(lastRetryError?.message || "Nano Banana no respondió después de múltiples intentos.");
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

  const modelNameUsed = "Nano Banana 2 🍌";

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
    aiSettings,
    params.targetPlatform || "",
    params.useAgencyIdentity ?? true,
    params.useAgencyCharacter ?? false
  );

  return { caption, imageUrl, imagePrompt, model };
}
