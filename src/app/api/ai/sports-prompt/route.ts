import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { matches, mode, generatedIdea } = body;

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
      const matchCount = matches.length;

      if (matchCount === 1) {
        // ═══════════════════════════════════════════════════
        // UN SOLO PARTIDO — Duelo épico con 8 opciones
        // ═══════════════════════════════════════════════════
        const m = matches[0];

        systemPrompt = `Eres un director creativo TOP de publicidad deportiva. Marca: "${agencyName}" (${agencyDesc}). Colores: ${primaryColor} y ${secondaryColor}.

Genera un JSON con "imagePrompt" y "caption" para: ${m.home} vs ${m.away} a las ${m.time}.

**imagePrompt** — Prompt en ESPAÑOL, ultra-descriptivo, fotorrealista. Escoge UNA opción al azar:
A) Cara a Cara: Composición dividida, un jugador por lado en actitud competitiva, iluminación dramática lateral, chispas en el centro.
B) Acción Dinámica: Jugador estrella ejecutando una jugada espectacular (tiro, regate, mate) con explosiones de energía cinética dorada.
C) Cámara Baja Cinemática: Ángulo contrapicado desde el césped, dos jugadores disputando el balón, cielo épico de atardecer detrás.
D) Túnel de Vestuarios: Jugadores emergiendo del túnel oscuro hacia la cancha iluminada, perspectiva profunda, humo dramático.
E) Retrato de Estudio: Primer plano cinematográfico de un jugador con iluminación Rembrandt, gotas de sudor congeladas, fondo desenfocado con colores de la marca.
F) Estadio Aéreo Nocturno: Toma aérea drone de un estadio lleno de noche, pirotecnia y bengalas de colores, la cancha brillando como una joya.
G) Colisión Épica: Dos balones o elementos deportivos chocando en el centro con onda expansiva dorada, fragmentos volando, fondo oscuro con destellos.
H) Diseño Editorial Deportivo: Composición limpia tipo portada de revista deportiva premium, foto principal recortada con tipografía bold, marcos geométricos dorados.

REGLAS: 
- Texto "${m.home} vs ${m.away}" y hora "${m.time}" UNA SOLA VEZ centrados. NUNCA escribas "HOY".
- Logo "${agencyName}" UNA VEZ. Colores ${primaryColor}/${secondaryColor}.
- Máximo 80 palabras en el imagePrompt. Sé denso y visual, no repitas instrucciones.
- Fotorrealismo premium. ESPAÑOL.

**caption** — Copy agresivo en ESPAÑOL para redes. Menciona equipos, hora, liga. Emojis. CTA. 2-3 hashtags.

JSON: { "imagePrompt": "...", "caption": "..." }`;

        userContent = `Partido: ${m.home} vs ${m.away} | ${m.time} | ${m.league}`;

      } else {
        // ═══════════════════════════════════════════════════
        // MÚLTIPLES PARTIDOS — Imagen épica + agenda en caption
        // ═══════════════════════════════════════════════════
        // ESTRATEGIA: El prompt de imagen es CORTO y visual.
        // Solo 2 partidos principales como texto en la imagen.
        // TODOS los partidos van en el caption.

        const headlines = matches.slice(0, 2);
        const headlineText = headlines
          .map((m: any) => `${m.home} vs ${m.away} (${m.time})`)
          .join(" | ");

        const fullMatchList = matches
          .map((m: any) => `⚡ ${m.home} vs ${m.away} — ${m.time} (${m.league})`)
          .join("\n");

        systemPrompt = `Eres un director creativo TOP de publicidad deportiva. Marca: "${agencyName}" (${agencyDesc}). Colores: ${primaryColor} y ${secondaryColor}.

Tienes ${matchCount} partidos. Genera JSON con "imagePrompt" y "caption".

**imagePrompt** — CORTO (máximo 80 palabras). Solo muestra en la imagen: "${headlineText}"${matchCount > 2 ? ` + "${matchCount - 2} partidos más"` : ""}.

Escoge UNA opción al azar:
A) Pantalla LED Deportiva: Estadio nocturno con pantalla LED gigante mostrando los partidos estelares. Atmósfera eléctrica, público en silueta.
B) Collage Split-Screen: ${Math.min(matchCount, 4)} paneles con escenas deportivas, franja central dorada con los enfrentamientos estelares.
C) Cartelera Cinematográfica: Póster estilo película de acción deportiva, jugadores en poses heroicas, título grande con los enfrentamientos.
D) Mesa de Control TV: Layout tipo ESPN/DIRECTV con grid deportivo, partidos en recuadros organizados, estética broadcast profesional.
E) Marquesina de Estadio: Exterior de estadio nocturno imponente, marquesinas LED luminosas con los partidos, reflejos en piso mojado.
F) Portal de Energía: Dos jugadores emergiendo de portales de energía opuestos (dorado vs azul), enfrentamientos escritos en el centro.
G) Banner Holográfico: Hologramas deportivos flotantes con los partidos principales, jugadores como proyecciones 3D, ambiente futurista premium.
H) Tribuna Explosiva: Vista desde cancha hacia tribunas llenas, pirotecnia dorada, banners con enfrentamientos colgando del techo del estadio.

REGLAS:
- Máximo 80 PALABRAS en imagePrompt. Directo y visual.
- Máximo 2-3 líneas de texto visible en la imagen (los partidos estelares).
- Logo "${agencyName}" UNA VEZ. NUNCA escribas "HOY". Usa horas reales.
- Fotorrealismo. ESPAÑOL.

**caption** — AGENDA COMPLETA con TODOS los ${matchCount} partidos. Formato organizado con emojis, hora y liga de cada uno. CTA agresiva. 3-5 hashtags.

JSON: { "imagePrompt": "...", "caption": "..." }`;

        userContent = `${matchCount} partidos para la cartelera:\n${fullMatchList}`;
      }

    } else if (mode === "creative" && generatedIdea) {
      // ── MODO CREATIVO: Idea Combinada ──
      systemPrompt = `Eres un director creativo experto en publicidad de apuestas deportivas y casino.
Marca: "${agencyName}" (${agencyDesc}). Colores: ${primaryColor} y ${secondaryColor}.

Transforma la idea en JSON con "imagePrompt" y "caption".

**imagePrompt** — Máximo 80 palabras. ESPAÑOL. Fotorrealismo publicitario premium. Ultra-descriptivo y visual. Texto visible en ESPAÑOL.
**caption** — Copy ESPAÑOL para redes, agresivo, emocional, CTA, 2-3 hashtags.

JSON: { "imagePrompt": "...", "caption": "..." }`;

      userContent = `Idea:
- Protagonista: ${generatedIdea.protagonist}
- Visual: ${generatedIdea.visual}
- Gancho: ${generatedIdea.hook}
- Copy: ${generatedIdea.copy}`;

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
      temperature: 0.9,
      max_tokens: 600,
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
