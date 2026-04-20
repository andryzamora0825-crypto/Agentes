import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 300;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3-pro-image-preview"; // Pro for highest quality editing

// Fetch image as base64
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
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

    // 1. Check credits
    const currentCredits = Number(user.publicMetadata?.credits || 0);
    const cost = Math.min(Math.max(credits || 100, 50), 500); // Clamp 50-500

    if (currentCredits < cost) {
      return NextResponse.json({
        error: `Créditos insuficientes. Necesitas ${cost} créditos. Tienes ${currentCredits}.`,
        credits: currentCredits,
        cost,
      }, { status: 402 });
    }

    // 2. Deduct credits preemptively
    const newBalance = currentCredits - cost;
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: { credits: newBalance },
    });

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

      // 5. Call Gemini with retries
      const MAX_RETRIES = 3;
      let response;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 120_000);

        try {
          console.log(`🪄 Editor PRO [${toolId}] Intento ${attempt}/${MAX_RETRIES}...`);
          response = await ai.models.generateContent({
            model: MODEL,
            contents,
            config: { responseModalities: ["TEXT", "IMAGE"] },
          });
          clearTimeout(timeout);
          break;
        } catch (retryErr: any) {
          clearTimeout(timeout);
          lastErr = retryErr;
          const msg = retryErr?.message || JSON.stringify(retryErr);
          const isTransient = msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE") || msg.includes("RESOURCE_EXHAUSTED");
          if (isTransient && attempt < MAX_RETRIES) {
            console.warn(`⏳ Editor PRO retry ${attempt}...`);
            await new Promise(r => setTimeout(r, 2000 * attempt));
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
        prompt: `[Editor PRO: ${toolId}] ${prompt.slice(0, 200)}`,
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
      // Refund credits on failure
      try {
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: { credits: currentCredits },
        });
      } catch (refundErr) {
        console.error("⚠️ Error reembolsando créditos:", refundErr);
      }

      const rawMsg = apiError?.message || String(apiError);
      console.error(`[Editor PRO ${toolId}] Error:`, rawMsg.slice(0, 500));

      const isTimeout = apiError?.name === "AbortError";
      const is503 = rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE");
      const is429 = rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED");

      let friendlyMsg: string;
      if (isTimeout) {
        friendlyMsg = "⏳ La IA tardó demasiado. Intenta de nuevo en unos momentos. Créditos reembolsados.";
      } else if (is503) {
        friendlyMsg = "🔥 Servidores IA saturados. Espera 2 minutos e intenta de nuevo. Créditos reembolsados.";
      } else if (is429) {
        friendlyMsg = "⚡ Demasiadas solicitudes. Espera 30 segundos. Créditos reembolsados.";
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
