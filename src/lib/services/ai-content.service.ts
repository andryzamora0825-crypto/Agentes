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

// Helper: fetch con timeout para evitar cuelgues
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isOverloadedErr(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.statusCode || err?.code;
  return (
    status === 503 || status === 429 ||
    msg.includes("503") || msg.includes("overloaded") ||
    msg.includes("unavailable") || msg.includes("rate limit") ||
    msg.includes("resource_exhausted")
  );
}

function normalizeMime(raw: string | null | undefined): string | null {
  let mime = (raw || "").toLowerCase().split(";")[0].trim();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!mime.startsWith("image/")) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return "image/png";
  return mime;
}

/**
 * Helper: Generates text using OpenAI GPT-4o-mini con timeout y retry.
 */
async function generateTextOpenAI(systemPrompt: string): Promise<string> {
  let lastError: any = null;
  const TEXT_TIMEOUT_MS = 20_000;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("OPENAI_TIMEOUT")), TEXT_TIMEOUT_MS);
      });
      const apiPromise = openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        max_tokens: 300,
        temperature: 0.7,
      });
      const response = await Promise.race([apiPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      return (response as any).choices[0].message.content || "";
    } catch (error: any) {
      lastError = error;
      if ((error?.status === 429 || error?.message === "OPENAI_TIMEOUT") && attempt < 3) {
        await new Promise(res => setTimeout(res, attempt * 1500));
        continue;
      }
      break;
    }
  }

  throw new Error(`OpenAI falló generando texto: ${lastError?.message || JSON.stringify(lastError)}`);
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
    saborabet: { primary: "Naranja (#FF6600)", secondary: "Negro (#000000)" },
    astrobet: { primary: "Azul Intenso (#1A3A6B)", secondary: "Rojo Vibrante (#E8253A)" }
  };

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rslhlpaxcwwchpcyiifc.supabase.co";
  // Sin cache buster: dejamos que el CDN cachee. Para invalidar un logo, renombrar el archivo a default_X_v2.png.
  const OFFICIAL_PLATFORMS: Record<string, string> = {
    ecuabet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_ecuabet.png`,
    doradobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_doradobet.png`,
    masparley: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_masparley.png`,
    databet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_databet.png`,
    astrobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_astrobet.png`,
  };

  if (targetPlatform) {
    const platKey = targetPlatform.toLowerCase().trim();
    let formattedPlat = platKey;
    if(platKey==='masparley') formattedPlat = 'MasParley';
    else if(platKey==='doradobet') formattedPlat = 'DoradoBet';
    else if(platKey==='databet') formattedPlat = 'DataBet';
    else if(platKey==='ecuabet') formattedPlat = 'Ecuabet';
    else if(platKey==='saborabet') formattedPlat = 'Saborabet';
    else if(platKey==='astrobet') formattedPlat = 'AstroBet';
    else formattedPlat = platKey.toUpperCase();

    const pColor = PLATFORM_COLORS[platKey]?.primary || aiSettings?.primaryColor || '#FFDE00';
    const sColor = PLATFORM_COLORS[platKey]?.secondary || aiSettings?.secondaryColor || '#000000';

    finalPrompt += `\n\n[PLATAFORMA Y COLORES ESTRICTOS]: DEBES generar esta imagen específicamente enfocada en promocionar la marca: ${formattedPlat}. 
ES OBLIGATORIO usar la siguiente paleta de colores para esta marca: 
- Color Primario: ${pColor}
- Color Secundario: ${sColor}
Refleja abundante y creativamente estos colores en la ropa, los fondos, las decoraciones o la iluminación para que la imagen concuerde perfectamente con la marca. Evita usar colores de otras marcas.
ALERTA DE ORTOGRAFÍA: ES ESTRICTAMENTE OBLIGATORIO escribir el nombre exactamente como "${formattedPlat}". Asegúrate de usar creativa e impecablemente EL LOGO OFICIAL DE ESTA PLATAFORMA (adjunto como imagen). NO INVENTES LOGOS NI COMETAS ERRORES DE ESCRITURA, calca exactamente el logo enviado.`;
    
    if (OFFICIAL_PLATFORMS[platKey]) {
      itemsToFetch.push({ url: OFFICIAL_PLATFORMS[platKey], label: `Logo OFICIAL de la casa de apuestas ${formattedPlat}` });
    }
  } else if (useAgencyIdentity && aiSettings) {
    // Fallback to agency colors if no platform selected
    finalPrompt += `\n\n[COLORES DE LA MARCA]: Es OBLIGATORIO usar los colores de la agencia:
- Color Primario: ${aiSettings.primaryColor || '#FFDE00'}
- Color Secundario: ${aiSettings.secondaryColor || '#000000'}
Refleja abundante y creativamente estos colores en la ropa, los fondos, las decoraciones o la iluminación.`;
  }


  // Fetch all images concurrently — devolvemos resultados ORDENADOS para no depender de race-conditions
  const fetched = await Promise.all(itemsToFetch.map(async (item) => {
    try {
      const res = await fetchWithTimeout(item.url, 6000);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > 6 * 1024 * 1024) {
        console.warn(`[SOCIAL] ${item.label} pesa ${arrayBuffer.byteLength}B — descartando`);
        return null;
      }
      const mime = normalizeMime(res.headers.get('content-type'));
      if (!mime) return null;
      return {
        base64: Buffer.from(arrayBuffer).toString("base64"),
        mimeType: mime,
        label: item.label,
      };
    } catch (e) {
      console.error(`[SOCIAL] Error descargando ${item.label}:`, (e as Error).message);
      return null;
    }
  }));
  for (const r of fetched) if (r) referenceImages.push(r);

  if (useAgencyCharacter && aiSettings && aiSettings.characterImageUrl) {
    try {
      const res = await fetchWithTimeout(aiSettings.characterImageUrl, 6000);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const mime = normalizeMime(res.headers.get('content-type'));
        if (mime && arrayBuffer.byteLength <= 6 * 1024 * 1024) {
          referenceImages.push({
            base64: Buffer.from(arrayBuffer).toString("base64"),
            mimeType: mime,
            label: "Foto del Representante/Personaje de la Agencia"
          });
        }
      }
    } catch (e) {
      console.error("[SOCIAL] Error descargando personaje:", (e as Error).message);
    }
  }

  // Construir el contenido final: imágenes primero, luego texto (mejores prácticas)
  const parts: any[] = [];
  for (const refImg of referenceImages) {
    if (refImg.label) {
       parts.push({ text: `\n[ESTA IMAGEN CORRESPONDE A: ${refImg.label}]\n` });
    }
    parts.push({
      inlineData: { data: refImg.base64, mimeType: refImg.mimeType }
    });
  }
  parts.push({ text: finalPrompt });
  
  const contents = parts;

  // Timeouts reales por intento + retry inteligente (mismo patrón que /api/ai/generate)
  const PER_CALL_TIMEOUT_PRO_MS = 65_000;
  const PER_CALL_TIMEOUT_FLASH_MS = 25_000;
  const TOTAL_BUDGET_MS = 80_000;

  const callOnce = async (model: string, budgetMs: number): Promise<any> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), budgetMs);
    });
    const apiPromise = ai.models.generateContent({
      model,
      contents,
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });
    return Promise.race([apiPromise, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  };

  const hasRefImages = referenceImages.length > 0;
  const primaryModel = hasRefImages ? NANO_BANANA_PRO : NANO_BANANA_2;
  const fallbackModel = primaryModel === NANO_BANANA_PRO ? NANO_BANANA_2 : NANO_BANANA_PRO;
  const timeoutFor = (m: string) => (m === NANO_BANANA_PRO ? PER_CALL_TIMEOUT_PRO_MS : PER_CALL_TIMEOUT_FLASH_MS);

  const startedAt = Date.now();
  const remaining = () => Math.max(0, TOTAL_BUDGET_MS - (Date.now() - startedAt));
  let response: any = null;
  let modelUsed = primaryModel;

  const attempt = async (model: string): Promise<any> => {
    const budget = Math.min(timeoutFor(model), remaining());
    if (budget <= 2000) throw new Error("GEMINI_TIMEOUT");
    return callOnce(model, budget);
  };

  try {
    response = await attempt(primaryModel);
  } catch (err: any) {
    const overloaded = isOverloadedErr(err);
    const timedOut = String(err?.message || "") === "GEMINI_TIMEOUT";
    console.warn(`[SOCIAL] ${primaryModel} falló: ${err?.message || err} (overloaded=${overloaded}, timeout=${timedOut})`);

    if (overloaded && remaining() > timeoutFor(primaryModel) + 2000) {
      // 1 retry sobre el mismo modelo
      await new Promise(r => setTimeout(r, 1200 + Math.floor(Math.random() * 600)));
      try {
        response = await attempt(primaryModel);
      } catch (err2: any) {
        if (isOverloadedErr(err2) && remaining() > 5000) {
          // fallback al modelo opuesto
          console.warn(`[SOCIAL] Fallback ${primaryModel} → ${fallbackModel}`);
          response = await attempt(fallbackModel);
          modelUsed = fallbackModel;
        } else {
          throw err2;
        }
      }
    } else if (timedOut && fallbackModel === NANO_BANANA_2 && remaining() > 8000) {
      // Pro timeoutó → probar Flash una vez
      try {
        response = await attempt(fallbackModel);
        modelUsed = fallbackModel;
      } catch {
        throw err;
      }
    } else {
      throw new Error(`El modelo de imagen falló: ${err?.message || "desconocido"}`);
    }
  }

  // Detección de bloqueo por safety / promptFeedback
  const promptFeedback = response?.promptFeedback || response?.response?.promptFeedback;
  if (promptFeedback?.blockReason) {
    throw new Error(`Prompt bloqueado por políticas (${promptFeedback.blockReason}). Reformula el tema.`);
  }
  const finishReason = response?.candidates?.[0]?.finishReason;
  if (finishReason && !["STOP", "MAX_TOKENS", undefined].includes(finishReason)) {
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      throw new Error(`Imagen rechazada por filtros de seguridad (${finishReason}).`);
    }
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

  const modelNameUsed = modelUsed === NANO_BANANA_PRO ? "Nano Banana Pro 🍌" : "Nano Banana Flash ⚡";

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
