import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";
import { spendCredits, refundCredits, getBalance, logRefundFailure, InsufficientCreditsError } from "@/lib/credits";

export const maxDuration = 300; // 5 minutos máximo (Soportado por Vercel Pro)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Nano Banana 2 — capa gratuita + de pago, texto a imagen
const NANO_BANANA_2   = "gemini-3.1-flash-image-preview";
// Nano Banana Pro — requiere billing, alta fidelidad + imágenes de referencia
const NANO_BANANA_PRO = "gemini-3-pro-image-preview";

// Helper: fetch con timeout agresivo para evitar cuelgues
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
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
    let referenceImages: { base64: string; mimeType: string; label?: string; isUserRef?: boolean }[] = [];

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
          referenceImages.push({ base64, mimeType: file.type || "image/png", label: "Imagen de Referencia enviada por el usuario", isUserRef: true });
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

    // ═══ OPTIMIZACIÓN: Preparar fetches de imágenes en paralelo con verificación de créditos ═══
    const itemsToFetch: { url: string; label: string }[] = [];

    if (useAgencyIdentity && user.publicMetadata?.aiSettings) {
      const aiSettings: any = user.publicMetadata.aiSettings;
      
      const agencyContext = `Marca: "${aiSettings.agencyName || 'Sin Nombre'}". Contacto opcional: ${aiSettings.contactNumber || ''} ${aiSettings.extraContact ? ' / ' + aiSettings.extraContact : ''}.`;
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

        finalPrompt += `\nMarca: ${formattedPlat}. Colores: Primario ${pColor}, Secundario ${sColor}. Incluye creativamente colores/logo. Escribe "${formattedPlat}" impecablemente.`;
        
        if (OFFICIAL_PLATFORMS[platKey]) {
          itemsToFetch.push({ url: OFFICIAL_PLATFORMS[platKey], label: `Logo OFICIAL de la casa de apuestas ${formattedPlat}` });
        }
      } else {
        // Fallback to agency colors if no platform selected
        finalPrompt += `\nColores obligatorios: Primario ${aiSettings.primaryColor || '#FFDE00'}, Secundario ${aiSettings.secondaryColor || '#000000'}.`;
      }
    }

    // ═══ OPTIMIZACIÓN CLAVE: Lanzar fetch de imágenes + personaje + créditos TODO EN PARALELO ═══
    const fetchImagesPromise = Promise.all(
      itemsToFetch.map(async (item) => {
        try {
          const res = await fetchWithTimeout(item.url, 5000); // ← 5s en vez de 8s
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const mimeType = res.headers.get('content-type') || "image/png";
            if (mimeType.includes("image")) {
              return { base64: Buffer.from(arrayBuffer).toString("base64"), mimeType, label: item.label };
            }
          }
        } catch (e) {
          console.warn(`⚠️ Timeout/error trayendo imagen ${item.label} (ignorando):`, (e as Error).message);
        }
        return null;
      })
    );

    const fetchCharacterPromise = (useAgencyCharacter && user.publicMetadata?.aiSettings)
      ? (async () => {
          const aiSettings: any = user.publicMetadata!.aiSettings;
          if (!aiSettings.characterImageUrl) return null;
          try {
            const res = await fetchWithTimeout(aiSettings.characterImageUrl, 5000);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              return {
                base64: Buffer.from(arrayBuffer).toString("base64"),
                mimeType: res.headers.get('content-type') || "image/png",
                label: "Foto del Representante/Personaje de la Agencia"
              };
            }
          } catch (e) {
            console.warn("⚠️ Timeout/error trayendo imagen de personaje (ignorando):", (e as Error).message);
          }
          return null;
        })()
      : Promise.resolve(null);

    // ═══ EJECUTAR TODO EN PARALELO ═══
    const [brandImageResults, characterResult] = await Promise.all([
      fetchImagesPromise,
      fetchCharacterPromise,
    ]);

    // Añadir imágenes de marca que se descargaron con éxito
    for (const r of brandImageResults) {
      if (r) referenceImages.push(r);
    }

    // Añadir personaje si se descargó
    if (characterResult) {
      referenceImages.push(characterResult);
      finalPrompt += `\nIncluye al personaje adjunto.`;
    }

    // Refuerzo vital del formato al final del prompt
    finalPrompt += `\nRespeta proporciones solicitadas.`;

    // 1. Descuento atómico de créditos vía RPC (inmune a race conditions)
    const hasRefImages = referenceImages.length > 0;
    const cost = 150;
    const idempotencyKey = request.headers.get("x-idempotency-key") || `gen_${user.id}_${Date.now()}`;

    let newBalance: number;
    let ledgerId: string;
    try {
      const r = await spendCredits({
        userId: user.id,
        amount: cost,
        relatedId: `ai_generate_${Date.now()}`,
        idempotencyKey,
        note: "AI image generation",
      });
      newBalance = r.newBalance;
      ledgerId = r.ledgerId;
    } catch (e: any) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json({
          error: "Créditos insuficientes",
          credits: e.have,
          cost,
        }, { status: 402 });
      }
      console.error("[credits] spend failed:", e);
      return NextResponse.json({ error: "Error verificando créditos." }, { status: 500 });
    }

    // Sincronizar cache en Clerk para que el sidebar refleje el saldo
    const client = await clerkClient();
    client.users.updateUserMetadata(user.id, {
      publicMetadata: { credits: newBalance },
    }).catch(() => { /* no-crítico — la verdad vive en Supabase */ });

    try {
      // ═══ OPTIMIZACIÓN CRÍTICA DE COSTOS ═══
      // Antes, si había imágenes de referencia (el logo de Ecuabet, de agencia, etc.), 
      // forzaba NANO_BANANA_PRO por defecto. Como siempre hay logos, SIEMPRE usaba PRO.
      // Pro cuesta hasta 10x más que Flash. Flash 3.1 procesa imágenes a la perfección.
      const model = NANO_BANANA_2;
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

      // ═══ RETRY OPTIMIZADO: timeout más agresivo + backoff más corto ═══
      const MAX_RETRIES = 2; // ← 2 reintentos en vez de 3 para reducir espera total
      let response;
      let lastRetryError: any = null;
      const fallbackModel = model === NANO_BANANA_2 ? NANO_BANANA_PRO : NANO_BANANA_2;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const currentModel = attempt >= 2 ? fallbackModel : model;
        const abortController = new AbortController();
        // ═══ OPTIMIZACIÓN: 60s en vez de 120s → si no responde en 60s, el modelo está saturado ═══
        const geminiTimeout = setTimeout(() => abortController.abort(), 60_000);

        try {
          console.log(`🎨 Intento ${attempt}/${MAX_RETRIES} con ${currentModel}...`);
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
            config: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          });
          clearTimeout(geminiTimeout);
          break;
        } catch (retryErr: any) {
          clearTimeout(geminiTimeout);
          lastRetryError = retryErr;

          const errMsg = retryErr?.message || "";
          const errStr = typeof retryErr === 'object' ? JSON.stringify(retryErr) : String(retryErr);
          const combinedMsg = `${errMsg} ${errStr}`;
          const isTransient = combinedMsg.includes("503") || combinedMsg.includes("UNAVAILABLE")
            || combinedMsg.includes("429") || combinedMsg.includes("RESOURCE_EXHAUSTED")
            || combinedMsg.includes("high demand") || combinedMsg.includes("overloaded")
            || combinedMsg.includes("temporarily") || combinedMsg.includes("capacity");

          if (isTransient && attempt < MAX_RETRIES) {
            // ═══ OPTIMIZACIÓN: backoff de 1.5s fijo en vez de 2-5s escalado ═══
            console.warn(`⏳ Gemini error transitorio — Reintento ${attempt}/${MAX_RETRIES} en 1.5s (→ ${fallbackModel})...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }

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

      // ═══ OPTIMIZACIÓN MASIVA: Upload a Supabase + guardar en BD EN PARALELO ═══
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

      // ═══ OPTIMIZACIÓN: Guardar en BD + subir refs del usuario EN PARALELO (fire-and-forget refs) ═══
      const dbInsertPromise = supabase.from("ai_images").insert({
        prompt,
        image_url: finalPermanentUrl,
        author_id: user.primaryEmailAddress?.emailAddress,
        author_name: user.fullName || user.firstName || "Agente",
        author_avatar_url: user.imageUrl,
        reference_urls: null, // Se actualiza async abajo si hay refs
      });

      // Subir refs del usuario en background (no bloquear respuesta)
      const userRefs = referenceImages.filter(r => r.isUserRef);
      if (userRefs.length > 0) {
        // Fire-and-forget: no esperamos a que termine
        Promise.all(userRefs.map(async (ref, i) => {
          try {
            const refBuf = Buffer.from(ref.base64, "base64");
            const refExt = ref.mimeType.includes("jpeg") ? "jpg" : "png";
            const refName = `refs/${user.id}_${Date.now()}_ref${i}.${refExt}`;
            await supabase.storage.from("ai-generations").upload(refName, refBuf, { contentType: ref.mimeType, upsert: false });
          } catch (refErr) {
            console.warn("⚠️ Error subiendo referencia (background)", i, refErr);
          }
        })).catch(() => {}); // Silenciar errores — es best-effort
      }

      // Esperar solo el insert de la BD (es rápido, ~50ms)
      const { error: dbError } = await dbInsertPromise;
      if (dbError) console.warn("⚠️ Error guardando en BD (no crítico):", dbError);

      return NextResponse.json({
        success: true,
        imageUrl: finalPermanentUrl,
        balance: newBalance,
        model: hasRefImages ? "Nano Banana Pro 🍌" : "Nano Banana 2 🍌",
      });

    } catch (apiError: any) {
      // Refund atómico vía RPC (idempotente, no sobrescribe saldos concurrentes)
      try {
        const r = await refundCredits({
          userId: user.id,
          amount: cost,
          relatedId: ledgerId,
          idempotencyKey: `refund_${ledgerId}`,
          note: `refund: ${String(apiError?.message || "gemini failure").slice(0, 120)}`,
        });
        // Cache en Clerk
        client.users.updateUserMetadata(user.id, {
          publicMetadata: { credits: r.newBalance },
        }).catch(() => {});
      } catch (refundErr) {
        console.error("⚠️ Error reembolsando créditos:", refundErr);
        // Registrar para reconciliación manual
        await logRefundFailure({
          userId: user.id,
          amount: cost,
          relatedId: ledgerId,
          error: String(refundErr),
        });
      }

      // Mensaje de error amigable
      let rawMsg = "";
      try {
        rawMsg = apiError?.message || "";
        if (!rawMsg && typeof apiError === 'object') {
          rawMsg = JSON.stringify(apiError);
        }
      } catch { rawMsg = String(apiError); }
      console.error("Error en Nano Banana:", rawMsg.slice(0, 500));

      const isTimeout = apiError?.name === "AbortError" || rawMsg.includes("abort");
      const is503 = rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("high demand") || rawMsg.includes("capacity");
      const is429 = rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("rate");
      const isNoImage = rawMsg.includes("no devolvió una imagen") || rawMsg.includes("respondió con texto");

      let friendlyMsg: string;
      if (isTimeout) {
        friendlyMsg = "⏳ Nano Banana tardó demasiado (>60s). Intenta con un prompt más simple. Tus créditos fueron reembolsados.";
      } else if (is503) {
        friendlyMsg = "🔥 Los servidores de IA están saturados (alta demanda global). Espera 1–2 minutos e intenta de nuevo. Tus créditos fueron reembolsados.";
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
