import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Nano Banana 2 — capa gratuita + de pago, texto a imagen
const NANO_BANANA_2   = "gemini-3.1-flash-image-preview";
// Nano Banana Pro — requiere billing, alta fidelidad + imágenes de referencia
const NANO_BANANA_PRO = "gemini-3-pro-image-preview";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Aceptar FormData (con imágenes de referencia opcionales) o JSON simple
    const contentType = request.headers.get("content-type") || "";
    let prompt = "";
    let referenceImages: { base64: string; mimeType: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = formData.get("prompt") as string;

      // Hasta 3 imágenes de referencia
      for (let i = 0; i < 3; i++) {
        const file = formData.get(`ref_${i}`) as File | null;
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          referenceImages.push({ base64, mimeType: file.type || "image/png" });
        }
      }
    } else {
      const body = await request.json();
      prompt = body.prompt;
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Falta el prompt" }, { status: 400 });
    }

    // 1. Verificación Financiera
    const currentCredits = Number(user.publicMetadata?.credits || 0);
    // Pro cuesta 150 créditos, Flash 100
    const hasRefImages = referenceImages.length > 0;
    const cost = hasRefImages ? 150 : 100;

    if (currentCredits < cost) {
      return NextResponse.json({
        error: "Créditos insuficientes",
        credits: currentCredits,
        cost,
      }, { status: 402 });
    }

    // 2. Descontar créditos (prematuramente para evitar abusos)
    const newBalance = currentCredits - cost;
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: { credits: newBalance },
    });

    try {
      // Nano Banana Pro cuando hay imágenes de referencia (alta fidelidad, mejor edición)
      // Nano Banana 2 para generación pura de texto (más rápido)
      const model = hasRefImages ? NANO_BANANA_PRO : NANO_BANANA_2;

      const contents: any[] = [{ text: prompt }];
      for (const img of referenceImages) {
        contents.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64,
          },
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents,
      });

      // 4. Extraer la imagen generada de la respuesta
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
        // Gemini a veces solo devuelve texto en lugar de imagen — reembolsar
        throw new Error("Nano Banana no devolvió una imagen. Puede que el prompt sea problemático.");
      }

      // 5. Guardar en Supabase Storage para inmortalidad
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
      const fileName = `nanobanana_${user.id}_${Date.now()}.${ext}`;

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

      const finalPermanentUrl = publicUrlData.publicUrl;

      // 6. Guardar registro en BD
      const { error: dbError } = await supabase.from("ai_images").insert({
        prompt,
        image_url: finalPermanentUrl,
        author_id: user.primaryEmailAddress?.emailAddress,
        author_name: user.fullName || user.firstName || "Agente",
        author_avatar_url: user.imageUrl,
      });

      if (dbError) throw dbError;

      return NextResponse.json({
        success: true,
        imageUrl: finalPermanentUrl,
        balance: newBalance,
        model: hasRefImages ? "Nano Banana Pro 🍌" : "Nano Banana 2 🍌",
      });

    } catch (apiError: any) {
      // Revertir pago si falló la generación
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: { credits: currentCredits },
      });
      console.error("Error en Nano Banana:", apiError?.message || apiError);
      return NextResponse.json({
        error: apiError?.message || "Nano Banana falló. Tus créditos han sido reembolsados.",
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Error crítico en ruta AI:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
