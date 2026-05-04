import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { createPost } from "@/lib/services/social-posts.service";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 120;

const NANO_BANANA_FLASH = "gemini-3.1-flash-image-preview";
const NANO_BANANA_PRO = "gemini-3-pro-image-preview";
const COST_PER_AGENCY = 150;

const PER_CALL_TIMEOUT_FLASH = 25_000;
const PER_CALL_TIMEOUT_PRO = 55_000;
const TOTAL_BUDGET_PER_AGENCY = 70_000;
const REF_FETCH_TIMEOUT = 6_000;

function isOverloaded(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.statusCode || err?.code;
  return (
    status === 503 || status === 429 || status === 500 ||
    msg.includes("503") || msg.includes("500") || msg.includes("internal") ||
    msg.includes("overloaded") ||
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

async function fetchWithTimeout(url: string, timeoutMs = REF_FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function callGemini(ai: GoogleGenAI, model: string, contents: any[], perCallMs: number): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), perCallMs);
  });
  const apiPromise = ai.models.generateContent({
    model,
    contents,
    config: { responseModalities: ["TEXT", "IMAGE"] },
  });
  return Promise.race([apiPromise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function generateBroadcastImageWithRetry(
  ai: GoogleGenAI,
  primaryModel: string,
  contents: any[],
): Promise<{ response: any; modelUsed: string }> {
  const fallbackModel = primaryModel === NANO_BANANA_PRO ? NANO_BANANA_FLASH : NANO_BANANA_PRO;
  const timeoutFor = (m: string) => (m === NANO_BANANA_PRO ? PER_CALL_TIMEOUT_PRO : PER_CALL_TIMEOUT_FLASH);
  const startedAt = Date.now();
  const remaining = () => Math.max(0, TOTAL_BUDGET_PER_AGENCY - (Date.now() - startedAt));

  const tryOnce = async (model: string) => {
    const budget = Math.min(timeoutFor(model), remaining());
    if (budget <= 2000) throw new Error("GEMINI_TIMEOUT");
    return callGemini(ai, model, contents, budget);
  };

  try {
    return { response: await tryOnce(primaryModel), modelUsed: primaryModel };
  } catch (err: any) {
    const overloaded = isOverloaded(err);
    const timedOut = String(err?.message || "") === "GEMINI_TIMEOUT";
    if (!overloaded && !timedOut) throw err;

    if (overloaded && remaining() > timeoutFor(primaryModel) + 2000) {
      await new Promise(r => setTimeout(r, 1200 + Math.floor(Math.random() * 500)));
      try {
        return { response: await tryOnce(primaryModel), modelUsed: primaryModel };
      } catch (err2: any) {
        if (isOverloaded(err2) && remaining() > 5000) {
          return { response: await tryOnce(fallbackModel), modelUsed: fallbackModel };
        }
        throw err2;
      }
    }
    if (timedOut && fallbackModel === NANO_BANANA_FLASH && remaining() > 8000) {
      try {
        return { response: await tryOnce(fallbackModel), modelUsed: fallbackModel };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

async function debitCredits(client: any, adminId: string, cost: number): Promise<boolean> {
  const adminUser = await client.users.getUser(adminId);
  const current = Number(adminUser.publicMetadata?.credits || 0);
  if (current < cost) return false;
  await client.users.updateUserMetadata(adminId, {
    publicMetadata: { ...adminUser.publicMetadata, credits: current - cost },
  });
  return true;
}

async function refundCredits(client: any, adminId: string, cost: number) {
  try {
    const fresh = await client.users.getUser(adminId);
    const current = Number(fresh.publicMetadata?.credits || 0);
    await client.users.updateUserMetadata(adminId, {
      publicMetadata: { ...fresh.publicMetadata, credits: current + cost },
    });
  } catch (e) {
    console.error("[BROADCAST] Reembolso falló — registrar reconciliación:", { adminId, cost, err: (e as Error).message });
  }
}

async function processOneAgency(
  ai: GoogleGenAI,
  openai: OpenAI,
  client: any,
  adminId: string,
  imagePrompt: string,
  adminSetting: any,
): Promise<{ success: boolean; reason?: string }> {
  // 1. Debitar créditos
  const debited = await debitCredits(client, adminId, COST_PER_AGENCY);
  if (!debited) return { success: false, reason: "Créditos insuficientes" };

  let creditsRefunded = false;

  try {
    // 2. Cargar settings IA y logo (con cap y normalización)
    const adminUser = await client.users.getUser(adminId);
    const aiSettings: any = adminUser.publicMetadata?.aiSettings || {};

    let finalPrompt = imagePrompt;
    const parts: any[] = [];

    const logoUrl = aiSettings.agencyLogoUrl || aiSettings.logoUrl;
    if (logoUrl) {
      try {
        const res = await fetchWithTimeout(logoUrl, REF_FETCH_TIMEOUT);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const mime = normalizeMime(res.headers.get("content-type"));
          if (mime && arrayBuffer.byteLength <= 6 * 1024 * 1024) {
            parts.push({ text: `\n[ESTA IMAGEN CORRESPONDE A: Logo de la Agencia]\n` });
            parts.push({
              inlineData: { mimeType: mime, data: Buffer.from(arrayBuffer).toString("base64") },
            });
            finalPrompt += `\n[INSTRUCCIÓN]: Incluye el logotipo en una zona limpia, sin tapar texto principal ni rostros.`;
          }
        }
      } catch (e) {
        console.warn(`[BROADCAST ${adminId}] logo no se pudo cargar:`, (e as Error).message);
      }
    }
    parts.push({ text: finalPrompt });

    // 3. Generar imagen con retry/fallback
    const primaryModel = parts.length > 1 ? NANO_BANANA_PRO : NANO_BANANA_FLASH;
    const { response, modelUsed } = await generateBroadcastImageWithRetry(ai, primaryModel, parts);

    // 4. Validar safety
    const promptFeedback = (response as any)?.promptFeedback;
    if (promptFeedback?.blockReason) {
      throw new Error(`Prompt bloqueado (${promptFeedback.blockReason})`);
    }
    const finishReason = (response as any)?.candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      throw new Error(`Imagen rechazada por filtros (${finishReason})`);
    }

    let imageBase64: string | null = null;
    let imageMimeType = "image/png";
    for (const part of (response as any).candidates?.[0]?.content?.parts || []) {
      if ((part as any).inlineData) {
        imageBase64 = (part as any).inlineData.data;
        imageMimeType = (part as any).inlineData.mimeType || "image/png";
        break;
      }
    }
    if (!imageBase64) throw new Error("Gemini no devolvió imagen (texto solamente)");

    // 5. Subir a Storage
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
    const fileName = `broadcast_${adminId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("ai-generations")
      .upload(fileName, imageBuffer, { contentType: imageMimeType, upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from("ai-generations").getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // 6. Generar copy persuasivo (con timeout)
    let copy = "¡Nueva campaña activa!";
    try {
      const copyTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("COPY_TIMEOUT")), 15_000),
      );
      const copyPromise = openai.chat.completions.create({
        messages: [{
          role: "system",
          content: `Eres social media manager experto. Escribe un copy persuasivo y corto para esta campaña con tono "${adminSetting.brand_voice || "dinámico"}". Entrega solo el copy con 2-3 hashtags. Contexto: "${imagePrompt}"`,
        }],
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 300,
      });
      const completion: any = await Promise.race([copyPromise, copyTimeout]);
      copy = completion.choices[0]?.message?.content?.trim() || copy;
    } catch (e) {
      console.warn(`[BROADCAST ${adminId}] copy fallback (sin OpenAI):`, (e as Error).message);
    }

    // 7. Guardar post
    await createPost({
      user_id: adminId,
      caption: copy,
      image_url: imageUrl,
      image_prompt: imagePrompt,
      status: "approved",
      platform: adminSetting.moderator_target_network || adminSetting.default_platform || "facebook",
    });

    console.log(`[BROADCAST ${adminId}] OK con ${modelUsed}`);
    return { success: true };
  } catch (err: any) {
    if (!creditsRefunded) {
      creditsRefunded = true;
      await refundCredits(client, adminId, COST_PER_AGENCY);
    }
    console.error(`[BROADCAST ${adminId}] FAIL:`, err?.message || err);
    return { success: false, reason: err?.message || "error desconocido" };
  }
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ isModerator: false });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const { data, error } = await supabase
      .from("social_settings")
      .select("id")
      .contains("moderators_list", [userEmail])
      .limit(1)
      .single();

    if (!error && data) return NextResponse.json({ isModerator: true });
    return NextResponse.json({ isModerator: false });
  } catch {
    return NextResponse.json({ isModerator: false });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado. Sistema bloqueado." }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const body = await request.json();
    const { imagePrompt } = body;

    if (!imagePrompt) {
      return NextResponse.json({ error: "Falta la señal del Prompt." }, { status: 400 });
    }

    const { data: allSettings, error: fetchErr } = await supabase
      .from("social_settings")
      .select("*")
      .contains("moderators_list", [userEmail]);

    if (fetchErr) throw fetchErr;
    if (!allSettings || allSettings.length === 0) {
      return NextResponse.json({ error: "No tienes flujos de automatización configurados en tu cuenta." }, { status: 403 });
    }

    if (!process.env.GEMINI_API_KEY || !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Faltan credenciales maestras del sistema." }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const client = await clerkClient();

    // Procesar agencias en PARALELO dentro de la misma lambda (síncrono garantizado, sin "fire and forget").
    // Promise.allSettled asegura que un fallo en una agencia no aborta las demás.
    const results = await Promise.allSettled(
      allSettings.map(adminSetting =>
        processOneAgency(ai, openai, client, adminSetting.user_id, imagePrompt, adminSetting),
      ),
    );

    const succeeded = results.filter(r => r.status === "fulfilled" && (r.value as any).success).length;
    const failed = results.length - succeeded;
    const reasons = results
      .map((r, i) => {
        if (r.status === "rejected") return { agency: allSettings[i].user_id, reason: String(r.reason) };
        if (!(r.value as any).success) return { agency: allSettings[i].user_id, reason: (r.value as any).reason };
        return null;
      })
      .filter(Boolean);

    return NextResponse.json({
      success: succeeded > 0,
      total: results.length,
      succeeded,
      failed,
      message: `Broadcast desplegó ${succeeded}/${results.length} agencias.`,
      failures: reasons,
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error auto-broadcast masivo:", error?.message, error?.stack);
    return NextResponse.json(
      { error: `Error procesando broadcast: ${error?.message || "desconocido"}` },
      { status: 500 },
    );
  }
}
