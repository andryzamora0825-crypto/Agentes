import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 120; // 2 min máximo — si no responde en 90s, es un error real

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Nano Banana 2 — capa gratuita + de pago, texto a imagen
const NANO_BANANA_2   = "gemini-2.0-flash-preview-image-generation";
// Nano Banana Pro — requiere billing, alta fidelidad + imágenes de referencia
const NANO_BANANA_PRO = "gemini-2.0-flash-preview-image-generation";

// Helper: fetch con timeout para evitar cuelgues en imágenes de referencia
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
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

    // Aceptar FormData (con imágenes de referencia opcionales) o JSON simple
    const contentType = request.headers.get("content-type") || "";
    let prompt = "";
    let useAgencyIdentity = false;
    let useAgencyCharacter = false;
    let imageFormat = "square";
    let referenceImages: { base64: string; mimeType: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = formData.get("prompt") as string;
      useAgencyIdentity = formData.get("useAgencyIdentity") === "true";
      useAgencyCharacter = formData.get("useAgencyCharacter") === "true";
      imageFormat = (formData.get("imageFormat") as string) || "square";

      // Hasta 3 imágenes de referencia directas desde el formulario
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
      useAgencyIdentity = body.useAgencyIdentity === true;
      useAgencyCharacter = body.useAgencyCharacter === true;
      imageFormat = body.imageFormat || "square";
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Falta el prompt" }, { status: 400 });
    }

    // --- Mapeo de formatos a instrucciones de aspecto ---
    const FORMAT_MAP: Record<string, string> = {
      square:     "OBLIGATORIO: La imagen DEBE ser CUADRADA (1:1), como 1024x1024 píxeles. NO generes forma rectangular.",
      vertical:   "OBLIGATORIO: La imagen DEBE ser VERTICAL MUY ALTA y ANGOSTA (9:16), como 768x1365 píxeles. La altura debe ser mucho mayor que el ancho. Formato tipo celular/Stories/Reels.",
      horizontal: "OBLIGATORIO: La imagen DEBE ser HORIZONTAL MUY ANCHA y BAJA (16:9), como 1365x768 píxeles. El ancho debe ser mucho mayor que la altura. Formato tipo YouTube/pantalla de PC.",
      portrait:   "OBLIGATORIO: La imagen DEBE ser VERTICAL tipo RETRATO (4:5), como 819x1024 píxeles. Ligeramente más alta que ancha. Formato Instagram Retrato.",
      landscape:  "OBLIGATORIO: La imagen DEBE ser HORIZONTAL tipo PAISAJE (3:2), como 1024x683 píxeles. Más ancha que alta. Formato publicidad/web.",
      whatsapp:   "OBLIGATORIO: La imagen DEBE ser CUADRADA (1:1), como 1024x1024 píxeles. Formato WhatsApp estado/perfil.",
    };
    const formatInstruction = FORMAT_MAP[imageFormat] || FORMAT_MAP.square;

    // --- INYECCIÓN DE IDENTIDAD DE AGENCIA ---
    let finalPrompt = `[INSTRUCCIÓN DE FORMATO CRÍTICA - MÁXIMA PRIORIDAD]: ${formatInstruction}\n\n${prompt}`;


    if (useAgencyIdentity && user.publicMetadata?.aiSettings) {
      const aiSettings: any = user.publicMetadata.aiSettings;
      
      const agencyContext = `
[INSTRUCCIÓN CRÍTICA DE IDENTIDAD DE MARCA]: 
Estás generando una imagen para la agencia: "${aiSettings.agencyName || 'Sin Nombre'}". 
A menos que la petición del usuario indique estrictamente lo contrario, DEBES incorporar la identidad de su marca:
- Tono/Estilo: ${aiSettings.agencyDesc || 'Estándar, profesional'}
- Colores representativos: Primario (${aiSettings.primaryColor || '#FFDE00'}), Secundario (${aiSettings.secondaryColor || '#000000'}). Refleja abundantemente estos colores en ropa, fondos, decoraciones o iluminación.
- Contactos (añade creativamente a carteles/letreros si es orgánico): ${aiSettings.contactNumber || ''} ${aiSettings.extraContact ? ' / ' + aiSettings.extraContact : ''}.
`;
      finalPrompt = `${prompt}\n\n${agencyContext}`;

      // Inyectar imágenes de marca pre-guardadas como referencias (con timeout de 8s cada una)
      const urlsToFetch = [aiSettings.agencyLogoUrl, aiSettings.inspLogoUrl, aiSettings.brandLogoUrl].filter(Boolean);
      const fetchPromises = urlsToFetch.map(async (url: string) => {
        try {
          const res = await fetchWithTimeout(url, 8000);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return { 
              base64: Buffer.from(arrayBuffer).toString("base64"), 
              mimeType: res.headers.get('content-type') || "image/png" 
            };
          }
        } catch (e) {
          console.warn("⚠️ Timeout/error trayendo imagen de agencia (ignorando):", (e as Error).message);
        }
        return null;
      });
      const results = await Promise.all(fetchPromises);
      for (const r of results) {
        if (r) referenceImages.push(r);
      }
    }

    // --- INYECCIÓN DE PERSONAJE DE AGENCIA ---
    if (useAgencyCharacter && user.publicMetadata?.aiSettings) {
      const aiSettings: any = user.publicMetadata.aiSettings;
      if (aiSettings.characterImageUrl) {
        try {
          const res = await fetchWithTimeout(aiSettings.characterImageUrl, 8000);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            referenceImages.push({
              base64: Buffer.from(arrayBuffer).toString("base64"),
              mimeType: res.headers.get('content-type') || "image/png"
            });
          }
        } catch (e) {
          console.warn("⚠️ Timeout/error trayendo imagen de personaje (ignorando):", (e as Error).message);
        }
        finalPrompt += `\n\n[INSTRUCCIÓN DE PERSONAJE]: DEBES incluir en la imagen al personaje/representante de la agencia. La imagen de referencia del personaje ha sido proporcionada. Mantén su apariencia, rasgos faciales y estilo reconocibles en la escena generada. El personaje debe ser protagonista o estar visible de forma clara en la imagen.`;
      }
    }

    // 1. Verificación Financiera
    const currentCredits = Number(user.publicMetadata?.credits || 0);
    // Pro cuesta 150 créditos, Flash 100
    const hasRefImages = referenceImages.length > 0;
    const baseCost = hasRefImages ? 150 : 100;
    const characterExtra = useAgencyCharacter ? 50 : 0;
    const cost = baseCost + characterExtra;

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

      const contents: any[] = [{ text: finalPrompt }];
      for (const img of referenceImages) {
        contents.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64,
          },
        });
      }

      // ═══ FIX CRÍTICO: responseModalities + timeout con AbortController ═══
      // Sin responseModalities: ["TEXT", "IMAGE"], el SDK NUNCA devuelve imágenes
      // y se queda colgado hasta que Vercel mata la función (5 min timeout fantasma)
      const abortController = new AbortController();
      const geminiTimeout = setTimeout(() => abortController.abort(), 90_000); // 90s máx

      let response;
      try {
        response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });
      } finally {
        clearTimeout(geminiTimeout);
      }

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
        const textParts = response.candidates?.[0]?.content?.parts
          ?.filter((p: any) => p.text)
          ?.map((p: any) => p.text)
          ?.join(" ") || "";
        console.warn("⚠️ Gemini respondió solo texto:", textParts.slice(0, 200));
        throw new Error("Nano Banana no devolvió una imagen. El modelo respondió con texto. Intenta reformular el prompt.");
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
      
      // Mensaje de error más descriptivo
      const isTimeout = apiError?.name === "AbortError" || apiError?.message?.includes("abort");
      const friendlyMsg = isTimeout
        ? "Nano Banana tardó demasiado (>90s). Intenta con un prompt más simple. Tus créditos fueron reembolsados."
        : apiError?.message || "Nano Banana falló. Tus créditos han sido reembolsados.";
        
      console.error("Error en Nano Banana:", apiError?.message || apiError);
      return NextResponse.json({
        error: friendlyMsg,
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Error crítico en ruta AI:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
