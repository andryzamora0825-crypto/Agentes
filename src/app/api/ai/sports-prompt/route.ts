import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { matches, mode, generatedIdea } = body;
    // matches: [{ home: "...", away: "...", time: "...", league: "..." }]
    // mode: "sports" | "creative"
    // generatedIdea: { protagonist, visual, hook, copy } (solo en mode=creative)

    const aiSettings: any = user.publicMetadata?.aiSettings || {};
    const agencyName = aiSettings.agencyName || "Ecuabet";
    const agencyDesc = aiSettings.agencyDesc || "Casa de apuestas premium";
    const primaryColor = aiSettings.primaryColor || "#FFDE00";
    const secondaryColor = aiSettings.secondaryColor || "#000000";

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Falta OPENAI_API_KEY." }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let systemPrompt = "";
    let userContent = "";

    if (mode === "sports" && matches?.length > 0) {
      // ── MODO DEPORTIVO: Partidos Reales ──
      const matchList = matches
        .map((m: any) => `• ${m.home} vs ${m.away} (${m.time}) — ${m.league}`)
        .join("\n");

      systemPrompt = `Eres un director creativo experto en publicidad de apuestas deportivas. 
Contexto de la marca:
- Nombre: ${agencyName}
- Descripción: ${agencyDesc}
- Colores primarios: ${primaryColor} y ${secondaryColor}

Tu trabajo es generar DOS cosas basadas en los partidos del día:

1. **imagePrompt**: Un prompt en ESPAÑOL, ultra-descriptivo y visual para generar una imagen publicitaria fotorrealista de alta calidad. 
DEBE elegir creativamente UNA de estas CINCO estructuras visuales (escoge al azar para dar mucha variedad):
- OPCIÓN A (Cara a Cara Clásico): Composición dividida izquierda/derecha, un jugador fotorrealista por lado en actitud competitiva.
- OPCIÓN B (Acción Dinámica): Un jugador principal en plena acción deportiva (pateando el balón, tirando al aro) con la cancha de fondo.
- OPCIÓN C (Cinemática a nivel de cancha): Cámara muy baja (low angle) desde el piso mirando rígidamente hacia arriba a los jugadores en disputa.
- OPCIÓN D (Estadio Inmersivo POV): Vista desde la grada o túnel de vestuarios mirando al campo iluminado de noche, muy épico.
- OPCIÓN E (Retrato Publicitario de Estudio): Jugadores posando heroicamente con iluminación dramática de estudio de fotografía deportiva.

REGLAS ESTRICTAS ANTI-DUPLICACIÓN (¡MUY IMPORTANTE!):
- TEXTO ÚNICO Y CENTRAL: Exige explícitamente en tu prompt que el texto "Equipo A vs Equipo B" y la HORA REAL del partido (ej: "19:00", "21:30") se escriban UNA SOLA VEZ, preferiblemente centrado. **PROHÍBE** estrictamente a la IA de imágenes que duplique o espejee los textos a la izquierda y derecha. NUNCA pongas la palabra "HOY", pon la hora exacta del partido.
- UN SOLO LOGO: Incorpora lógicamente el cartel o logo de "${agencyName}" asegurando que resalte. Especifica explícitamente que debe aparecer **UNA SOLA VEZ**, no dos. Usa paletas de color con ${primaryColor} y ${secondaryColor}.
NO uses estilos bizarros ni caricaturas. Solo fotorrealismo publicitario de alto impacto (premium). TODO el texto en ESPAÑOL.

2. **caption**: Un copy en ESPAÑOL para publicar en redes sociales (Facebook/Instagram). Agresivo, emocional, con llamada a la acción y 2-3 hashtags relevantes.

Responde ESTRICTAMENTE en JSON: { "imagePrompt": "...", "caption": "..." }`;

      userContent = `Genera publicidad para estos partidos de hoy. USA LA HORA EXACTA de cada partido (no escribas "HOY", escribe la hora real como "19:00"):\n${matchList}`;

    } else if (mode === "creative" && generatedIdea) {
      // ── MODO CREATIVO: Idea Combinada ──
      systemPrompt = `Eres un director creativo experto en publicidad de apuestas deportivas y casino.
Contexto de la marca:
- Nombre: ${agencyName}
- Descripción: ${agencyDesc}
- Colores primarios: ${primaryColor} y ${secondaryColor}

Se te dará una idea creativa pre-generada con 4 componentes. Tu trabajo es:

1. **imagePrompt**: Transformar esos 4 elementos en un prompt en ESPAÑOL, ultra-descriptivo y visual para generar una imagen publicitaria fotorrealista premium. NO uses estilos artísticos bizarros. Solo fotorrealismo publicitario. TODO el texto visible en la imagen debe estar en ESPAÑOL.

2. **caption**: Un copy en ESPAÑOL para redes sociales, agresivo, emocional, con llamada a la acción y 2-3 hashtags.

Responde ESTRICTAMENTE en JSON: { "imagePrompt": "...", "caption": "..." }`;

      userContent = `Idea creativa a transformar:
- Protagonista: ${generatedIdea.protagonist}
- Concepto Visual: ${generatedIdea.visual}
- Gancho Promocional: ${generatedIdea.hook}
- Copy Base: ${generatedIdea.copy}`;

    } else {
      return NextResponse.json({ error: "Faltan datos. Envía matches (modo sports) o generatedIdea (modo creative)." }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { imagePrompt: raw, caption: "" };
    }

    return NextResponse.json({
      success: true,
      imagePrompt: result.imagePrompt || "",
      caption: result.caption || "",
    });

  } catch (error: any) {
    console.error("[SPORTS-PROMPT] Error:", error);
    return NextResponse.json({ error: error.message || "Error generando prompt deportivo." }, { status: 500 });
  }
}
