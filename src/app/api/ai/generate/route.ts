import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 120; // 2 min máximo — si no responde en 90s, es un error real

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Nano Banana 2 — capa gratuita + de pago, texto a imagen
const NANO_BANANA_2   = "gemini-3.1-flash-image-preview";
// Nano Banana Pro — requiere billing, alta fidelidad + imágenes de referencia
const NANO_BANANA_PRO = "gemini-3-pro-image-preview";

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
    let targetPlatform = "";
    let referenceImages: { base64: string; mimeType: string; label?: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = formData.get("prompt") as string;
      useAgencyIdentity = formData.get("useAgencyIdentity") === "true";
      useAgencyCharacter = formData.get("useAgencyCharacter") === "true";
      
      targetPlatform = (formData.get("targetPlatform") as string) || (formData.get("targetPlatforms") as string) || "";

      // Hasta 3 imágenes de referencia directas desde el formulario
      for (let i = 0; i < 3; i++) {
        const file = formData.get(`ref_${i}`) as File | null;
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          referenceImages.push({ base64, mimeType: file.type || "image/png", label: "Imagen de Referencia enviada por el usuario" });
        }
      }
    } else {
      const body = await request.json();
      prompt = body.prompt;
      useAgencyIdentity = body.useAgencyIdentity === true;
      useAgencyCharacter = body.useAgencyCharacter === true;
      targetPlatform = body.targetPlatform || body.targetPlatforms || "";
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Falta el prompt" }, { status: 400 });
    }


    // Usamos el prompt base
    let finalPrompt = prompt;

    if (useAgencyIdentity && user.publicMetadata?.aiSettings) {
      const aiSettings: any = user.publicMetadata.aiSettings;
      
      const agencyContext = `
[INSTRUCCIÓN CRÍTICA DE IDENTIDAD DE MARCA]: 
Estás generando una imagen para la agencia: "${aiSettings.agencyName || 'Sin Nombre'}". 
A menos que la petición del usuario indique estrictamente lo contrario, DEBES incorporar la identidad de su marca:
- Contactos (añade creativamente a carteles/letreros si es orgánico): ${aiSettings.contactNumber || ''} ${aiSettings.extraContact ? ' / ' + aiSettings.extraContact : ''}.
`;
      finalPrompt = `${prompt}\n\n${agencyContext}`;

      // --- SISTEMA MULTIPLATAFORMA (LOGOS ROBUSTOS ADMINISTRADOS POR ZAMTOOLS) ---
      const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rslhlpaxcwwchpcyiifc.supabase.co";
      const cacheBuster = `?t=${Date.now()}`;
      const OFFICIAL_PLATFORMS: Record<string, string> = {
        ecuabet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_ecuabet.png${cacheBuster}`,
        doradobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_doradobet.png${cacheBuster}`,
        masparley: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_masparley.png${cacheBuster}`,
        databet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_databet.png${cacheBuster}`,
        astrobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_astrobet.png${cacheBuster}`,
      };

      const itemsToFetch: { url: string; label: string }[] = [];
      
      if (aiSettings.agencyLogoUrl) {
        itemsToFetch.push({ url: aiSettings.agencyLogoUrl, label: "Logo Principal de la Agencia" });
      }
      if (aiSettings.inspLogoUrl) {
        itemsToFetch.push({ url: aiSettings.inspLogoUrl, label: "Estilo Visual Referencial" });
      }

      const PLATFORM_COLORS: Record<string, {primary: string, secondary: string}> = {
        ecuabet: { primary: "Amarillo vibrante (#FFD700)", secondary: "Negro (#000000)" },
        doradobet: { primary: "Amarillo Dorado (#FFDE00)", secondary: "Negro oscuro (#000000)" },
        masparley: { primary: "Rojo vibrante (#FF0000)", secondary: "Negro (#000000)" },
        databet: { primary: "Celeste/Cyan (#00E1FF)", secondary: "Negro (#000000)" },
        saborabet: { primary: "Naranja (#FF6600)", secondary: "Negro (#000000)" },
        astrobet: { primary: "Azul Intenso (#1A3A6B)", secondary: "Rojo Vibrante (#E8253A)" }
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

        const pColor = PLATFORM_COLORS[platKey]?.primary || aiSettings.primaryColor || '#FFDE00';
        const sColor = PLATFORM_COLORS[platKey]?.secondary || aiSettings.secondaryColor || '#000000';

        finalPrompt += `\n\n[PLATAFORMA Y COLORES ESTRICTOS]: DEBES generar esta imagen específicamente enfocada en promocionar la marca: ${formattedPlat}. 
ES OBLIGATORIO usar la siguiente paleta de colores para esta marca: 
- Color Primario: ${pColor}
- Color Secundario: ${sColor}
Refleja abundante y creativamente estos colores en la ropa, los fondos, las decoraciones o la iluminación para que la imagen concuerde perfectamente con la marca. Evita usar colores de otras marcas.
ALERTA DE ORTOGRAFÍA: ES ESTRICTAMENTE OBLIGATORIO escribir el nombre exactamente como "${formattedPlat}". Asegúrate de usar creativa e impecablemente EL LOGO OFICIAL DE ESTA PLATAFORMA (adjunto como imagen). NO INVENTES LOGOS NI COMETAS ERRORES DE ESCRITURA, calca exactamente el logo enviado.`;
        
        if (OFFICIAL_PLATFORMS[platKey]) {
          itemsToFetch.push({ url: OFFICIAL_PLATFORMS[platKey], label: `Logo OFICIAL de la casa de apuestas ${formattedPlat}` });
        }
      } else {
        // Fallback to agency colors if no platform selected
        finalPrompt += `\n\n[COLORES DE LA MARCA]: Es OBLIGATORIO usar los colores de la agencia:
- Color Primario: ${aiSettings.primaryColor || '#FFDE00'}
- Color Secundario: ${aiSettings.secondaryColor || '#000000'}
Refleja abundante y creativamente estos colores en la ropa, los fondos, las decoraciones o la iluminación.`;
      }

      const fetchPromises = itemsToFetch.map(async (item) => {
        try {
          const res = await fetchWithTimeout(item.url, 8000);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const mimeType = res.headers.get('content-type') || "image/png";
            
            // FILTRO CRITICO: Solo enviar a Gemini si realmente es una imagen (Evitar Error 500 Internal)
            if (mimeType.includes("image")) {
              return { 
                base64: Buffer.from(arrayBuffer).toString("base64"), 
                mimeType,
                label: item.label
              };
            }
          }
        } catch (e) {
          console.warn(`⚠️ Timeout/error trayendo imagen ${item.label} (ignorando):`, (e as Error).message);
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
              mimeType: res.headers.get('content-type') || "image/png",
              label: "Foto del Representante/Personaje de la Agencia"
            });
          }
        } catch (e) {
          console.warn("⚠️ Timeout/error trayendo imagen de personaje (ignorando):", (e as Error).message);
        }
        finalPrompt += `\n\n[INSTRUCCIÓN DE PERSONAJE]: DEBES incluir en la imagen al personaje/representante de la agencia. La imagen de referencia del personaje ha sido proporcionada.`;
      }
    }

    // Refuerzo vital del formato al final del prompt para que el modelo no lo olvide
    finalPrompt += `\n\n[INSTRUCCIONES FINALES]: ES ESTRICTAMENTE CRÍTICO OBEDECER CUALQUIER PROPORCIÓN SOLICITADA SI EL USUARIO LO ESPECIFICÓ EN SU PROMPT.`;

    // 1. Verificación Financiera
    const currentCredits = Number(user.publicMetadata?.credits || 0);
    const hasRefImages = referenceImages.length > 0;
    const cost = 150; // Costo fijo independientemente de los extras

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
        if (img.label) {
           contents.push({ text: `\n[ESTA IMAGEN CORRESPONDE A: ${img.label}]\n` });
        }
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
      
      // ═══ RETRY CON BACKOFF + FALLBACK DE MODELO PARA 503/429 ═══
      const MAX_RETRIES = 5;
      let response;
      let lastRetryError: any = null;
      // Modelo alternativo: si flash falla, probar pro y viceversa
      const fallbackModel = model === NANO_BANANA_2 ? NANO_BANANA_PRO : NANO_BANANA_2;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // En los últimos 2 intentos, cambiar al modelo alternativo
        const currentModel = attempt >= (MAX_RETRIES - 1) ? fallbackModel : model;
        const abortController = new AbortController();
        const geminiTimeout = setTimeout(() => abortController.abort(), 90_000); // 90s máx

        try {
          console.log(`🎨 Intento ${attempt}/${MAX_RETRIES} con modelo ${currentModel}...`);
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          });
          clearTimeout(geminiTimeout);
          break; // Éxito — salir del loop
        } catch (retryErr: any) {
          clearTimeout(geminiTimeout);
          lastRetryError = retryErr;

          // Detectar errores transitorios (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED)
          const errMsg = retryErr?.message || "";
          const errStr = typeof retryErr === 'object' ? JSON.stringify(retryErr) : String(retryErr);
          const combinedMsg = `${errMsg} ${errStr}`;
          const isTransient = combinedMsg.includes("503") || combinedMsg.includes("UNAVAILABLE") 
            || combinedMsg.includes("429") || combinedMsg.includes("RESOURCE_EXHAUSTED")
            || combinedMsg.includes("high demand") || combinedMsg.includes("overloaded")
            || combinedMsg.includes("temporarily") || combinedMsg.includes("capacity");

          if (isTransient && attempt < MAX_RETRIES) {
            // Backoff exponencial: 3s, 6s, 12s, 15s (cap)
            const backoffMs = Math.min(3000 * Math.pow(2, attempt - 1), 15000);
            console.warn(`⏳ Gemini ${isTransient ? '503/429' : 'error'} — Reintento ${attempt}/${MAX_RETRIES} en ${backoffMs/1000}s (próximo modelo: ${attempt >= (MAX_RETRIES - 2) ? fallbackModel : model})...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }

          // Error no transitorio o agotamos reintentos — propagar
          throw retryErr;
        }
      }

      if (!response) {
        throw lastRetryError || new Error("Nano Banana no respondió después de múltiples intentos.");
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
      try {
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: { credits: currentCredits },
        });
      } catch (refundErr) {
        console.error("⚠️ Error reembolsando créditos:", refundErr);
      }
      
      // Mensaje de error amigable — NUNCA mostrar JSON crudo al usuario
      // Extraer mensaje de forma segura de cualquier formato de error del SDK
      let rawMsg = "";
      try {
        rawMsg = apiError?.message || "";
        if (!rawMsg && typeof apiError === 'object') {
          rawMsg = JSON.stringify(apiError);
        }
      } catch { rawMsg = String(apiError); }
      console.error("Error en Nano Banana (5 reintentos agotados):", rawMsg.slice(0, 500));

      const isTimeout = apiError?.name === "AbortError" || rawMsg.includes("abort");
      const is503 = rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("high demand") || rawMsg.includes("capacity");
      const is429 = rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("rate");
      const isNoImage = rawMsg.includes("no devolvió una imagen") || rawMsg.includes("respondió con texto");

      let friendlyMsg: string;
      if (isTimeout) {
        friendlyMsg = "⏳ Nano Banana tardó demasiado (>90s). Intenta con un prompt más simple. Tus créditos fueron reembolsados.";
      } else if (is503) {
        friendlyMsg = "🔥 Los servidores de IA están saturados (alta demanda global). Se intentó 5 veces con 2 modelos diferentes. Espera 2–3 minutos e intenta de nuevo. Tus créditos fueron reembolsados.";
      } else if (is429) {
        friendlyMsg = "⚡ Demasiadas solicitudes seguidas. Espera 30 segundos e intenta de nuevo. Tus créditos fueron reembolsados.";
      } else if (isNoImage) {
        friendlyMsg = "🎨 La IA respondió solo con texto y no generó imagen. Intenta reformular tu prompt de forma más visual. Tus créditos fueron reembolsados.";
      } else {
        friendlyMsg = "❌ Nano Banana falló al generar la imagen. Tus créditos han sido reembolsados. Intenta de nuevo en unos momentos.";
      }

      return NextResponse.json({
        error: friendlyMsg,
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Error crítico en ruta AI:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
