import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 100;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const NANO_BANANA_2   = "gemini-3.1-flash-image-preview";
const NANO_BANANA_PRO = "gemini-3-pro-image-preview";

const GEMINI_HARD_TIMEOUT_MS = 90_000;
const REF_FETCH_TIMEOUT_MS = 6_000;
// Timeouts por intento ajustados al SLA real de cada modelo.
// Pro tarda 25-55s honestamente; aborta a 35s era prematuro y disparaba retries que doblaban el costo.
const PER_CALL_TIMEOUT_PRO = 65_000;
const PER_CALL_TIMEOUT_FLASH = 45_000;

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
  // Re-leer balance ACTUAL antes de reembolsar para evitar pisar otra operación concurrente
  try {
    const fresh = await client.users.getUser(userId);
    const current = Number(fresh.publicMetadata?.credits || 0);
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...fresh.publicMetadata, credits: current + amount },
    });
    return current + amount;
  } catch (e) {
    console.error("[CREDITS] Reembolso falló — registrando para reconciliación manual:", { userId, amount, error: (e as Error).message });
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

// Llamada única con timeout duro
function callGemini(model: string, contents: any[], perCallTimeoutMs: number): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), perCallTimeoutMs);
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

// Política nueva (post incidente de 75s):
// - Cada modelo tiene SU PROPIO timeout por intento (Pro 65s, Flash 25s) ajustado a su SLA real.
//   Antes timeouteábamos Pro a 35s → lo abortábamos cuando estaba trabajando bien y disparábamos un retry que duplicaba todo.
// - Reintentos SOLO ante 503/429/overloaded explícitos (saturación). Un timeout NO se reintenta:
//   si el modelo ya tomó >X segundos puede estar generando del lado de Google, reintentar dobla costo y latencia.
// - Máximo 1 retry sobre el modelo elegido + 1 intento de fallback al opuesto si la saturación persiste.
async function generateWithSmartRetry(
  primaryModel: string,
  contents: any[],
  startedAt: number,
): Promise<{ response: any; modelUsed: string }> {
  const TOTAL_BUDGET_MS = GEMINI_HARD_TIMEOUT_MS;
  const fallbackModel = primaryModel === NANO_BANANA_PRO ? NANO_BANANA_2 : NANO_BANANA_PRO;
  const timeoutFor = (m: string) => (m === NANO_BANANA_PRO ? PER_CALL_TIMEOUT_PRO : PER_CALL_TIMEOUT_FLASH);

  const remaining = () => Math.max(0, TOTAL_BUDGET_MS - (Date.now() - startedAt));
  const tryOnce = async (model: string, label: string) => {
    const budget = Math.min(timeoutFor(model), remaining());
    if (budget <= 2000) throw new Error("GEMINI_TIMEOUT");
    const t0 = Date.now();
    try {
      const r = await callGemini(model, contents, budget);
      console.log(`[GEMINI] ${label} ${model} OK en ${Date.now() - t0}ms`);
      return r;
    } catch (e: any) {
      console.warn(`[GEMINI] ${label} ${model} falló en ${Date.now() - t0}ms: ${e?.message || e}`);
      throw e;
    }
  };

  // Intento 1
  try {
    const response = await tryOnce(primaryModel, "intento#1");
    return { response, modelUsed: primaryModel };
  } catch (err: any) {
    const overloaded = isOverloaded(err);
    const timedOut = String(err?.message || "") === "GEMINI_TIMEOUT";

    // Errores de input/safety/etc. → no tiene sentido reintentar
    if (!overloaded && !timedOut) throw err;

    // Timeout en el primer intento: NO reintentamos en el mismo modelo (probablemente está generando del lado de Google).
    // Si queda presupuesto y hay modelo alterno, intentamos el fallback (que será más rápido si Pro→Flash).
    if (timedOut) {
      if (remaining() > 8000 && fallbackModel === NANO_BANANA_2) {
        try {
          const response = await tryOnce(fallbackModel, "fallback-tras-timeout");
          return { response, modelUsed: fallbackModel };
        } catch (e2) {
          throw err;
        }
      }
      throw err;
    }

    // Saturación 503/429: 1 retry rápido sobre el mismo modelo
    if (remaining() > timeoutFor(primaryModel) + 2000) {
      const wait = 1200 + Math.floor(Math.random() * 600);
      console.warn(`[GEMINI] 503/saturación → reintentando ${primaryModel} tras ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      try {
        const response = await tryOnce(primaryModel, "retry");
        return { response, modelUsed: primaryModel };
      } catch (err2: any) {
        if (!isOverloaded(err2)) throw err2;
        // Sigue saturado → fallback al opuesto si queda presupuesto
        if (remaining() > 5000) {
          console.warn(`[GEMINI] Fallback ${primaryModel} → ${fallbackModel} (saturación persistente)`);
          try {
            const response = await tryOnce(fallbackModel, "fallback-tras-503");
            return { response, modelUsed: fallbackModel };
          } catch (e3) {
            throw err2;
          }
        }
        throw err2;
      }
    }

    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const contentType = request.headers.get("content-type") || "";
    let prompt = "";
    let useAgencyIdentity = false;
    let useAgencyCharacter = false;
    let targetPlatform = "";
    let forceModel = "";
    let referenceImages: { base64: string; mimeType: string; label?: string }[] = [];
    let userRefCount = 0; // imágenes subidas por el usuario (no logos, no personaje)

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = formData.get("prompt") as string;
      useAgencyIdentity = formData.get("useAgencyIdentity") === "true";
      useAgencyCharacter = formData.get("useAgencyCharacter") === "true";
      targetPlatform = (formData.get("targetPlatform") as string) || (formData.get("targetPlatforms") as string) || "";
      forceModel = (formData.get("forceModel") as string) || "";

      // Cargar las 3 refs en paralelo y etiquetarlas con índice + nombre del archivo
      const slots = [0, 1, 2];
      const refResults = await Promise.all(
        slots.map(async (i) => {
          const file = formData.get(`ref_${i}`) as File | null;
          if (!file || typeof (file as any).arrayBuffer !== "function") return null;
          if (file.size === 0) return null;
          // Hard cap: 6 MB por imagen — Pro rechaza payloads grandes con 500 INTERNAL
          if (file.size > 6 * 1024 * 1024) {
            console.warn(`[REF USER] ref_${i} demasiado grande (${file.size} bytes), descartada`);
            return null;
          }
          try {
            const arrayBuffer = await file.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            // Normalizar mimeType: Gemini Pro solo acepta image/jpeg, image/png, image/webp.
            // Cualquier variante ("image/jpg", "image/heic", undefined) la mapeamos a una soportada.
            let mimeType = (file.type || "").toLowerCase();
            if (mimeType === "image/jpg") mimeType = "image/jpeg";
            if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
              mimeType = "image/png";
            }
            return {
              base64,
              mimeType,
              label: `Imagen de Referencia #${i + 1} subida por el usuario${file.name ? ` (archivo: ${file.name})` : ""}`,
              index: i,
            };
          } catch (e) {
            console.error(`[REF USER] error leyendo ref_${i}:`, (e as Error).message);
            return null;
          }
        })
      );
      for (const r of refResults) {
        if (r) {
          referenceImages.push({ base64: r.base64, mimeType: r.mimeType, label: r.label });
          userRefCount += 1;
        }
      }
    } else {
      const body = await request.json();
      prompt = body.prompt;
      useAgencyIdentity = body.useAgencyIdentity === true;
      useAgencyCharacter = body.useAgencyCharacter === true;
      targetPlatform = body.targetPlatform || body.targetPlatforms || "";
      forceModel = body.forceModel || "";
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Falta el prompt" }, { status: 400 });
    }

    let finalPrompt = prompt;

    if (userRefCount > 0) {
      finalPrompt += `\n\n[IMÁGENES DE REFERENCIA DEL USUARIO — USO OBLIGATORIO]:
El usuario adjuntó ${userRefCount} ${userRefCount === 1 ? 'imagen' : 'imágenes'} de referencia (etiquetadas más abajo como "Imagen de Referencia #1", "#2", etc.). Estas imágenes NO son decorativas: son CRÍTICAS y deben influir directamente en la imagen final.
Reglas:
1. Si las referencias muestran personas, productos u objetos concretos, INCLÚYELOS en la imagen final preservando su apariencia distintiva (rostro, marca, forma, colores, vestuario).
2. Si la referencia es un estilo visual o paleta, aplícalo a la composición.
3. Combina coherentemente todas las referencias entre sí y con el prompt textual del usuario.
4. NO ignores ninguna referencia. Si una referencia es ambigua, intégrala como contexto/atmósfera.
5. Mantén la calidad y proporción solicitadas.`;
    }

    if (useAgencyIdentity && user.publicMetadata?.aiSettings) {
      const aiSettings: any = user.publicMetadata.aiSettings;

      const contactNumber = aiSettings.contactNumber || '';
      const extraContact = aiSettings.extraContact || '';
      const contactString = extraContact ? `${contactNumber} / ${extraContact}` : contactNumber;

      const agencyContext = `
[INSTRUCCIÓN CRÍTICA DE IDENTIDAD DE MARCA]:
Estás generando una imagen para la agencia: "${aiSettings.agencyName || 'Sin Nombre'}".
A menos que la petición del usuario indique estrictamente lo contrario, DEBES incorporar la identidad de su marca.

[CONTACTO — INTEGRACIÓN NATURAL OBLIGATORIA]:
DEBES incluir el número de contacto "${contactString}" en la imagen, pero de forma que se sienta NATURAL y PARTE DEL DISEÑO. Ejemplos:
- En un cartel/pancarta/banner que ya forme parte de la escena.
- Escrito en una pantalla LED, neón, o marquesina dentro de la composición.
- En la camiseta, uniforme o vestimenta de un personaje si es coherente.
- Como parte de un flyer, volante o tarjeta que un personaje sostiene.
- En un letrero de la calle, valla publicitaria o elemento de fondo.

[REGLAS ESTRICTAS DE LEGIBILIDAD Y NO-SUPERPOSICIÓN — OBLIGATORIO]:
1. EL TEXTO DEL CONTENIDO PRINCIPAL DE LA IMAGEN (titulares, headlines, eslogan, mensaje del cartel/banner/flyer, copy promocional, frases destacadas, números importantes, fechas, premios, montos, cuotas, llamados a la acción) DEBE SER 100% VISIBLE Y 100% LEGIBLE EN SU TOTALIDAD. CADA LETRA Y CADA PALABRA DEBEN VERSE COMPLETAS, SIN UN SOLO CARÁCTER TAPADO. ESTO ES INNEGOCIABLE.
2. PROHIBIDO superponer el número, logos o cualquier texto sobre rostros, manos, o el sujeto principal de la imagen.
3. PROHIBIDO que el texto se cruce, choque, intersecte o quede tapado por OTROS objetos, cuerpos, edificios, brazos, manos, productos o elementos del primer plano. Ningún elemento puede pasar POR DELANTE del texto principal.
4. El texto y los logos DEBEN ubicarse en zonas LIMPIAS y DESPEJADAS de la composición (cielo, paredes vacías, espacios negativos, esquinas no ocupadas), con suficiente contraste de fondo para que cada letra se distinga sin esfuerzo.
5. Reserva un margen mínimo de espacio respiratorio alrededor de cualquier texto/logo. Si no hay espacio limpio, REDISEÑA la escena (mueve sujetos, ajusta encuadre, cambia ángulo) para crear un área despejada que aloje el texto completo.
6. Cualquier texto debe ser 100% legible: enfocado, nítido, sin recortes en bordes, sin salirse del lienzo, sin deformaciones, sin doble exposición, sin motion blur, sin objetos parciales encima, sin sombras que lo oscurezcan, sin gradientes que lo desvanezcan.
7. Si dos elementos compiten por el mismo espacio, prioriza la VISIBILIDAD TOTAL del texto principal y desplaza al sujeto u objeto a otra zona. NUNCA los apiles ni cortes el texto.
8. ANTES DE FINALIZAR EL RENDER, autoverifica: ¿se lee el texto principal de un vistazo, completo, sin interrupciones? Si la respuesta no es un SÍ rotundo, recompón la imagen.
`;
      finalPrompt = `${prompt}\n\n${agencyContext}`;

      // Logos oficiales — sin cache buster: dejamos que el CDN los sirva rápido.
      // Cuando ZamTools actualice un logo, basta con renombrar el archivo (default_X_v2.png) o purgar el bucket.
      const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rslhlpaxcwwchpcyiifc.supabase.co";
      const OFFICIAL_PLATFORMS: Record<string, string> = {
        ecuabet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_ecuabet.png`,
        doradobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_doradobet.png`,
        masparley: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_masparley.png`,
        databet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_databet.png`,
        astrobet: `${supabaseBase}/storage/v1/object/public/ai-generations/agency-assets/default_astrobet.png`,
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
ALERTA DE ORTOGRAFÍA: ES ESTRICTAMENTE OBLIGATORIO escribir el nombre exactamente como "${formattedPlat}". Asegúrate de usar creativa e impecablemente EL LOGO OFICIAL DE ESTA PLATAFORMA (adjunto como imagen). NO INVENTES LOGOS NI COMETAS ERRORES DE ESCRITURA, calca exactamente el logo enviado.
[REGLA DE LOGOS]: ES CRÍTICO Y OBLIGATORIO mantener fielmente los COLORES ORIGINALES de los logos proporcionados. NO los pongas en blanco y negro, escala de grises o metalizados a menos que el prompt explícitamente lo pida. EL LOGO NUNCA debe quedar tapado, recortado o superpuesto a un sujeto — colócalo en una zona vacía con margen.`;

        if (OFFICIAL_PLATFORMS[platKey]) {
          itemsToFetch.push({ url: OFFICIAL_PLATFORMS[platKey], label: `Logo OFICIAL de la casa de apuestas ${formattedPlat}` });
        }
      } else {
        finalPrompt += `\n\n[COLORES DE LA MARCA]: Es OBLIGATORIO usar los colores de la agencia:
- Color Primario: ${aiSettings.primaryColor || '#FFDE00'}
- Color Secundario: ${aiSettings.secondaryColor || '#000000'}
Refleja abundante y creativamente estos colores en la ropa, los fondos, las decoraciones o la iluminación.
[REGLA DE LOGOS]: ES CRÍTICO Y OBLIGATORIO mantener fielmente los COLORES ORIGINALES de cualquier logo proporcionado. NO los pongas en blanco y negro, ni metalizados. El logo debe salir a full color exactamente como en la imagen de referencia y NUNCA superpuesto a otro sujeto.`;
      }

      const fetchPromises = itemsToFetch.map(async (item) => {
        try {
          const res = await fetchWithTimeout(item.url, REF_FETCH_TIMEOUT_MS);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            let mimeType = (res.headers.get('content-type') || "image/png").toLowerCase().split(";")[0].trim();
            if (mimeType === "image/jpg") mimeType = "image/jpeg";
            if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
              // Si el content-type es genérico (octet-stream) o raro, asumimos PNG y dejamos que Gemini lo intente.
              if (!mimeType.startsWith("image/")) {
                console.warn(`[REF] mime sospechoso para ${item.label}: ${mimeType} — descartando`);
                return null;
              }
              mimeType = "image/png";
            }
            // Cap de 6 MB por logo remoto también
            if (arrayBuffer.byteLength > 6 * 1024 * 1024) {
              console.warn(`[REF] ${item.label} pesa ${arrayBuffer.byteLength}B — descartando para no romper Pro`);
              return null;
            }
            return {
              base64: Buffer.from(arrayBuffer).toString("base64"),
              mimeType,
              label: item.label
            };
          }
        } catch (e) {
          console.warn(`[REF] Timeout/error trayendo ${item.label} (ignorando):`, (e as Error).message);
        }
        return null;
      });
      const results = await Promise.all(fetchPromises);
      for (const r of results) {
        if (r) referenceImages.push(r);
      }
    }

    if (useAgencyCharacter && user.publicMetadata?.aiSettings) {
      const aiSettings: any = user.publicMetadata.aiSettings;
      if (aiSettings.characterImageUrl) {
        try {
          const res = await fetchWithTimeout(aiSettings.characterImageUrl, REF_FETCH_TIMEOUT_MS);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            let mimeType = (res.headers.get('content-type') || "image/png").toLowerCase().split(";")[0].trim();
            if (mimeType === "image/jpg") mimeType = "image/jpeg";
            if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
              mimeType = "image/png";
            }
            if (arrayBuffer.byteLength <= 6 * 1024 * 1024) {
              referenceImages.push({
                base64: Buffer.from(arrayBuffer).toString("base64"),
                mimeType,
                label: "Foto del Representante/Personaje de la Agencia"
              });
            } else {
              console.warn(`[REF] personaje pesa ${arrayBuffer.byteLength}B — descartado`);
            }
          }
        } catch (e) {
          console.warn("[REF] Timeout/error trayendo personaje (ignorando):", (e as Error).message);
        }
        finalPrompt += `\n\n[INSTRUCCIÓN DE PERSONAJE]: DEBES incluir en la imagen al personaje/representante de la agencia. La imagen de referencia del personaje ha sido proporcionada.`;
      }
    }

    if (useAgencyIdentity && user.publicMetadata?.aiSettings) {
      const aiS: any = user.publicMetadata.aiSettings;
      const cn = aiS.contactNumber || '';
      const ec = aiS.extraContact || '';
      const cs = ec ? `${cn} / ${ec}` : cn;
      finalPrompt += `\n\n[INSTRUCCIONES FINALES — LEE ESTO ANTES DE RENDERIZAR]:
1. ES ESTRICTAMENTE CRÍTICO OBEDECER CUALQUIER PROPORCIÓN SOLICITADA SI EL USUARIO LO ESPECIFICÓ.
2. VERIFICACIÓN DE CONTACTO: el número "${cs}" debe aparecer en la imagen de forma natural Y COMPLETAMENTE VISIBLE (cada dígito legible, sin caracteres tapados).
3. VISIBILIDAD DEL TEXTO PRINCIPAL: cualquier texto del contenido principal (titular, mensaje, eslogan, premios, montos, llamados a la acción, fechas) debe verse ENTERO y NÍTIDO. Cero letras cortadas, cero palabras tapadas, cero caracteres detrás de objetos. Si tu boceto mental tiene aunque sea UNA letra obstruida, recompón la escena.
4. ANTI-SUPERPOSICIÓN: NINGÚN texto, número de contacto o logo puede quedar tapado, atravesado, recortado o detrás de personas, objetos, manos, brazos o elementos del primer plano. Reubica el texto a un espacio limpio antes de renderizar.
5. AUTO-CHEQUEO FINAL: simula leer la imagen como un usuario. Si no puedes leer cada palabra del texto principal de un solo vistazo, REHAZ la composición.`;
    } else {
      finalPrompt += `\n\n[INSTRUCCIONES FINALES]:
1. ES ESTRICTAMENTE CRÍTICO OBEDECER CUALQUIER PROPORCIÓN SOLICITADA.
2. EL TEXTO DEL CONTENIDO PRINCIPAL (titulares, mensajes, eslóganes, números, premios, llamados a la acción) DEBE SER 100% VISIBLE Y LEGIBLE: cada letra completa, sin recortes, sin objetos por delante, sin tapado parcial, sin deformación. Reubica sujetos u objetos si es necesario para liberar el espacio del texto.
3. Antes de renderizar, autoverifica que cada palabra del texto principal se lea entera.`;
    }

    // 1. Verificación financiera
    const currentCredits = Number(user.publicMetadata?.credits || 0);
    const hasRefImages = referenceImages.length > 0;
    const cost = 150;

    if (currentCredits < cost) {
      return NextResponse.json({
        error: "Créditos insuficientes",
        credits: currentCredits,
        cost,
      }, { status: 402 });
    }

    // 2. Descontar créditos preventivamente (preservando el resto del publicMetadata)
    const newBalance = currentCredits - cost;
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: { ...user.publicMetadata, credits: newBalance },
    });

    let creditsRefunded = false;

    try {
      // Si el usuario subió refs propias, FORZAMOS Pro: Flash no maneja bien múltiples refs y suele ignorarlas.
      let model: string;
      if (userRefCount > 0) {
        model = NANO_BANANA_PRO;
      } else if (forceModel === 'pro') {
        model = NANO_BANANA_PRO;
      } else if (forceModel === 'flash') {
        model = NANO_BANANA_2;
      } else {
        model = hasRefImages ? NANO_BANANA_PRO : NANO_BANANA_2;
      }

      // Orden recomendado por Gemini: imágenes primero, prompt textual al final.
      // Mejora notablemente la incorporación de las refs en el render final.
      const contents: any[] = [];
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
      contents.push({ text: finalPrompt });

      console.log(`[GEMINI] Modelo solicitado=${model}, refs=${referenceImages.length} (usuario=${userRefCount}), prompt=${finalPrompt.length} chars`);

      const startedAt = Date.now();
      const { response, modelUsed } = await generateWithSmartRetry(model, contents, startedAt);
      const elapsedMs = Date.now() - startedAt;
      console.log(`[GEMINI] Generación completada en ${elapsedMs}ms con ${modelUsed}${modelUsed !== model ? " (fallback)" : ""}`);
      // Sobrescribimos para que el response al cliente refleje el modelo realmente usado
      model = modelUsed;

      // Diagnóstico: detectar bloqueos por safety / promptFeedback ANTES de buscar la imagen
      const promptFeedback = response?.promptFeedback || response?.response?.promptFeedback;
      if (promptFeedback?.blockReason) {
        console.warn("[GEMINI] prompt bloqueado:", promptFeedback);
        throw new Error(`El prompt fue bloqueado por las políticas del modelo (${promptFeedback.blockReason}). Reformula el contenido.`);
      }
      const finishReason = response?.candidates?.[0]?.finishReason;
      if (finishReason && !["STOP", "MAX_TOKENS", undefined].includes(finishReason)) {
        console.warn("[GEMINI] finishReason no exitoso:", finishReason, response?.candidates?.[0]?.safetyRatings);
        if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
          throw new Error(`Imagen rechazada por filtros de seguridad (${finishReason}). Suaviza el prompt y reintenta.`);
        }
        if (finishReason === "RECITATION") {
          throw new Error("El modelo detectó contenido recitado. Cambia el prompt.");
        }
      }

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
        const textParts = response.candidates?.[0]?.content?.parts
          ?.filter((p: any) => p.text)
          ?.map((p: any) => p.text)
          ?.join(" ") || "";
        console.warn("[GEMINI] respondió solo texto:", textParts.slice(0, 300), "finishReason:", finishReason);
        throw new Error("Nano Banana no devolvió una imagen. El modelo respondió con texto. Intenta reformular el prompt.");
      }

      // Guardar en Supabase
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

      const { error: dbError } = await supabase.from("ai_images").insert({
        prompt,
        image_url: finalPermanentUrl,
        author_id: user.primaryEmailAddress?.emailAddress,
        author_name: user.fullName || user.firstName || "Agente",
        author_avatar_url: user.imageUrl,
      });

      if (dbError) {
        // Borrar el archivo huérfano antes de fallar
        await supabase.storage.from("ai-generations").remove([fileName]).catch(() => {});
        throw dbError;
      }

      return NextResponse.json({
        success: true,
        imageUrl: finalPermanentUrl,
        balance: newBalance,
        model: model === NANO_BANANA_PRO ? "Nano Banana Pro 🍌" : "Nano Banana Flash ⚡",
      });

    } catch (apiError: any) {
      // Reembolso seguro
      if (!creditsRefunded) {
        creditsRefunded = true;
        await refundCredits(client, user.id, cost);
      }

      const msg = String(apiError?.message || "");
      const status = apiError?.status || apiError?.statusCode || apiError?.code;
      const isTimeout = apiError?.name === "AbortError" || msg === "GEMINI_TIMEOUT" || msg.includes("abort");
      const overloaded = isOverloaded(apiError);
      const isInvalidArg = status === 400 || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("invalid_argument");
      const isInternal = status === 500 || msg.toLowerCase().includes("internal") || msg.toLowerCase().includes("internal_error");

      let friendlyMsg: string;
      let httpStatus = 500;
      if (isTimeout) {
        friendlyMsg = "Nano Banana tardó demasiado (>75s). Intenta con un prompt más simple. Tus créditos fueron reembolsados.";
        httpStatus = 504;
      } else if (overloaded) {
        friendlyMsg = "El modelo está saturado (503). Intenta de nuevo en unos segundos. Tus créditos fueron reembolsados.";
        httpStatus = 503;
      } else if (isInvalidArg) {
        friendlyMsg = "El modelo rechazó la entrada (formato/imagen no soportado). Verifica que las referencias sean JPG/PNG/WEBP <6MB. Créditos reembolsados.";
        httpStatus = 400;
      } else if (isInternal) {
        friendlyMsg = `Pro devolvió 500 INTERNAL. Suele pasar con prompts muy largos o referencias pesadas. Intenta con menos referencias o prompt más corto. Créditos reembolsados. (${msg.slice(0, 120)})`;
        httpStatus = 500;
      } else {
        friendlyMsg = msg || "Nano Banana falló. Tus créditos han sido reembolsados.";
      }

      console.error("[GEMINI ERROR]", {
        msg,
        status,
        isTimeout,
        overloaded,
        isInvalidArg,
        isInternal,
        name: apiError?.name,
        stack: apiError?.stack?.split("\n").slice(0, 4).join(" | "),
      });
      return NextResponse.json({ error: friendlyMsg, refunded: true }, { status: httpStatus });
    }

  } catch (error: any) {
    console.error("Error crítico en ruta AI:", error?.message, error?.stack);
    return NextResponse.json({
      error: `Error interno: ${error?.message || "desconocido"}`,
    }, { status: 500 });
  }
}
