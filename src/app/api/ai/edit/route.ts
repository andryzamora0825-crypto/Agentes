import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 120;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Pro es mejor para edición de imágenes existentes (alta fidelidad + referencia)
const EDIT_MODEL = "gemini-3-pro-image-preview";

// Helper: fetch con timeout
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
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

    // 1. Verificación de créditos (edición = 75 créditos, mitad de generación)
    const currentCredits = Number(user.publicMetadata?.credits || 0);
    const cost = 75;

    if (currentCredits < cost) {
      return NextResponse.json({
        error: "Créditos insuficientes",
        credits: currentCredits,
        cost,
      }, { status: 402 });
    }

    // 2. Descontar créditos preventivamente
    const newBalance = currentCredits - cost;
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: { credits: newBalance },
    });

    try {
      // 3. Descargar la imagen original para enviarla como referencia
      const imgRes = await fetchWithTimeout(sourceImageUrl, 10000);
      if (!imgRes.ok) throw new Error("No se pudo descargar la imagen original");

      const arrayBuffer = await imgRes.arrayBuffer();
      const mimeType = imgRes.headers.get("content-type") || "image/png";
      const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

      // 4. Construir prompt de edición
      const finalPrompt = `[INSTRUCCIÓN DE EDICIÓN DE IMAGEN]: Estás recibiendo una imagen ya existente. Tu tarea es editarla siguiendo EXACTAMENTE las instrucciones del usuario. NO generes una imagen nueva desde cero. MODIFICA la imagen proporcionada aplicando únicamente los cambios solicitados. Mantén TODO lo demás igual (composición, personas, fondos, logos, texto, etc.).

Instrucciones de edición del usuario: "${editPrompt}"

REGLAS ESTRICTAS:
- SOLO modifica lo que el usuario pidió. No cambies nada más.
- Mantén la misma resolución, proporciones y estilo general.
- Si el usuario pide cambiar un color, cámbialo SOLO donde indicó.
- Si el usuario pide agregar algo, agrégalo sin destruir el resto de la imagen.
- Si el usuario pide quitar algo, quítalo y rellena el espacio de forma natural.`;

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

      // 5. Enviar a Gemini Pro
      const abortController = new AbortController();
      const geminiTimeout = setTimeout(() => abortController.abort(), 90_000);

      let response;
      try {
        response = await ai.models.generateContent({
          model: EDIT_MODEL,
          contents,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });
      } finally {
        clearTimeout(geminiTimeout);
      }

      // 6. Extraer imagen editada
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
        console.warn("⚠️ Gemini Edit respondió solo texto:", textParts.slice(0, 200));
        throw new Error("La IA no devolvió una imagen editada. Intenta reformular la edición.");
      }

      // 7. Guardar imagen editada en Supabase
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

      // 8. Guardar registro en BD
      const { error: dbError } = await supabase.from("ai_images").insert({
        prompt: `✏️ Edición: ${editPrompt}`,
        image_url: finalUrl,
        author_id: user.primaryEmailAddress?.emailAddress,
        author_name: user.fullName || user.firstName || "Agente",
        author_avatar_url: user.imageUrl,
      });

      if (dbError) throw dbError;

      return NextResponse.json({
        success: true,
        imageUrl: finalUrl,
        balance: newBalance,
        model: "Nano Banana Pro ✏️",
      });

    } catch (apiError: any) {
      // Revertir pago si falló
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: { credits: currentCredits },
      });

      const isTimeout = apiError?.name === "AbortError" || apiError?.message?.includes("abort");
      const friendlyMsg = isTimeout
        ? "La edición tardó demasiado (>90s). Tus créditos fueron reembolsados."
        : apiError?.message || "Error en la edición. Tus créditos han sido reembolsados.";

      console.error("Error en edición IA:", apiError?.message || apiError);
      return NextResponse.json({ error: friendlyMsg }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Error crítico en ruta AI edit:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
