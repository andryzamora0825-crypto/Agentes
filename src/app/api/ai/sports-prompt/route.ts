import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { matches, mode, generatedIdea, sport } = body;

    // ═══ VOCABULARIO VISUAL POR DEPORTE ═══
    const SPORT_VOCAB: Record<string, { arena: string; action: string; ball: string; trophy: string; players: string; gear: string; celebration: string }> = {
      football: {
        arena: "estadio de fútbol nocturno con reflectores épicos y césped impecable",
        action: "ejecutando una chilena espectacular, pateando un tiro libre o driblando rivales",
        ball: "balón de fútbol oficial",
        trophy: "copa/trofeo dorado del torneo",
        players: "futbolistas con sus camisetas y shorts oficiales, botines de fútbol",
        gear: "botines, espinilleras, guantes de portero",
        celebration: "celebrando un gol con brazos extendidos, deslizándose de rodillas por el césped"
      },
      basketball: {
        arena: "cancha de baloncesto profesional NBA con duela brillante y tableros iluminados",
        action: "clavando un mate espectacular, lanzando un triple desde media cancha o driblando entre rivales",
        ball: "balón de baloncesto oficial naranja",
        trophy: "trofeo Larry O'Brien / copa del campeonato de baloncesto",
        players: "jugadores de baloncesto con jerseys, shorts largos y zapatillas deportivas de alto rendimiento",
        gear: "zapatillas de baloncesto, muñequeras, cintillos",
        celebration: "golpeando su pecho con el puño, colgándose del aro tras un mate"
      },
      tennis: {
        arena: "cancha de tenis profesional (arcilla, césped o superficie dura) con gradas repletas",
        action: "ejecutando un saque poderoso, un revés cruzado devastador o una volea en la red",
        ball: "pelota de tenis amarilla en movimiento",
        trophy: "copa/trofeo plateado de Grand Slam o torneo ATP",
        players: "tenistas con polo deportivo, falda/shorts técnicos y calzado de tenis profesional",
        gear: "raqueta de tenis profesional, muñequera, vincha deportiva",
        celebration: "levantando la raqueta al cielo, cayendo de rodillas en la cancha con emoción"
      },
      baseball: {
        arena: "estadio de béisbol profesional MLB de noche con reflectores y diamante impecable",
        action: "bateando un home run con swing poderoso, lanzando una recta de fuego o atrapando una pelota en diving catch",
        ball: "pelota de béisbol con costuras rojas",
        trophy: "trofeo Commissioner's Trophy / copa del campeonato de béisbol",
        players: "beisbolistas con uniforme completo: camiseta, pantalones, gorra y guante de béisbol",
        gear: "bate de béisbol, guante de béisbol, casco de bateo, gorra",
        celebration: "saltando sobre home plate, lanzando el bate al aire tras un home run"
      },
      "american-football": {
        arena: "estadio de fútbol americano NFL con campo verde marcado con yardas y graderío masivo",
        action: "lanzando un pase de touchdown perfecto, corriendo con el balón esquivando tackles o interceptando un pase",
        ball: "balón de fútbol americano ovalado de cuero",
        trophy: "trofeo Vince Lombardi plateado del Super Bowl",
        players: "jugadores de fútbol americano con casco, hombreras, jersey y pantalones con protecciones",
        gear: "casco con facemask, hombreras, guantes de receptor",
        celebration: "haciendo un spike del balón en la end zone, levantando el trofeo"
      },
      hockey: {
        arena: "pista de hockey sobre hielo profesional NHL con hielo impecable y vallas de cristal",
        action: "disparando un slapshot potente, deteniendo un tiro imposible o peleando por el puck en las vallas",
        ball: "puck de hockey negro deslizándose sobre el hielo",
        trophy: "Copa Stanley brillando con efecto cromado",
        players: "jugadores de hockey con casco, jersey, pantalones acolchados y patines de hielo",
        gear: "stick de hockey, patines de hielo, casco con visor, guantes de hockey",
        celebration: "levantando la Copa Stanley sobre su cabeza, deslizándose de rodillas sobre el hielo"
      },
      volleyball: {
        arena: "cancha de voleibol profesional con red oficial y tribunas repletas de aficionados",
        action: "ejecutando un remate devastador sobre la red, haciendo una clavada o realizando un bloqueo espectacular",
        ball: "balón de voleibol oficial tricolor",
        trophy: "copa/trofeo dorado de campeonato de voleibol",
        players: "jugadores de voleibol con camiseta sin mangas y shorts cortos deportivos",
        gear: "rodilleras deportivas, muñequeras",
        celebration: "gritando y golpeando el suelo con el puño, abrazo de equipo en la cancha"
      },
      handball: {
        arena: "cancha de handball profesional indoor con portería y tribunas",
        action: "saltando en el aire y lanzando un tiro potente a portería, realizando una finta espectacular",
        ball: "balón de handball",
        trophy: "copa/trofeo dorado de campeonato de handball",
        players: "jugadores de handball con camiseta ajustada y shorts, zapatillas indoor",
        gear: "muñequeras, resina en las manos",
        celebration: "corriendo hacia las tribunas con brazos abiertos"
      },
      rugby: {
        arena: "estadio de rugby con campo de césped y postes en H al fondo, noche lluviosa épica",
        action: "corriendo con el balón ovalado esquivando placajes, ejecutando un tackle demoledor o pateando a postes",
        ball: "balón ovalado de rugby",
        trophy: "copa Webb Ellis o trofeo de campeonato de rugby",
        players: "jugadores de rugby con jersey ceñido, shorts cortos y tacos de rugby, sin casco ni protecciones",
        gear: "protector bucal, vendas en las piernas, scrum cap",
        celebration: "formando un huddle de equipo, levantando el trofeo bajo la lluvia"
      },
      boxing: {
        arena: "ring de boxeo profesional con cuerdas, esquinas y reflectores cenitales, humo dramático",
        action: "lanzando un gancho devastador, esquivando un golpe con footwork elegante o conectando un uppercut",
        ball: "guantes de boxeo rojos/dorados con impacto de sudor volando",
        trophy: "cinturón de campeón mundial de boxeo con placas doradas",
        players: "boxeadores con shorts de boxeo brillantes, guantes, vendas y sin camiseta, cuerpo atlético",
        gear: "guantes de boxeo, vendas en las manos, protector bucal",
        celebration: "levantando los brazos en victoria, mostrando el cinturón de campeón"
      },
      mma: {
        arena: "octágono de UFC/MMA con malla metálica, luces cenitales azules y rojas, ambiente de combate",
        action: "conectando un rodillazo volador, ejecutando una llave de sumisión o lanzando una patada giratoria",
        ball: "guantes de MMA pequeños con nudillos expuestos, puños vendados",
        trophy: "cinturón de campeón UFC con placa octagonal dorada",
        players: "peleadores de MMA con shorts de combate, guantes pequeños, sin camiseta, tatuajes y cuerpo definido",
        gear: "guantes de MMA, protector bucal, vendas en las manos, espinilleras opcionales",
        celebration: "subido a la malla del octágono celebrando, mostrando el cinturón UFC en alto"
      },
      motorsport: {
        arena: "circuito de carreras profesional de noche con luces LED en las curvas, recta principal iluminada",
        action: "acelerando a máxima velocidad por la recta, adelantando en una curva cerrada con chispas volando del asfalto",
        ball: "casco de piloto con visor reflejante y diseño personalizado",
        trophy: "trofeo de primer lugar de Gran Premio con champagne explotando",
        players: "pilotos con traje de carreras ignífugo con logos de patrocinadores, casco puesto o en mano",
        gear: "casco de carreras, guantes de piloto, traje ignífugo, HANS device",
        celebration: "de pie sobre el podio rociando champagne, con el trofeo en alto y confeti cayendo"
      },
    };

    // Detectar vocabulario del deporte (default: football)
    const sportKey = sport || "football";
    const vocab = SPORT_VOCAB[sportKey] || SPORT_VOCAB["football"];

    const aiSettings: any = user.publicMetadata?.aiSettings || {};
    const agencyName = aiSettings.agencyName || "Ecuabet";
    const agencyDesc = aiSettings.agencyDesc || "Casa de apuestas premium";
    const primaryColor = aiSettings.primaryColor || "#FFDE00";
    const secondaryColor = aiSettings.secondaryColor || "#000000";
    const contactNumber = aiSettings.contactNumber || "";
    const extraContact = aiSettings.extraContact || "";

    // ═══ FECHA LEGIBLE (ES) ═══ Ej: "23 ABR" / "23 ABRIL 2026"
    const now = new Date();
    const MESES_CORTOS = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
    const MESES_LARGOS = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
    const dd = now.getDate();
    const dateShort = `${dd} ${MESES_CORTOS[now.getMonth()]}`;
    const dateLong  = `${dd} DE ${MESES_LARGOS[now.getMonth()]} ${now.getFullYear()}`;

    // ═══ CTA OBLIGATORIO — frases genuinas de recarga/acción ═══
    const RECHARGE_CTAS = [
      "¡RECARGA YA!",
      "RECARGA TU SALDO AQUÍ",
      "RECARGA Y GANA",
      "¡APUESTA YA!",
      "¡NO TE QUEDES FUERA!",
      "ENTRA Y GANA",
      "DEPOSITA Y JUEGA",
      "RECARGA AHORA",
      "REGÍSTRATE Y GANA",
      "ÚNETE AL JUEGO",
      "ACTIVA TU BONO HOY",
      "¡DALE PLAY A TU APUESTA!",
      "RECARGA EN SEGUNDOS",
      "TU JUGADA, TU GANANCIA",
      "APUESTA CON LOS PROS",
    ];
    const cta = RECHARGE_CTAS[Math.floor(Math.random() * RECHARGE_CTAS.length)];

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

DEPORTE: El deporte es ${sportKey.toUpperCase()}. Usa EXCLUSIVAMENTE esta ambientación:
- Escenario: ${vocab.arena}
- Jugadores/Deportistas: ${vocab.players}
- Acción típica: ${vocab.action}
- Elemento deportivo: ${vocab.ball}
- Trofeo/Premio: ${vocab.trophy}
- Equipamiento: ${vocab.gear}
- Celebración: ${vocab.celebration}

Genera un JSON con "imagePrompt" y "caption" para: ${m.home} vs ${m.away} a las ${m.time} — ${m.league}.

**imagePrompt** — Prompt en ESPAÑOL, ultra-descriptivo y fotorrealista. Usa SOLO la ambientación del deporte indicado arriba.

═══════════════════════════════════════════════════════════════════
ANTES DE DESCRIBIR NADA VISUAL, DEFINE EL TEXTO IMPRESO EN LA IMAGEN
═══════════════════════════════════════════════════════════════════
Empieza el imagePrompt con el siguiente bloque literal (es una instrucción al modelo de imagen para que renderice texto legible y perfectamente escrito, NO son etiquetas ni metadatos):

"TEXTO OBLIGATORIO IMPRESO EN LA IMAGEN (todos los textos deben quedar perfectamente legibles, sin letras deformadas, bien ortografiados):
• TÍTULO CENTRAL del duelo en tipografía deportiva bold gigante: '${m.home.toUpperCase()} VS ${m.away.toUpperCase()}'
• HORA DEL PARTIDO en badge/recuadro destacado con ícono de reloj, número grande bold color ${primaryColor} sobre fondo ${secondaryColor}: '${m.time}'
• FECHA integrada junto a la hora (tarjeta pequeña o sub-línea): '${dateShort}'
• LIGA/COMPETICIÓN como subtítulo elegante: '${m.league.toUpperCase()}'
• LLAMADA A LA ACCIÓN en banner/botón inferior grande, con color ${primaryColor}, tipografía impactante, estilo botón premium: '${cta}'
• LOGO DE MARCA una sola vez en esquina: '${agencyName.toUpperCase()}'
Estos 6 elementos textuales son MÁS IMPORTANTES que cualquier efecto visual. La imagen es INÚTIL si alguno falta o sale ilegible."

Luego de ese bloque, describe la composición visual. Escoge UNA composición al azar:

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

L) CELEBRACIÓN ÉPICA: Un deportista estrella ${vocab.celebration}, corriendo/moviéndose hacia la cámara con expresión de euforia. Detrás de él, el ${vocab.arena} entero en éxtasis con papel picado y bengalas. Los escudos de ${m.home} y ${m.away} integrados como banderas ondeando en la tribuna. ${vocab.trophy} resplandeciendo en el cielo como constelación.

M) TENSIÓN DE CAMERINO: Vista interior de un vestuario/vestidor de lujo. Un deportista de ${m.home} preparándose con su ${vocab.gear}, mirada de determinación. En reflejo del espejo se ve un deportista de ${m.away} haciendo lo mismo. Los escudos de ambos equipos colgados en las paredes. ${vocab.trophy} visible al fondo del pasillo. Iluminación dramática cálida.

N) GALERÍA DE CAMPEONES: Pasillo oscuro tipo museo con cuadros dorados enmarcados. En dos cuadros centrales: retratos fotorrealistas de jugadores estrella de cada equipo con sus uniformes. Entre los cuadros, la copa de la ${m.league} sobre un pedestal iluminado. Los escudos de los equipos tallados en los marcos dorados. Piso de mármol oscuro con reflejos.

O) CHOQUE FUEGO VS HIELO: Composición dual. Lado izquierdo: jugador de ${m.home} envuelto en llamas y energía roja/dorada. Lado derecho: jugador de ${m.away} envuelto en energía azul/eléctrica y escarcha. El choque de ambas energías en el centro crea una onda expansiva donde flota la copa del torneo. Escudos de los equipos brillando con sus respectivos elementos.

P) PROMO APP MÓVIL: Un smartphone premium en el centro de la imagen mostrando el enfrentamiento en su pantalla. Saliendo de la pantalla emergen jugadores fotorrealistas de ambos equipos en acción, como si saltaran del teléfono a la realidad. Copa del torneo flotando sobre el teléfono. Escudos 3D a los lados. Fondo oscuro con destellos de la marca. Texto "¡Apuesta ya!" integrado con diseño moderno.

REGLAS ESTRICTAS (el texto DEBE aparecer renderizado en la imagen final):
- OBLIGATORIO VISIBLE: "${m.home.toUpperCase()} VS ${m.away.toUpperCase()}" (título), "${m.time}" (hora en badge), "${dateShort}" (fecha), "${m.league.toUpperCase()}" (liga), "${cta}" (CTA en botón/banner inferior).
- NO omitas ninguno de esos textos. NO los resumas. NO uses abreviaciones distintas. Si la composición no da espacio, ajusta layout para que todos quepan legibles.
- Escudos oficiales de AMBOS equipos DEBEN aparecer con acabado 3D o metálico premium.
- Si la liga tiene copa/trofeo, INCLÚYELO en la composición.
- Jugadores DEBEN llevar los uniformes/colores reales de sus equipos.
${contactBlock}
- Logo "${agencyName}" UNA VEZ en posición prominente. PROHÍBE logos duplicados.
- Colores de la marca: ${primaryColor}/${secondaryColor}.
- NUNCA escribas "HOY" ni "MAÑANA": usa la hora "${m.time}" y fecha "${dateShort}" tal cual.
- Máximo 140 palabras. Fotorrealismo publicitario premium. ESPAÑOL.

**caption** — Copy agresivo en ESPAÑOL para redes sociales. Menciona ambos equipos, hora, fecha (${dateShort}), liga y competición. Incluye el CTA "${cta}". Emojis. 2-3 hashtags.${contactNumber ? ` Al final incluye: "📲 Contáctanos: ${contactNumber}${extraContact ? ` / ${extraContact}` : ""}"` : ""}

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

DEPORTE: ${sportKey.toUpperCase()}. Ambientación obligatoria:
- Escenario: ${vocab.arena}
- Deportistas: ${vocab.players}
- Acción: ${vocab.action}
- Elemento: ${vocab.ball}
- Trofeo: ${vocab.trophy}

Tienes ${matchCount} partidos. Genera JSON con "imagePrompt" y "caption".

**imagePrompt** — ESPAÑOL. Fotorrealista. Usa la ambientación del deporte indicado.

═══════════════════════════════════════════════════════════════════
ANTES DE DESCRIBIR NADA VISUAL, DEFINE EL TEXTO IMPRESO EN LA IMAGEN
═══════════════════════════════════════════════════════════════════
Empieza el imagePrompt con el siguiente bloque literal (instrucción al modelo de imagen para renderizar texto legible y perfectamente escrito):

"TEXTO OBLIGATORIO IMPRESO EN LA IMAGEN (todos los textos deben quedar perfectamente legibles, sin letras deformadas ni faltas de ortografía):
• ENCABEZADO: 'CARTELERA ${dateShort}' en tipografía deportiva bold.
• ${matchCount} FILAS DE PARTIDOS, cada una con su propia tarjeta/fila visible y legible:
${matches.map((m: any, i: number) => `   ${i + 1}) '${m.home.toUpperCase()} VS ${m.away.toUpperCase()}' junto con hora '${m.time}' en badge destacado y liga '${m.league.toUpperCase()}' como subtítulo.`).join("\n")}
• LLAMADA A LA ACCIÓN en banner/botón inferior grande con color ${primaryColor}, tipografía impactante: '${cta}'
• LOGO DE MARCA una sola vez en esquina: '${agencyName.toUpperCase()}'
Estos elementos textuales son MÁS IMPORTANTES que cualquier efecto visual. La imagen es INÚTIL si falta algún partido, alguna hora o el CTA."

Luego de ese bloque, describe la composición visual. Escoge UNA composición (NO escribas el nombre de la opción en la imagen):

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

REGLAS ESTRICTAS (todo este texto DEBE aparecer impreso en la imagen final):
- TODOS los ${matchCount} enfrentamientos escritos legiblemente con su hora (${matches.map((m: any) => `"${m.time}"`).join(", ")}) y su liga. Sin excepción, sin resumir, sin omitir.
- Fecha "${dateShort}" visible en el encabezado o cartelera.
- CTA OBLIGATORIO en banner/botón inferior: "${cta}".
- Escudos de los equipos con acabado 3D/metálico visible.
- Jugadores con uniformes reales de sus equipos.
${contactBlock}
- Logo "${agencyName}" UNA VEZ. PROHÍBE logos duplicados o marcas de agua.
- NUNCA escribas "HOY" ni "MAÑANA": usa la fecha "${dateShort}" y las horas reales.
- Colores ${primaryColor}/${secondaryColor}. Fotorrealismo. ESPAÑOL.
- Máximo 160 palabras.

**caption** — AGENDA COMPLETA con TODOS los ${matchCount} partidos. Fecha ${dateLong}. Emojis por deporte. Hora y liga de cada uno. Incluye el CTA "${cta}". 3-5 hashtags.${contactNumber ? ` Al final: "📲 ${contactNumber}${extraContact ? ` / ${extraContact}` : ""}"` : ""}

JSON: { "imagePrompt": "...", "caption": "..." }`;

        userContent = `${matchCount} partidos de hoy:\n${fullMatchList}`;
      }

    } else if (mode === "creative" && generatedIdea) {
      // ── MODO CREATIVO: Idea Combinada ──
      systemPrompt = `Eres un director creativo experto en publicidad de apuestas deportivas y casino para Latinoamérica.
Marca: "${agencyName}" (${agencyDesc}). Colores: ${primaryColor} y ${secondaryColor}.

Transforma la idea en JSON con "imagePrompt" y "caption".

**imagePrompt** — Máximo 140 palabras. ESPAÑOL. Fotorrealismo publicitario premium. Ultra-descriptivo y visual.

═══════════════════════════════════════════════════════════════════
ANTES DE DESCRIBIR NADA VISUAL, DEFINE EL TEXTO IMPRESO EN LA IMAGEN
═══════════════════════════════════════════════════════════════════
Empieza el imagePrompt con el siguiente bloque literal (instrucción al modelo de imagen para renderizar texto legible y perfectamente escrito):

"TEXTO OBLIGATORIO IMPRESO EN LA IMAGEN (legible, sin letras deformadas, bien ortografiado):
• TÍTULO / GANCHO principal en tipografía bold impactante (basado en el gancho de la idea).
• FECHA visible como badge pequeño: '${dateShort}'
• LLAMADA A LA ACCIÓN en banner/botón inferior destacado con color ${primaryColor}: '${cta}'
• LOGO DE MARCA una sola vez en esquina: '${agencyName.toUpperCase()}'
Estos elementos textuales son MÁS IMPORTANTES que cualquier efecto visual."

Luego describe la composición visual basada en la idea.

REGLAS:
- Logo de "${agencyName}" UNA SOLA VEZ, integrado profesionalmente. PROHÍBE logos duplicados.
- CTA "${cta}" OBLIGATORIO visible en la imagen.
- Fecha "${dateShort}" visible en la imagen.
${contactBlock}
**caption** — Copy ESPAÑOL para redes, agresivo, emocional. Incluye el CTA "${cta}" y la fecha ${dateLong}. 2-3 hashtags.${contactNumber ? ` Al final: "📲 ${contactNumber}${extraContact ? ` / ${extraContact}` : ""}"` : ""}

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
