import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 140;

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const aiBackup = process.env.GEMINI_API_KEY_BACKUP
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_BACKUP })
  : null;

const FLASH_MODEL = "gemini-3.1-flash-image-preview";
const PRO_MODEL   = "gemini-3-pro-image-preview";

const HARD_TIMEOUT_MS = 125_000;
const PRO_TIMEOUT     = 65_000;
const FLASH_TIMEOUT   = 25_000;

// ── Utilidades ────────────────────────────────────────────────────────

function callGemini(client: GoogleGenAI, model: string, contents: any[], timeoutMs: number): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), timeoutMs);
  });
  const apiPromise = client.models.generateContent({
    model,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT" as any, threshold: "BLOCK_ONLY_HIGH" as any },
        { category: "HARM_CATEGORY_HATE_SPEECH" as any, threshold: "BLOCK_ONLY_HIGH" as any },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as any, threshold: "BLOCK_ONLY_HIGH" as any },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as any, threshold: "BLOCK_ONLY_HIGH" as any },
      ],
    },
  });
  return Promise.race([apiPromise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function isOverloaded(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.statusCode || err?.code;
  return (
    status === 503 || status === 500 ||
    msg.includes("503") || msg.includes("500") ||
    msg.includes("overloaded") || msg.includes("unavailable") || msg.includes("internal")
  );
}

function isEmpty(response: any): boolean {
  if (!response) return true;
  const candidates = response?.candidates;
  if (!candidates || candidates.length === 0) return true;
  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) return true;
  return false;
}

// ── Enhance prompt via GPT ────────────────────────────────────────────

async function enhancePrompt(userPrompt: string): Promise<{ text: string; wasEnhanced: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[FREE-GEN] No OPENAI_API_KEY — usando prompt tal cual");
    return { text: userPrompt, wasEnhanced: false };
  }

  const systemMsg = `Eres un DIRECTOR DE ARTE de clase mundial especializado en generación de imágenes con IA. Tu misión: transformar ideas simples en prompts MAESTROS que produzcan imágenes espectaculares, cinematográficas y de impacto visual máximo.

REGLAS ABSOLUTAS:
1. Responde ÚNICAMENTE con el prompt mejorado. CERO introducciones, explicaciones, comillas o notas.
2. Escribe en INGLÉS (los modelos de IA generan mejor en inglés).
3. Un párrafo denso y ultra-descriptivo. Incluye SIEMPRE:
   - Composición exacta (rule of thirds, leading lines, symmetry, Dutch angle)
   - Iluminación específica (golden hour, volumetric rays, rim lighting, neon glow, dramatic chiaroscuro)
   - Ángulo de cámara (low angle hero shot, aerial view, extreme close-up, wide establishing shot)
   - Paleta de colores con nombres específicos (crimson, teal, burnt orange, midnight blue)
   - Texturas y materiales (chrome, brushed metal, wet asphalt, velvet, holographic)
   - Atmósfera y mood (epic, cinematic, ethereal, gritty, luxurious)
   - Estilo artístico (photorealistic 8K, hyper-detailed CGI, award-winning photography)
   - Profundidad de campo (shallow DOF f/1.4, deep focus, tilt-shift)
4. Añade SIEMPRE: "ultra-detailed, 8K resolution, professional lighting, cinematic composition, masterpiece quality"
5. Si la idea es vaga, ELEVA creativamente al máximo nivel visual posible.
6. Máximo 300 palabras.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 600,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Error OpenAI");

    const enhanced = data.choices?.[0]?.message?.content?.trim();
    if (!enhanced) throw new Error("Respuesta vacía de GPT");

    console.log(`[FREE-GEN] ✅ Prompt mejorado OK (${enhanced.length} chars)`);
    return { text: enhanced, wasEnhanced: true };
  } catch (e: any) {
    console.error("[FREE-GEN] ❌ GPT falló:", e.message);
    return { text: userPrompt, wasEnhanced: false };
  }
}

// ── Generar con retry simple ──────────────────────────────────────────

async function generateWithRetry(
  primaryModel: string,
  contents: any[],
): Promise<{ response: any; modelUsed: string }> {
  const fallback = primaryModel === PRO_MODEL ? FLASH_MODEL : PRO_MODEL;
  const timeoutFor = (m: string) => m === PRO_MODEL ? PRO_TIMEOUT : FLASH_TIMEOUT;
  const startedAt = Date.now();

  const tryOnce = async (model: string, label: string) => {
    const budget = Math.min(timeoutFor(model), Math.max(0, HARD_TIMEOUT_MS - (Date.now() - startedAt)));
    if (budget <= 2000) throw new Error("GEMINI_TIMEOUT");
    const r = await callGemini(ai, model, contents, budget);
    if (isEmpty(r)) {
      const e = new Error("EMPTY_RESPONSE") as any;
      e.status = 503;
      throw e;
    }
    console.log(`[FREE-GEN] ${label} ${model} OK en ${Date.now() - startedAt}ms`);
    return r;
  };

  // intento#1 → wait 1s → intento#2 fallback
  try {
    const r = await tryOnce(primaryModel, "intento#1");
    return { response: r, modelUsed: primaryModel };
  } catch (e: any) {
    if (!isOverloaded(e) && String(e?.message) !== "GEMINI_TIMEOUT" && String(e?.message) !== "EMPTY_RESPONSE") throw e;
    console.warn(`[FREE-GEN] ${primaryModel} falló: ${e.message}. Intentando ${fallback}...`);
  }

  await new Promise(r => setTimeout(r, 1000));

  try {
    const r = await tryOnce(fallback, "intento#2-fallback");
    return { response: r, modelUsed: fallback };
  } catch (e: any) {
    throw e;
  }
}

// ── Format map ────────────────────────────────────────────────────────

const FORMAT_MAP: Record<string, string> = {
  square:     "Genera en formato CUADRADO 1:1 (1024×1024).",
  vertical:   "Genera en formato VERTICAL 9:16 tipo Stories/Reels (768×1365).",
  horizontal: "Genera en formato HORIZONTAL 16:9 tipo YouTube/PC (1365×768).",
  portrait:   "Genera en formato RETRATO 4:5 Instagram (819×1024).",
  landscape:  "Genera en formato PAISAJE 3:2 tipo Web/Publicidad (1228×819).",
  auto:       "",
};

// ── POST handler ──────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Solo admins
    const email = user.primaryEmailAddress?.emailAddress;
    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Acceso denegado. Solo administradores." }, { status: 403 });
    }

    const body = await request.json();
    const { prompt, imageFormat = "auto", forceModel = "auto", referenceImages: clientRefs = [] } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Escribe qué quieres generar" }, { status: 400 });
    }

    // ── 1. Mejorar prompt con GPT ─────────────────────────────────────
    // Si hay refs, avisar a GPT para que el prompt las contemple
    const promptForGpt = clientRefs.length > 0
      ? `${prompt.trim()}\n\n[NOTA: El usuario adjuntó ${clientRefs.length} imagen(es) de referencia que serán enviadas al modelo. Tu prompt DEBE mencionar que se deben integrar/replicar las referencias visuales proporcionadas.]`
      : prompt.trim();
    const { text: enhancedPrompt, wasEnhanced } = await enhancePrompt(promptForGpt);

    // ── 2. Construir prompt final con formato ─────────────────────────
    const formatStr = FORMAT_MAP[imageFormat] || "";
    let finalPrompt = formatStr
      ? `[FORMATO]: ${formatStr}\n\n${enhancedPrompt}\n\nultra-detailed, 8K resolution, professional lighting, cinematic composition, masterpiece quality.`
      : `${enhancedPrompt}\n\nultra-detailed, 8K resolution, professional lighting, cinematic composition, masterpiece quality.`;

    // ── 3. Procesar refs del usuario ──────────────────────────────────
    const referenceImages: { base64: string; mimeType: string; label: string }[] = [];

    for (let i = 0; i < Math.min(clientRefs.length, 4); i++) {
      const ref = clientRefs[i];
      if (ref?.base64 && ref?.mimeType) {
        referenceImages.push({
          base64: ref.base64,
          mimeType: ref.mimeType,
          label: `Referencia ${i + 1}`
        });
      }
    }

    // Inyectar instrucciones obligatorias de uso de referencias
    if (referenceImages.length > 0) {
      finalPrompt += `\n\n[IMÁGENES DE REFERENCIA — USO OBLIGATORIO]:
El usuario adjuntó ${referenceImages.length} imagen(es) de referencia (etiquetadas ARRIBA). Estas imágenes NO son decorativas: son CRÍTICAS y deben influir directamente en la imagen final.
Reglas:
1. Si las referencias muestran personas, productos u objetos concretos, INCLÚYELOS preservando su apariencia (rostro, forma, colores, vestuario).
2. Si la referencia es un estilo visual o paleta, aplícalo a toda la composición.
3. Combina coherentemente TODAS las referencias entre sí y con el prompt textual.
4. NO ignores ninguna referencia. Si es ambigua, intégrala como contexto/atmósfera.
5. Mantén la calidad y proporción solicitadas.`;
    }

    // ── 4. Seleccionar modelo ─────────────────────────────────────────
    let model: string;
    if (forceModel === "pro") {
      model = PRO_MODEL;
    } else if (forceModel === "flash") {
      model = FLASH_MODEL;
    } else {
      // Auto: Pro si hay refs, Flash si no
      model = referenceImages.length > 0 ? PRO_MODEL : FLASH_MODEL;
    }

    // ── 5. Construir contenido para Gemini ────────────────────────────
    const contents: any[] = [];
    for (const img of referenceImages) {
      contents.push({ text: `\n[IMAGEN DE REFERENCIA: ${img.label} — INTEGRAR OBLIGATORIAMENTE en la imagen final]\n` });
      contents.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
    contents.push({ text: finalPrompt });

    console.log(`[FREE-GEN] modelo=${model}, refs=${referenceImages.length}, prompt=${finalPrompt.length} chars`);

    // ── 6. Generar ────────────────────────────────────────────────────
    const startedAt = Date.now();
    const { response, modelUsed } = await generateWithRetry(model, contents);
    console.log(`[FREE-GEN] Completado en ${Date.now() - startedAt}ms con ${modelUsed}`);

    // Extraer imagen
    let imageBase64: string | null = null;
    let imageMimeType = "image/png";
    for (const part of (response as any).candidates?.[0]?.content?.parts || []) {
      if ((part as any).inlineData) {
        imageBase64 = (part as any).inlineData.data;
        imageMimeType = (part as any).inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageBase64) {
      throw new Error("Gemini no devolvió una imagen. Intenta reformular el prompt.");
    }

    // ── 7. Guardar en Supabase ────────────────────────────────────────
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
    const fileName = `free_${user.id}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("ai-generations")
      .upload(fileName, imageBuffer, { contentType: imageMimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("ai-generations")
      .getPublicUrl(fileName);

    const finalUrl = publicUrlData.publicUrl;

    // Guardar en ai_images con prefix para separar del historial de Estudio IA
    const { error: dbError } = await supabase.from("ai_images").insert({
      prompt: `🎨 Libre: ${prompt.trim()}`,
      image_url: finalUrl,
      author_id: email,
      author_name: user.fullName || "Admin",
      author_avatar_url: user.imageUrl,
    });

    if (dbError) {
      console.error("[FREE-GEN] Error guardando en ai_images:", dbError.message);
    }

    return NextResponse.json({
      success: true,
      imageUrl: finalUrl,
      enhancedPrompt,
      wasEnhanced,
      model: modelUsed === PRO_MODEL ? "Pro 🍌" : "Flash ⚡",
    });

  } catch (error: any) {
    console.error("[FREE-GEN ERROR]", error?.message, error?.stack?.split("\n").slice(0, 3).join(" | "));

    const msg = String(error?.message || "");
    const isTimeout = msg === "GEMINI_TIMEOUT" || msg.includes("abort");

    let friendlyMsg: string;
    let httpStatus = 500;

    if (isTimeout) {
      friendlyMsg = "La generación tardó demasiado. Intenta con un prompt más simple.";
      httpStatus = 504;
    } else if (msg.includes("bloqueado") || msg.includes("SAFETY") || msg.includes("PROHIBITED")) {
      friendlyMsg = "El contenido fue bloqueado por filtros de seguridad. Reformula el prompt.";
      httpStatus = 400;
    } else {
      friendlyMsg = msg || "Error generando la imagen. Inténtalo de nuevo.";
    }

    return NextResponse.json({ error: friendlyMsg }, { status: httpStatus });
  }
}

// ── GET: Historial del generador libre ────────────────────────────────

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const email = user.primaryEmailAddress?.emailAddress;
    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { data } = await supabase
      .from("ai_images")
      .select("*")
      .like("prompt", "🎨 Libre:%")
      .eq("author_id", email)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ images: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

