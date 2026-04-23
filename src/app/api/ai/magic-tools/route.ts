import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";
import { spendCredits, refundCredits, ensureSeeded, logRefundFailure, InsufficientCreditsError } from "@/lib/credits";

export const maxDuration = 300;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Fetch image as base64
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get("content-type") || "image/png";
    return { base64: Buffer.from(buf).toString("base64"), mimeType };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { toolId, sourceImageUrl, prompt, credits } = await request.json();

    if (!toolId || !sourceImageUrl || !prompt) {
      return NextResponse.json({ error: "Faltan datos requeridos." }, { status: 400 });
    }

    // 1. Descuento atómico de créditos (inmune a race conditions)
    const cost = Math.min(Math.max(credits || 25, 25), 500); // Clamp 25-500
    const idempotencyKey = request.headers.get("x-idempotency-key") || `magic_${user.id}_${toolId}_${Date.now()}`;

    // Siembra one-time desde Clerk metadata para usuarios existentes
    await ensureSeeded(user.id, Number(user.publicMetadata?.credits || 0));

    let newBalance: number;
    let ledgerId: string;
    try {
      const r = await spendCredits({
        userId: user.id,
        amount: cost,
        relatedId: `magic_${toolId}_${Date.now()}`,
        idempotencyKey,
        note: `Editor PRO: ${toolId}`,
      });
      newBalance = r.newBalance;
      ledgerId = r.ledgerId;
    } catch (e: any) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json({
          error: `Créditos insuficientes. Necesitas ${cost} créditos. Tienes ${e.have}.`,
          credits: e.have,
          cost,
        }, { status: 402 });
      }
      console.error("[credits] spend failed:", e);
      return NextResponse.json({ error: "Error verificando créditos." }, { status: 500 });
    }

    const client = await clerkClient();
    client.users.updateUserMetadata(user.id, {
      publicMetadata: { credits: newBalance },
    }).catch(() => {});

    try {
      // 3. Fetch the source image
      const sourceImage = await fetchImageAsBase64(sourceImageUrl);
      if (!sourceImage) {
        throw new Error("No se pudo cargar la imagen original.");
      }

      // 4. Build Gemini request
      const contents: any[] = [
        { text: prompt },
        {
          inlineData: {
            mimeType: sourceImage.mimeType,
            data: sourceImage.base64,
          },
        },
      ];

      // 5. Call Gemini with retries + model fallback
      // ═══ OPTIMIZACIÓN CRÍTICA DE COSTOS ═══
      // Usamos gemini-3.1-flash-image-preview para TODO. Pro es demasiado costoso (-90% token cost).
      const PRIMARY_MODEL = "gemini-3.1-flash-image-preview";
      const FALLBACK_MODEL = "gemini-3-pro-image-preview";
      const MAX_RETRIES = 2;
      let response;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Use fallback model on retry attempts
        const currentModel = attempt >= 2 ? FALLBACK_MODEL : PRIMARY_MODEL;
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 60_000);

        try {
          console.log(`🪄 Editor PRO [${toolId}] Intento ${attempt}/${MAX_RETRIES} con ${currentModel}...`);
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config: { responseModalities: ["TEXT", "IMAGE"] },
          });
          clearTimeout(timeout);
          break;
        } catch (retryErr: any) {
          clearTimeout(timeout);
          lastErr = retryErr;
          const msg = retryErr?.message || JSON.stringify(retryErr);
          const isTransient = msg.includes("503") || msg.includes("502") || msg.includes("500") || msg.includes("429")
            || msg.includes("UNAVAILABLE") || msg.includes("RESOURCE_EXHAUSTED")
            || msg.includes("INTERNAL") || msg.includes("internal error")
            || msg.includes("Internal error") || msg.includes("overloaded")
            || msg.includes("Bad Gateway") || msg.includes("bad gateway")
            || msg.includes("DEADLINE_EXCEEDED") || msg.includes("deadline");
          if (isTransient && attempt < MAX_RETRIES) {
            const backoff = 1500;
            console.warn(`⏳ Editor PRO error transitorio → reintento ${attempt} en 1.5s con ${FALLBACK_MODEL}...`);
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          throw retryErr;
        }
      }

      if (!response) throw lastErr || new Error("Sin respuesta del modelo.");

      // 6. Extract generated image
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
        throw new Error("La IA no devolvió una imagen. Intenta con otra herramienta o reformula la petición.");
      }

      // 7. Save to Supabase Storage
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
      const fileName = `magic_${toolId}_${user.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ai-generations")
        .upload(fileName, imageBuffer, { contentType: imageMimeType, upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("ai-generations")
        .getPublicUrl(fileName);

      const finalUrl = publicUrlData.publicUrl;

      // 8. Save to history
      await supabase.from("ai_images").insert({
        prompt: `[Editor PRO: ${toolId}] ${prompt}`,
        image_url: finalUrl,
        author_id: user.primaryEmailAddress?.emailAddress,
        author_name: user.fullName || user.firstName || "Agente",
        author_avatar_url: user.imageUrl,
      });

      return NextResponse.json({
        success: true,
        imageUrl: finalUrl,
        balance: newBalance,
        toolId,
      });

    } catch (apiError: any) {
      try {
        const r = await refundCredits({
          userId: user.id,
          amount: cost,
          relatedId: ledgerId,
          idempotencyKey: `refund_${ledgerId}`,
          note: `refund: ${String(apiError?.message || "magic tool failure").slice(0, 120)}`,
        });
        client.users.updateUserMetadata(user.id, {
          publicMetadata: { credits: r.newBalance },
        }).catch(() => {});
      } catch (refundErr) {
        console.error("⚠️ Error reembolsando créditos:", refundErr);
        await logRefundFailure({
          userId: user.id,
          amount: cost,
          relatedId: ledgerId,
          error: String(refundErr),
        });
      }

      const rawMsg = apiError?.message || String(apiError);
      console.error(`[Editor PRO ${toolId}] Error:`, rawMsg.slice(0, 500));

      const isTimeout = apiError?.name === "AbortError" || rawMsg.includes("DEADLINE_EXCEEDED");
      const is502 = rawMsg.includes("502") || rawMsg.includes("Bad Gateway");
      const is503 = rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE");
      const is429 = rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED");
      const isInternal = rawMsg.includes("INTERNAL") || rawMsg.includes("Internal error") || rawMsg.includes("500");

      let friendlyMsg: string;
      if (isTimeout) {
        friendlyMsg = "⏳ La IA tardó demasiado. Intenta de nuevo en unos momentos. Créditos reembolsados.";
      } else if (is502) {
        friendlyMsg = "🌐 Error de conexión con la IA (Bad Gateway). El servidor está procesando muchas solicitudes. Espera 1 minuto e intenta de nuevo. Créditos reembolsados.";
      } else if (is503) {
        friendlyMsg = "🔥 Servidores IA saturados. Espera 2 minutos e intenta de nuevo. Créditos reembolsados.";
      } else if (is429) {
        friendlyMsg = "⚡ Demasiadas solicitudes. Espera 30 segundos. Créditos reembolsados.";
      } else if (isInternal) {
        friendlyMsg = "🔧 La IA tuvo un error interno. Intenta de nuevo o prueba con otra herramienta. Créditos reembolsados.";
      } else {
        friendlyMsg = `❌ Error al procesar: ${rawMsg.slice(0, 100)}. Créditos reembolsados.`;
      }

      return NextResponse.json({ error: friendlyMsg }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[Editor PRO] Error crítico:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
