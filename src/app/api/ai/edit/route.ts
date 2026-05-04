import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 90;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const EDIT_MODEL = "gemini-3-pro-image-preview";

const GEMINI_HARD_TIMEOUT_MS = 75_000;
const REF_FETCH_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string, timeoutMs = REF_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refundCredits(client: any, userId: string, amount: number) {
  try {
    const fresh = await client.users.getUser(userId);
    const current = Number(fresh.publicMetadata?.credits || 0);
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...fresh.publicMetadata, credits: current + amount },
    });
    return current + amount;
  } catch (e) {
    console.error("[CREDITS] Reembolso falló — registrar para reconciliación:", { userId, amount, error: (e as Error).message });
    return null;
  }
}

function isOverloaded(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.statusCode || err?.code;
  return (
    status === 503 ||
    status === 429 ||
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted")
  );
}

async function generateWithTimeoutAndRetry(contents: any[]): Promise<any> {
  const callOnce = () => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), GEMINI_HARD_TIMEOUT_MS);
    });
    const apiPromise = ai.models.generateContent({
      model: EDIT_MODEL,
      contents,
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });
    return Promise.race([apiPromise, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  };

  try {
    return await callOnce();
  } catch (err: any) {
    if (isOverloaded(err)) {
      console.warn("[GEMINI EDIT] 503/overloaded — reintentando una vez tras 1.5s");
      await new Promise(r => setTimeout(r, 1500));
      return await callOnce();
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { editPrompt, sourceImageUrl } = body;

    if (!editPrompt?.trim()) {
      return NextResponse.json({ error: "Falta el prompt de edición" }, { status: 400 });
    }
    if (!sourceImageUrl) {
      return NextResponse.json({ error: "Falta la imagen a editar" }, { status: 400 });
    }

    const currentCredits = Number(user.publicMetadata?.credits || 0);
    const cost = 75;

    if (currentCredits < cost) {
      return NextResponse.json({
        error: "Créditos insuficientes",
        credits: currentCredits,
        cost,
      }, { status: 402 });
    }

    const newBalance = currentCredits - cost;
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: { ...user.publicMetadata, credits: newBalance },
    });

    let creditsRefunded = false;

    try {
      const imgRes = await fetchWithTimeout(sourceImageUrl, REF_FETCH_TIMEOUT_MS);
      if (!imgRes.ok) throw new Error("No se pudo descargar la imagen original");

      const arrayBuffer = await imgRes.arrayBuffer();
      let mimeType = (imgRes.headers.get("content-type") || "image/png").toLowerCase().split(";")[0].trim();
      if (mimeType === "image/jpg") mimeType = "image/jpeg";
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        mimeType = "image/png";
      }
      if (arrayBuffer.byteLength > 6 * 1024 * 1024) {
        throw new Error("La imagen original supera 6MB. Pro la rechaza. Usa una versión más liviana.");
      }
      const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

      const finalPrompt = `[INSTRUCCIÓN DE EDICIÓN DE IMAGEN]: Estás recibiendo una imagen ya existente. Tu tarea es editarla siguiendo EXACTAMENTE las instrucciones del usuario. NO generes una imagen nueva desde cero. MODIFICA la imagen proporcionada aplicando únicamente los cambios solicitados. Mantén TODO lo demás igual (composición, personas, fondos, logos, texto, etc.).

Instrucciones de edición del usuario: "${editPrompt}"

REGLAS ESTRICTAS:
- SOLO modifica lo que el usuario pidió. No cambies nada más.
- Mantén la misma resolución, proporciones y estilo general.
- Si el usuario pide cambiar un color, cámbialo SOLO donde indicó.
- Si el usuario pide agregar algo, agrégalo sin destruir el resto de la imagen.
- Si el usuario pide quitar algo, quítalo y rellena el espacio de forma natural.
- ANTI-SUPERPOSICIÓN: cualquier texto, logo o número debe ir en zonas limpias, sin tapar rostros, manos ni el sujeto principal. Si tu edición introduce nuevos elementos, colócalos en espacios negativos.
- VISIBILIDAD DEL TEXTO PRINCIPAL: si la imagen contiene o tu edición agrega texto del contenido principal (titulares, mensajes, eslóganes, números, premios, fechas, montos, llamados a la acción), DEBE quedar 100% visible y 100% legible. Cada letra entera, ningún carácter tapado por objetos, manos, brazos, productos o elementos del primer plano, sin recortes en bordes, sin deformación. Si la edición introduciría una obstrucción, reubica el texto o el objeto antes de renderizar.`;

      const contents: any[] = [
        { text: finalPrompt },
        { text: "\n[ESTA ES LA IMAGEN ORIGINAL A EDITAR]:\n" },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ];

      const response: any = await generateWithTimeoutAndRetry(contents);

      const promptFeedback = response?.promptFeedback || response?.response?.promptFeedback;
      if (promptFeedback?.blockReason) {
        console.warn("[GEMINI EDIT] prompt bloqueado:", promptFeedback);
        throw new Error(`El prompt fue bloqueado por las políticas del modelo (${promptFeedback.blockReason}). Reformula la edición.`);
      }
      const finishReason = response?.candidates?.[0]?.finishReason;
      if (finishReason && !["STOP", "MAX_TOKENS", undefined].includes(finishReason)) {
        if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
          throw new Error(`Edición rechazada por filtros de seguridad (${finishReason}). Suaviza el prompt.`);
        }
      }

      let editedBase64: string | null = null;
      let editedMimeType = "image/png";

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if ((part as any).inlineData) {
          editedBase64 = (part as any).inlineData.data;
          editedMimeType = (part as any).inlineData.mimeType || "image/png";
          break;
        }
      }

      if (!editedBase64) {
        const textParts = response.candidates?.[0]?.content?.parts
          ?.filter((p: any) => p.text)
          ?.map((p: any) => p.text)
          ?.join(" ") || "";
        console.warn("[GEMINI EDIT] respondió solo texto:", textParts.slice(0, 200));
        throw new Error("La IA no devolvió una imagen editada. Intenta reformular la edición.");
      }

      const imageBuffer = Buffer.from(editedBase64, "base64");
      const ext = editedMimeType.includes("jpeg") ? "jpg" : "png";
      const fileName = `edit_${user.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ai-generations")
        .upload(fileName, imageBuffer, {
          contentType: editedMimeType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("ai-generations")
        .getPublicUrl(fileName);

      const finalUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase.from("ai_images").insert({
        prompt: `✏️ Edición: ${editPrompt}`,
        image_url: finalUrl,
        author_id: user.primaryEmailAddress?.emailAddress,
        author_name: user.fullName || user.firstName || "Agente",
        author_avatar_url: user.imageUrl,
      });

      if (dbError) {
        await supabase.storage.from("ai-generations").remove([fileName]).catch(() => {});
        throw dbError;
      }

      return NextResponse.json({
        success: true,
        imageUrl: finalUrl,
        balance: newBalance,
        model: "Nano Banana Pro ✏️",
      });

    } catch (apiError: any) {
      if (!creditsRefunded) {
        creditsRefunded = true;
        await refundCredits(client, user.id, cost);
      }

      const msg = String(apiError?.message || "");
      const status = apiError?.status || apiError?.statusCode || apiError?.code;
      const isTimeout = apiError?.name === "AbortError" || msg === "GEMINI_TIMEOUT" || msg.includes("abort");
      const overloaded = isOverloaded(apiError);
      const isInvalidArg = status === 400 || msg.toLowerCase().includes("invalid_argument");
      const isInternal = status === 500 || msg.toLowerCase().includes("internal");

      let friendlyMsg: string;
      let httpStatus = 500;
      if (isTimeout) {
        friendlyMsg = "La edición tardó demasiado (>75s). Tus créditos fueron reembolsados.";
        httpStatus = 504;
      } else if (overloaded) {
        friendlyMsg = "El modelo está saturado (503). Intenta de nuevo en unos segundos. Tus créditos fueron reembolsados.";
        httpStatus = 503;
      } else if (isInvalidArg) {
        friendlyMsg = "El modelo rechazó la imagen original (formato no soportado o demasiado grande). Créditos reembolsados.";
        httpStatus = 400;
      } else if (isInternal) {
        friendlyMsg = `Pro devolvió 500 INTERNAL en la edición. Suele pasar con imágenes grandes o prompts muy complejos. Intenta con una imagen más liviana o un prompt más corto. Créditos reembolsados.`;
        httpStatus = 500;
      } else {
        friendlyMsg = msg || "Error en la edición. Tus créditos han sido reembolsados.";
      }

      console.error("[GEMINI EDIT ERROR]", { msg, status, isTimeout, overloaded, isInvalidArg, isInternal });
      return NextResponse.json({ error: friendlyMsg, refunded: true }, { status: httpStatus });
    }

  } catch (error: any) {
    console.error("Error crítico en ruta AI edit:", error?.message, error?.stack);
    return NextResponse.json({
      error: `Error interno: ${error?.message || "desconocido"}`,
    }, { status: 500 });
  }
}
