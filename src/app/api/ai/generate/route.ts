import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 140;

// Cliente principal + cliente de respaldo opcional con segunda API key.
// Si GEMINI_API_KEY_BACKUP existe, rotamos automáticamente al respaldo cuando la principal queda sin cuota (429 RESOURCE_EXHAUSTED).
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const aiBackup = process.env.GEMINI_API_KEY_BACKUP
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_BACKUP })
  : null;

const NANO_BANANA_2   = "gemini-3.1-flash-image-preview";
const NANO_BANANA_PRO = "gemini-3-pro-image-preview";

const GEMINI_HARD_TIMEOUT_MS = 125_000;
const REF_FETCH_TIMEOUT_MS = 6_000;
// Timeouts por intento ajustados al SLA real de cada modelo.
// Pro tarda 25-55s honestamente; aborta a 35s era prematuro y disparaba retries que doblaban el costo.
const PER_CALL_TIMEOUT_PRO = 65_000;
// Flash sano resuelve en 8-18s. Si tarda >25s suele estar saturado: cortamos rápido y caemos a Pro.
const PER_CALL_TIMEOUT_FLASH = 25_000;

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

// CUOTA AGOTADA: la API key llegó a su límite diario/mensual.
// NO debe reintentarse ni hacer fallback Flash↔Pro (ambos comparten cuota).
// Solución: rotar a API key de respaldo (si está configurada) o avisar al admin.
function isQuotaExhausted(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.statusCode || err?.code;
  return (
    status === 429 ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("exceeded") ||
    msg.includes("daily limit") ||
    msg.includes("requests per minute") ||
    msg.includes("rpm")
  );
}

// SATURACIÓN TEMPORAL: el servidor de Google está sobrecargado pero la cuota está OK.
// Esto SÍ se reintenta y se hace fallback al modelo opuesto.
function isOverloaded(err: any): boolean {
  if (isQuotaExhausted(err)) return false; // separar de quota: cuota no es saturación
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.statusCode || err?.code;
  return (
    status === 503 ||
    status === 500 ||
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("internal") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("no disponible") ||                  // mensajes en español del SDK
    msg.includes("alta demanda") ||                   // "Este modelo está experimentando una alta demanda"
    msg.includes("picos de demanda")
  );
}

// Llamada única con timeout duro. Acepta cliente para soportar rotación de API keys.
// safetySettings BLOCK_NONE: con prompts largos y referencias, los modelos preview a veces
// disparan filtros falsos positivos que devuelven respuestas vacías sin error. Desactivamos
// los safety filters de aplicación para que el modelo solo bloquee contenido realmente prohibido.
function callGemini(client: GoogleGenAI, model: string, contents: any[], perCallTimeoutMs: number): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), perCallTimeoutMs);
  });
  const apiPromise = client.models.generateContent({
    model,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT" as any, threshold: "BLOCK_ONLY_HIGH" as any },
        { category: "HARM_CATEGORY_HATE_SPEECH" as any, threshold: "BLOCK_ONLY_HIGH" as any },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as any, threshold: "BLOCK_ONLY_HIGH" as any },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as any, threshold: "BLOCK_ONLY_HIGH" as any },
      ],
    },
  });
  return Promise.race([apiPromise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// Detecta el patrón "respuesta vacía sin error" que el SDK @google/genai devuelve
// cuando hay rate limits silenciosos, modelos preview rotos o degradación de Google.
// Tratamos como reintentable.
function isEmptyResponse(response: any): boolean {
  if (!response) return true;
  const candidates = response?.candidates;
  if (!candidates || candidates.length === 0) return true;
  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) return true;
  // Sin imagen Y sin texto = vacío
  const hasImage = parts.some((p: any) => p.inlineData);
  const hasText = parts.some((p: any) => p.text && String(p.text).trim().length > 0);
  return !hasImage && !hasText;
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
): Promise<{ response: any; modelUsed: string; keyUsed: "primary" | "backup" }> {
  const TOTAL_BUDGET_MS = GEMINI_HARD_TIMEOUT_MS;
  const fallbackModel = primaryModel === NANO_BANANA_PRO ? NANO_BANANA_2 : NANO_BANANA_PRO;
  const timeoutFor = (m: string) => (m === NANO_BANANA_PRO ? PER_CALL_TIMEOUT_PRO : PER_CALL_TIMEOUT_FLASH);

  const remaining = () => Math.max(0, TOTAL_BUDGET_MS - (Date.now() - startedAt));
  let usingBackupKey = false;
  const currentClient = () => (usingBackupKey && aiBackup ? aiBackup : ai);
  const currentKeyLabel = (): "primary" | "backup" => (usingBackupKey ? "backup" : "primary");

  const tryOnce = async (model: string, label: string) => {
    const budget = Math.min(timeoutFor(model), remaining());
    if (budget <= 2000) throw new Error("GEMINI_TIMEOUT");
    const t0 = Date.now();
    try {
      const r = await callGemini(currentClient(), model, contents, budget);
      // Detectar respuesta vacía (rate limit silencioso, modelo preview roto, degradación)
      if (isEmptyResponse(r)) {
        const blocked = (r as any)?.promptFeedback?.blockReason;
        const finish = (r as any)?.candidates?.[0]?.finishReason;
        console.warn(`[GEMINI] ${label} ${model} (key=${currentKeyLabel()}) respuesta VACÍA en ${Date.now() - t0}ms (blocked=${blocked}, finish=${finish}). Tratando como saturación.`);
        const e = new Error("EMPTY_RESPONSE") as any;
        e.status = 503;
        throw e;
      }
      console.log(`[GEMINI] ${label} ${model} (key=${currentKeyLabel()}) OK en ${Date.now() - t0}ms`);
      return r;
    } catch (e: any) {
      // Logging completo: muchas veces el SDK envuelve el error real en propiedades anidadas.
      const realStatus = e?.status || e?.statusCode || e?.code || e?.response?.status;
      const realDetails = e?.response?.data || e?.error || e?.details;
      console.warn(`[GEMINI] ${label} ${model} (key=${currentKeyLabel()}) falló en ${Date.now() - t0}ms: msg="${e?.message || e}" status=${realStatus} details=${realDetails ? JSON.stringify(realDetails).slice(0, 300) : "—"}`);
      throw e;
    }
  };

  // Si hay error de cuota agotada en cualquier intento, intentamos rotar a la API key de respaldo (si existe).
  const rotateToBackupIfPossible = (): boolean => {
    if (!aiBackup || usingBackupKey) return false;
    console.warn(`[GEMINI] Cuota agotada en API key principal → rotando a key de respaldo`);
    usingBackupKey = true;
    return true;
  };

  // Estrategia ping-pong para saturación persistente de Google:
  // intento#1 primario → wait 2s → intento#2 fallback → wait 5s → intento#3 primario → wait 10s → intento#4 fallback.
  // Cada intento alterna de modelo y aumenta el backoff (jitter ±300ms). Total ~17s de espera + 4 generaciones.
  // Con TOTAL_BUDGET=125s y per-call=65s/Pro y 25s/Flash, en el peor caso usamos 17s espera + ~50s en intentos = 67s.
  const sequence: Array<{ model: string; waitBefore: number; label: string }> = [
    { model: primaryModel, waitBefore: 0, label: "intento#1" },
    { model: fallbackModel, waitBefore: 2000, label: "intento#2-alt" },
    { model: primaryModel, waitBefore: 5000, label: "intento#3-primario" },
    { model: fallbackModel, waitBefore: 10000, label: "intento#4-alt" },
  ];

  let lastErr: any = null;
  let lastQuotaErr: any = null;

  for (const step of sequence) {
    if (step.waitBefore > 0) {
      const jitter = Math.floor(Math.random() * 600) - 300;
      const wait = Math.max(500, step.waitBefore + jitter);
      if (remaining() < wait + timeoutFor(step.model) + 2000) {
        console.warn(`[GEMINI] sin presupuesto para ${step.label} (queda ${remaining()}ms)`);
        break;
      }
      console.warn(`[GEMINI] esperando ${wait}ms antes de ${step.label} (${step.model})`);
      await new Promise(r => setTimeout(r, wait));
    } else if (remaining() < timeoutFor(step.model) + 2000) {
      break;
    }

    try {
      const response = await tryOnce(step.model, step.label);
      return { response, modelUsed: step.model, keyUsed: currentKeyLabel() };
    } catch (err: any) {
      lastErr = err;
      const quota = isQuotaExhausted(err);
      const overloaded = isOverloaded(err);
      const timedOut = String(err?.message || "") === "GEMINI_TIMEOUT";

      // CUOTA AGOTADA → rotar a backup si existe; no tiene sentido seguir alternando modelos (comparten cuota)
      if (quota) {
        lastQuotaErr = err;
        if (rotateToBackupIfPossible() && remaining() > timeoutFor(step.model) + 2000) {
          try {
            const response = await tryOnce(step.model, `${step.label}-key-backup`);
            return { response, modelUsed: step.model, keyUsed: currentKeyLabel() };
          } catch (errBk: any) {
            lastErr = errBk;
            // si backup también dio quota, salimos del loop (todas las keys agotadas)
            if (isQuotaExhausted(errBk)) break;
            // si dio otra cosa (overloaded/timeout) seguimos el ping-pong con la backup activa
          }
        } else {
          // No hay backup o no queda presupuesto → no tiene sentido más reintentos por quota
          break;
        }
      }

      // Si NO es saturación ni timeout (ej. INVALID_ARGUMENT, SAFETY) → propagar inmediatamente
      if (!overloaded && !timedOut && !quota) throw err;
      // Si es timeout, seguir al siguiente paso del ping-pong
      // Si es overloaded, seguir al siguiente paso del ping-pong
    }
  }

  // Si todos los intentos quedaron por quota, propagar el error de quota (mensaje correcto al usuario)
  if (lastQuotaErr && isQuotaExhausted(lastErr)) throw lastQuotaErr;
  throw lastErr || new Error("Falla persistente del modelo tras múltiples intentos");
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
El usuario adjuntó ${userRefCount} ${userRefCount === 1 ? 'imagen' : 'imágenes'} de referencia (etiquetadas ARRIBA como "Imagen de Referencia #1", "#2", etc.). Estas imágenes NO son decorativas: son CRÍTICAS y deben influir directamente en la imagen final.
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
      // Si el usuario subió refs propias, FORZAMOS Pro: Flash no maneja bien múltiples refs.
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
      const contents: any[] = [];
      for (const img of referenceImages) {
        if (img.label) contents.push({ text: `\n[ESTA IMAGEN CORRESPONDE A: ${img.label}]\n` });
        contents.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
      }
      contents.push({ text: finalPrompt });

      console.log(`[GEMINI] Modelo solicitado=${model}, refs=${referenceImages.length} (usuario=${userRefCount}), prompt=${finalPrompt.length} chars`);

      const startedAt = Date.now();
      const { response, modelUsed, keyUsed } = await generateWithSmartRetry(model, contents, startedAt);
      console.log(`[GEMINI] Generación completada en ${Date.now() - startedAt}ms con ${modelUsed}${modelUsed !== model ? " (fallback)" : ""} (key=${keyUsed})`);
      model = modelUsed;

      // Detectar bloqueo por safety / promptFeedback
      const promptFeedback = (response as any)?.promptFeedback || (response as any)?.response?.promptFeedback;
      if (promptFeedback?.blockReason) {
        console.warn("[GEMINI] prompt bloqueado:", promptFeedback);
        throw new Error(`El prompt fue bloqueado por políticas (${promptFeedback.blockReason}). Reformula el contenido.`);
      }
      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      if (finishReason && !["STOP", "MAX_TOKENS", undefined].includes(finishReason)) {
        if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
          throw new Error(`Imagen rechazada por filtros de seguridad (${finishReason}). Suaviza el prompt.`);
        }
        if (finishReason === "RECITATION") {
          throw new Error("El modelo detectó contenido recitado. Cambia el prompt.");
        }
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

      if (!imageBase64) {
        const textParts = (response as any)?.candidates?.[0]?.content?.parts
          ?.filter((p: any) => p.text)?.map((p: any) => p.text)?.join(" ") || "";
        console.warn("[GEMINI] respondió solo texto:", textParts.slice(0, 300));
        throw new Error("Nano Banana no devolvió una imagen. Intenta reformular el prompt.");
      }

      // Subir a Supabase
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
      const fileName = `nanobanana_${user.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ai-generations")
        .upload(fileName, imageBuffer, { contentType: imageMimeType, upsert: false });

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
      // Reembolso seguro re-leyendo el balance actual (evita pisar concurrencia)
      if (!creditsRefunded) {
        creditsRefunded = true;
        await refundCredits(client, user.id, cost);
      }

      const msg = String(apiError?.message || "");
      const status = apiError?.status || apiError?.statusCode || apiError?.code;
      const isTimeout = apiError?.name === "AbortError" || msg === "GEMINI_TIMEOUT" || msg.includes("abort");
      const quotaExhausted = isQuotaExhausted(apiError);
      const overloaded = !quotaExhausted && isOverloaded(apiError);
      const isInvalidArg = !quotaExhausted && (status === 400 || msg.toLowerCase().includes("invalid_argument"));
      const isInternal = !quotaExhausted && (status === 500 || msg.toLowerCase().includes("internal"));

      let friendlyMsg: string;
      let httpStatus = 500;
      if (quotaExhausted) {
        // Cuota de la(s) API key(s) agotada — el problema NO es del usuario, es del sistema.
        friendlyMsg = aiBackup
          ? "Las API keys de Gemini agotaron su cuota diaria/por minuto. Espera unos minutos o contacta al admin. Tus créditos fueron reembolsados."
          : "La API key de Gemini agotó su cuota. El admin debe configurar GEMINI_API_KEY_BACKUP o esperar al reset. Tus créditos fueron reembolsados.";
        httpStatus = 429;
      } else if (isTimeout) {
        friendlyMsg = "Nano Banana tardó demasiado. Intenta con un prompt más simple. Tus créditos fueron reembolsados.";
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
        quotaExhausted,
        overloaded,
        isInvalidArg,
        isInternal,
        name: apiError?.name,
        stack: apiError?.stack?.split("\n").slice(0, 4).join(" | "),
      });
      return NextResponse.json({ error: friendlyMsg, refunded: true, quotaExhausted }, { status: httpStatus });
    }

  } catch (error: any) {
    console.error("Error crítico en ruta AI:", error?.message, error?.stack);
    return NextResponse.json({
      error: `Error interno: ${error?.message || "desconocido"}`,
    }, { status: 500 });
  }
}
