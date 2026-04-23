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
    const contactNumber = aiSettings.contactNumber || "";
    const extraContact = aiSettings.extraContact || "";

    // Construir bloque de contacto solo si hay datos
    const contactBlock = contactNumber
      ? `- CONTACTO OBLIGATORIO EN LA IMAGEN: Incluye el número "${contactNumber}"${extraContact ? ` y "${extraContact}"` : ""} en la parte inferior de la imagen, con diseño integrado: fondo con franja sutil de color ${primaryColor}, tipografía bold y limpia, con icono de WhatsApp o teléfono al lado. Debe verse profesional, NO flotando sin diseño.`
      : "";

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

        systemPrompt = `Eres un director creativo TOP de publicidad deportiva de apuestas para Latinoamérica. Marca: "${agencyName}" (${agencyDesc}). Colores: ${primaryColor} y ${secondaryColor}.

Genera un JSON con "imagePrompt" y "caption" para: ${m.home} vs ${m.away} a las ${m.time} — ${m.league}.

**imagePrompt** — Prompt en ESPAÑOL, ultra-descriptivo y fotorrealista. Escoge UNA composición al azar:

A) DUELO CARA A CARA CON TROFEO: Composición dividida. Izquierda: un jugador estrella de ${m.home} con su uniforme oficial posando desafiante. Derecha: un jugador estrella de ${m.away} con su uniforme oficial en posición de combate. Entre ambos: el trofeo/copa de la ${m.league} brillando con luz dorada. Los escudos oficiales de ambos equipos flotan sobre cada lado. Fondo de estadio nocturno con reflectores épicos.

B) ACCIÓN DINÁMICA CON ESCUDOS: Un jugador estrella de uno de los equipos ejecutando una jugada espectacular (tiro, regate, chilena) con explosión de energía cinética. Los escudos de ${m.home} y ${m.away} están integrados a los lados con efecto de cristal/metal 3D. El trofeo de la ${m.league} se ve al fondo con resplandor dorado. Partículas de fuego y energía emanan del jugador.

C) PANORÁMICA DE ESTADIO CON JUGADORES: Vista amplia de un estadio repleto de noche con pirotecnia. En primer plano, dos jugadores enfrentados (uno de cada equipo con sus uniformes reales). Los escudos de los equipos están en las esquinas superiores con efecto holográfico. La copa de la competición brilla en el centro superior de la imagen.

D) POSTER CINEMATOGRÁFICO: Estilo póster de película de acción. Un jugador de cada equipo en pose heroica con iluminación dramática de estudio. Los escudos tallados en metal dorado a los costados. Copa del torneo integrada en la parte superior como corona. Fondo oscuro con destellos y humo. Tipografía moderna para los nombres de los equipos.

E) CÁMARA BAJA ÉPICA: Ángulo contrapicado desde el césped. Dos jugadores (uno de cada equipo con sus camisetas) disputando un balón en el aire. Cielo dramático de atardecer/nocturno detrás. Escudos en las esquinas. Copa de la competición reflejada en el césped mojado.

F) CAMPO DE BATALLA: Los jugadores de ambos equipos caminando uno hacia el otro como gladiadores desde extremos opuestos del túnel del estadio. Sus escudos de equipo se proyectan como sombras gigantes en las paredes. La copa del torneo brilla al final del túnel como el premio. Humo, luces volumétricas y tensión máxima.

G) PRESENTACIÓN TV DEPORTIVA: Diseño limpio tipo transmisión oficial de ESPN/FOX. Recuadro central con jugadores de ambos equipos. Escudos en alta resolución a los lados con efecto 3D. Barra inferior de información con el horario. Gráficos limpios, profesionales y modernos.

H) RETRATO DOBLE DE ESTUDIO: Dos retratos side-by-side de jugadores estrella de cada equipo con iluminación Rembrandt. Uniformes oficiales. Gotas de sudor congeladas. Escudos incrustados en marcos metálicos elegantes. Copa flotando sutilmente entre ambos retratos.

I) ARENA DE GLADIADORES: Estadio transformado en coliseo romano moderno. Dos jugadores estrella (uno de ${m.home}, otro de ${m.away}) con sus uniformes reales parados en extremos opuestos de la cancha como gladiadores. Copa de la ${m.league} elevándose desde el centro con rayos de luz dorada. Escudos de los equipos grabados en pilares de piedra a los costados. Público rugiendo en penumbra.

J) SPOTLIGHT DEL TROFEO: Fondo completamente negro. En el centro, la copa/trofeo de la ${m.league} iluminada por un único spotlight cenital dorado. Los escudos de ${m.home} y ${m.away} reflejados en la superficie pulida del trofeo. A los lados, siluetas recortadas de jugadores estrella de cada equipo con sus uniformes. Partículas doradas flotando en el aire.

K) DIAGONAL EXPLOSIVA: Composición dividida en diagonal. Mitad superior-izquierda: jugador de ${m.home} con su camiseta real atacando hacia el frente. Mitad inferior-derecha: jugador de ${m.away} defendiendo con intensidad. La diagonal central es una explosión de energía dorada con el texto del enfrentamiento. Escudos 3D en las esquinas opuestas. Copa de la competición detrás de la explosión.

L) CELEBRACIÓN DE GOL: Un jugador estrella celebrando un gol con los brazos extendidos, corriendo hacia la cámara con expresión de euforia. Detrás de él, el estadio entero en éxtasis con papel picado y bengalas. Los escudos de ${m.home} y ${m.away} integrados como banderas ondeando en la tribuna. Copa de la ${m.league} resplandeciendo en el cielo como constelación.

M) TENSIÓN DE CAMERINO: Vista interior de un vestuario de lujo. Un jugador de ${m.home} sentándose en la banca atándose los botines, mirada de determinación. En reflejo del espejo o pantalla del vestuario se ve un jugador de ${m.away} haciendo lo mismo. Los escudos de ambos equipos colgados en las paredes. Copa del torneo visible al fondo del pasillo hacia la cancha. Iluminación dramática cálida.

N) GALERÍA DE CAMPEONES: Pasillo oscuro tipo museo con cuadros dorados enmarcados. En dos cuadros centrales: retratos fotorrealistas de jugadores estrella de cada equipo con sus uniformes. Entre los cuadros, la copa de la ${m.league} sobre un pedestal iluminado. Los escudos de los equipos tallados en los marcos dorados. Piso de mármol oscuro con reflejos.

O) CHOQUE FUEGO VS HIELO: Composición dual. Lado izquierdo: jugador de ${m.home} envuelto en llamas y energía roja/dorada. Lado derecho: jugador de ${m.away} envuelto en energía azul/eléctrica y escarcha. El choque de ambas energías en el centro crea una onda expansiva donde flota la copa del torneo. Escudos de los equipos brillando con sus respectivos elementos.

P) PROMO APP MÓVIL: Un smartphone premium en el centro de la imagen mostrando el enfrentamiento en su pantalla. Saliendo de la pantalla emergen jugadores fotorrealistas de ambos equipos en acción, como si saltaran del teléfono a la realidad. Copa del torneo flotando sobre el teléfono. Escudos 3D a los lados. Fondo oscuro con destellos de la marca. Texto "¡Apuesta ya!" integrado con diseño moderno.

REGLAS ESTRICTAS:
- Texto "${m.home} vs ${m.away}" y hora "${m.time}" UNA SOLA VEZ, centrado con tipografía deportiva moderna bold.
- Escudos oficiales de AMBOS equipos DEBEN aparecer con acabado 3D o metálico premium.
- Si la liga tiene copa/trofeo, INCLÚYELO en la composición.
- Jugadores DEBEN llevar los uniformes/colores reales de sus equipos.
${contactBlock}
- Logo "${agencyName}" UNA VEZ en posición prominente. PROHÍBE logos duplicados.
- Colores de la marca: ${primaryColor}/${secondaryColor}.
- NUNCA escribas "HOY". Usa la hora real.
- Máximo 100 palabras. Fotorrealismo publicitario premium. ESPAÑOL.

**caption** — Copy agresivo en ESPAÑOL para redes sociales. Menciona ambos equipos, hora, liga y competición. Incluye CTA urgente (ej: "¡Recarga con tiempo!", "¡No te quedes fuera!"). Emojis. 2-3 hashtags.${contactNumber ? ` Al final incluye: "📲 Contáctanos: ${contactNumber}${extraContact ? ` / ${extraContact}` : ""}"` : ""}

JSON: { "imagePrompt": "...", "caption": "..." }`;

        userContent = `Partido: ${m.home} vs ${m.away} | ${m.time} | ${m.league}`;

      } else {
        // ═══════════════════════════════════════════════════
        // MÚLTIPLES PARTIDOS (2-3) — Cartelera con jugadores
        // ═══════════════════════════════════════════════════
        const matchLines = matches
          .map((m: any) => `${m.home} vs ${m.away} (${m.time}) — ${m.league}`)
          .join(" | ");

        const fullMatchList = matches
          .map((m: any) => `⚡ ${m.home} vs ${m.away} — ${m.time} (${m.league})`)
          .join("\n");

        systemPrompt = `Eres un director creativo TOP de publicidad deportiva de apuestas para Latinoamérica. Marca: "${agencyName}" (${agencyDesc}). Colores: ${primaryColor} y ${secondaryColor}.

Tienes ${matchCount} partidos. Genera JSON con "imagePrompt" y "caption".

**imagePrompt** — ESPAÑOL. Fotorrealista. Los enfrentamientos que DEBEN estar escritos legiblemente en la imagen son:
${matches.map((m: any) => `"${m.home} vs ${m.away} — ${m.time}"`).join("\n")}

Escoge UNA composición visual (NO escribas el nombre de la opción en la imagen):

A) PANELES DIVIDIDOS: Imagen dividida en ${matchCount} paneles horizontales. Cada panel muestra un jugador en acción del partido correspondiente con los escudos de ambos equipos y la hora. Franja central vertical dorada con el logo de "${agencyName}". Fondo de estadio nocturno por detrás.

B) CARTELERA ESTADIO NOCTURNO: Interior de un estadio épico de noche con el campo iluminado. Una pantalla/tablero electrónico gigante en el centro muestra los ${matchCount} enfrentamientos organizados con sus horas. Jugadores de los partidos principales en silueta heroica en primer plano. Escudos de los equipos flotando con efecto holográfico.

C) PÓSTER DE JORNADA DEPORTIVA: Diseño oscuro premium con layout vertical. Cada partido tiene su fila: escudos de ambos equipos enfrentados, "vs" en el centro, hora a la derecha. Fondo con textura de estadio/cancha desenfocada. Un jugador destacado de uno de los partidos en pose heroica ocupa la parte superior.

D) TRANSMISIÓN TV MULTI-EVENTO: Layout tipo canal deportivo premium. Grid organizado con ${matchCount} recuadros, cada uno mostrando los escudos de los equipos, el "vs" y la hora. Barra superior con logo de "${agencyName}". Estética broadcast profesional con gráficos limpios tipo ESPN/FOX.

E) COLLAGE ÉPICO: Composición dinámica con jugadores de diferentes partidos emergiendo desde los bordes de la imagen. Los enfrentamientos escritos en tipografía bold moderna en el centro. Escudos de los equipos con efecto metálico. Explosiones de energía y color entre los jugadores. Copa/trofeo brillando en la parte superior.

F) ARENA MULTI-COMBATE: Coliseo deportivo moderno con ${matchCount} arenas/zonas de combate visibles. En cada zona, dos jugadores de los equipos correspondientes enfrentados con sus uniformes reales. Los escudos de cada par flotan sobre su zona. En el centro del coliseo, las copas de las competiciones brillan. Perspectiva aérea angular con iluminación dorada épica.

G) PASILLO DE TROFEOS: Corredor oscuro de museo deportivo con vitrinas iluminadas a los lados. Cada vitrina contiene los escudos enfrentados de un partido con su hora y un mini-trofeo. Al final del pasillo, la copa principal de la competición sobre pedestal dorado. Jugadores en silueta heroica caminando por el pasillo. Piso de mármol con reflejos.

H) ENERGÍA DIAGONAL MÚLTIPLE: Composición con ${matchCount} franjas diagonales energéticas. Cada franja contiene los escudos de un enfrentamiento con su hora, separadas por líneas de energía dorada/eléctrica. Un jugador destacado de cada partido integrado en su franja. Fondo de estadio nocturno. Logo de "${agencyName}" en la esquina inferior con diseño integrado.

I) SALA VIP CON PANTALLAS: Interior de un lounge VIP de apuestas ultra-premium. Múltiples pantallas de TV gigantes en la pared, cada una mostrando un enfrentamiento con los escudos y hora. Mesa de apuestas en primer plano con fichas doradas. Iluminación cálida de bar exclusivo. Los jugadores de los partidos principales aparecen como hologramas emergiendo de las pantallas.

J) GRID MÓVIL APP: Un smartphone premium gigante en el centro de la composición. En su pantalla se muestra un grid organizado con los ${matchCount} partidos: escudos enfrentados, "vs" y hora de cada uno. Desde el teléfono salen rayos de energía y jugadores fotorrealistas emergiendo en 3D. Fondo oscuro con partículas doradas flotantes. Logo de "${agencyName}" integrado en la app.

REGLAS ESTRICTAS:
- TODOS los ${matchCount} enfrentamientos DEBEN aparecer escritos legiblemente con su hora real. Sin excepción.
- Escudos de los equipos con acabado 3D/metálico visible.
- Jugadores con uniformes reales de sus equipos.
${contactBlock}
- Logo "${agencyName}" UNA VEZ. PROHÍBE logos duplicados o marcas de agua.
- NUNCA escribas "HOY". Solo horas reales.
- Colores ${primaryColor}/${secondaryColor}. Fotorrealismo. ESPAÑOL.
- Máximo 100 palabras.

**caption** — AGENDA COMPLETA con TODOS los ${matchCount} partidos. Emojis por deporte. Hora y liga de cada uno. CTA urgente ("¡Recarga con tiempo!", "¡Apuesta ya!"). 3-5 hashtags.${contactNumber ? ` Al final: "📲 ${contactNumber}${extraContact ? ` / ${extraContact}` : ""}"` : ""}

JSON: { "imagePrompt": "...", "caption": "..." }`;

        userContent = `${matchCount} partidos de hoy:\n${fullMatchList}`;
      }

    } else if (mode === "creative" && generatedIdea) {
      // ── MODO CREATIVO: Idea Combinada ──
      systemPrompt = `Eres un director creativo experto en publicidad de apuestas deportivas y casino para Latinoamérica.
Marca: "${agencyName}" (${agencyDesc}). Colores: ${primaryColor} y ${secondaryColor}.

Transforma la idea en JSON con "imagePrompt" y "caption".

**imagePrompt** — Máximo 100 palabras. ESPAÑOL. Fotorrealismo publicitario premium. Ultra-descriptivo y visual.
- Logo de "${agencyName}" UNA SOLA VEZ, integrado profesionalmente. PROHÍBE logos duplicados.
${contactBlock}
**caption** — Copy ESPAÑOL para redes, agresivo, emocional, CTA, 2-3 hashtags.${contactNumber ? ` Al final: "📲 ${contactNumber}${extraContact ? ` / ${extraContact}` : ""}"` : ""}

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
      max_tokens: 700,
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
