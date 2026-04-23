import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

function isVipOrAdmin(user: any): boolean {
  const email = user?.primaryEmailAddress?.emailAddress || "";
  if (email === ADMIN_EMAIL) return true;
  const plan = (user?.publicMetadata as any)?.plan || "FREE";
  const expiresAt = (user?.publicMetadata as any)?.vipExpiresAt as number | undefined | null;
  if (plan !== "VIP") return false;
  if (!expiresAt) return true;
  return Date.now() <= Number(expiresAt);
}

// ── Base URLs API-Sports por deporte ──
const SPORT_BASE: Record<string, string> = {
  football: "https://v3.football.api-sports.io",
  basketball: "https://v1.basketball.api-sports.io",
  baseball: "https://v1.baseball.api-sports.io",
  tennis: "https://v1.tennis.api-sports.io",
};

async function fetchLastFixtures(sport: string, teamId: number, apiKey: string, last = 5): Promise<any[]> {
  try {
    const baseUrl = SPORT_BASE[sport] || SPORT_BASE.football;
    const endpoint = sport === "football" ? "/fixtures" : "/games";
    const teamParam = sport === "football" ? "team" : "team";
    const url = `${baseUrl}${endpoint}?${teamParam}=${teamId}&last=${last}`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.response || [];
  } catch {
    return [];
  }
}

// Fetch estadísticas del equipo (corners, tarjetas, posesión, etc.) desde API-Sports
async function fetchTeamStatistics(teamId: number, leagueId: number | undefined, apiKey: string): Promise<any> {
  if (!leagueId) return null;
  try {
    const season = new Date().getFullYear();
    const url = `https://v3.football.api-sports.io/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.response || null;
  } catch {
    return null;
  }
}

// Fetch Head-to-Head (enfrentamientos directos)
async function fetchH2H(homeId: number, awayId: number, apiKey: string, last = 5): Promise<{ summary: string; matches: string[] }> {
  try {
    const url = `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}&last=${last}`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { summary: "sin datos", matches: [] };
    const data = await res.json();
    const fixtures = data?.response || [];
    if (fixtures.length === 0) return { summary: "sin datos", matches: [] };

    let homeWins = 0, awayWins = 0, draws = 0;
    const matchLines: string[] = [];
    for (const f of fixtures) {
      const gh = f.goals?.home ?? 0;
      const ga = f.goals?.away ?? 0;
      const hName = f.teams?.home?.name || "?";
      const aName = f.teams?.away?.name || "?";
      const isHomeTeamHome = f.teams?.home?.id === homeId;

      if (gh > ga) { if (isHomeTeamHome) homeWins++; else awayWins++; }
      else if (ga > gh) { if (isHomeTeamHome) awayWins++; else homeWins++; }
      else draws++;

      const date = f.fixture?.date ? new Date(f.fixture.date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
      matchLines.push(`${hName} ${gh}-${ga} ${aName} (${date})`);
    }

    return {
      summary: `${homeWins}V-${draws}E-${awayWins}D en últimos ${fixtures.length} H2H`,
      matches: matchLines,
    };
  } catch {
    return { summary: "sin datos", matches: [] };
  }
}

// Resume los últimos N partidos con data expandida
function summarizeFootballForm(teamId: number, fixtures: any[]): {
  form: string; goalsFor: number; goalsAgainst: number; summary: string;
  cornersFor: number; cornersAgainst: number; yellowCards: number; redCards: number;
  cleanSheets: number; bttsCount: number; over25Count: number; matchDetails: string[];
} {
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  let cornersFor = 0, cornersAgainst = 0, yellowCards = 0, redCards = 0;
  let cleanSheets = 0, bttsCount = 0, over25Count = 0;
  const lines: string[] = [];
  const matchDetails: string[] = [];

  for (const f of fixtures) {
    const home = f.teams?.home;
    const away = f.teams?.away;
    const goals = f.goals;
    const stats = f.statistics || [];
    if (!home || !away || !goals) continue;
    const isHome = home.id === teamId;
    const ownGoals = isHome ? goals.home : goals.away;
    const rivalGoals = isHome ? goals.away : goals.home;
    gf += ownGoals || 0;
    ga += rivalGoals || 0;

    // Ambos anotaron
    if ((ownGoals || 0) > 0 && (rivalGoals || 0) > 0) bttsCount++;
    // Over 2.5
    if (((ownGoals || 0) + (rivalGoals || 0)) > 2) over25Count++;
    // Clean sheet
    if ((rivalGoals || 0) === 0) cleanSheets++;

    if (ownGoals === null || rivalGoals === null) continue;
    if (ownGoals > rivalGoals) wins++;
    else if (ownGoals === rivalGoals) draws++;
    else losses++;

    const rivalName = isHome ? away.name : home.name;
    const result = ownGoals > rivalGoals ? "✅" : ownGoals === rivalGoals ? "🟡" : "❌";
    lines.push(`${result} ${ownGoals}-${rivalGoals} vs ${rivalName}`);

    // Extraer estadísticas del fixture (corners, tarjetas)
    if (stats.length >= 2) {
      const teamStats = isHome ? stats[0]?.statistics : stats[1]?.statistics;
      if (teamStats) {
        for (const s of teamStats) {
          const type = (s.type || "").toLowerCase();
          const val = parseInt(s.value) || 0;
          if (type.includes("corner")) cornersFor += val;
          if (type.includes("yellow")) yellowCards += val;
          if (type.includes("red")) redCards += val;
        }
      }
      const rivalStats = isHome ? stats[1]?.statistics : stats[0]?.statistics;
      if (rivalStats) {
        for (const s of rivalStats) {
          if ((s.type || "").toLowerCase().includes("corner")) cornersAgainst += parseInt(s.value) || 0;
        }
      }
    }

    matchDetails.push(`${result} ${ownGoals}-${rivalGoals} vs ${rivalName}${isHome ? ' (L)' : ' (V)'}`);
  }

  const form = `${wins}V-${draws}E-${losses}D`;
  return {
    form, goalsFor: gf, goalsAgainst: ga,
    summary: lines.join("; "),
    cornersFor, cornersAgainst, yellowCards, redCards,
    cleanSheets, bttsCount, over25Count,
    matchDetails,
  };
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!isVipOrAdmin(user)) {
      return NextResponse.json({ error: "Función disponible solo para agentes VIP." }, { status: 403 });
    }

    const apiKey = process.env.API_SPORTS_KEY;
    if (!apiKey) return NextResponse.json({ error: "Falta API_SPORTS_KEY." }, { status: 500 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Falta OPENAI_API_KEY." }, { status: 500 });

    const body = await request.json();
    const { sport = "football", homeTeam, awayTeam, homeId, awayId, league, leagueId, time, odds } = body;

    if (!homeTeam || !awayTeam) {
      return NextResponse.json({ error: "Faltan homeTeam/awayTeam." }, { status: 400 });
    }

    // Traer forma de ambos equipos + H2H en paralelo
    const [homeFixtures, awayFixtures, h2hData] = await Promise.all([
      homeId ? fetchLastFixtures(sport, homeId, apiKey, 5) : Promise.resolve([]),
      awayId ? fetchLastFixtures(sport, awayId, apiKey, 5) : Promise.resolve([]),
      (homeId && awayId && sport === "football") ? fetchH2H(homeId, awayId, apiKey, 5) : Promise.resolve({ summary: "sin datos", matches: [] }),
    ]);

    let homeForm = "sin datos";
    let awayForm = "sin datos";
    let homeData: ReturnType<typeof summarizeFootballForm> | null = null;
    let awayData: ReturnType<typeof summarizeFootballForm> | null = null;

    if (sport === "football" && homeId) {
      homeData = summarizeFootballForm(homeId, homeFixtures);
      homeForm = `${homeData.form} · ${homeData.goalsFor}GF/${homeData.goalsAgainst}GC`;
    }
    if (sport === "football" && awayId) {
      awayData = summarizeFootballForm(awayId, awayFixtures);
      awayForm = `${awayData.form} · ${awayData.goalsFor}GF/${awayData.goalsAgainst}GC`;
    }

    // Construir prompt para GPT
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const oddsLine = odds && (odds.home || odds.away || odds.draw)
      ? `Cuotas 1X2: ${homeTeam} ${odds.home ?? "?"} · Empate ${odds.draw ?? "?"} · ${awayTeam} ${odds.away ?? "?"}.`
      : "";

    const oddsExtras: string[] = [];
    if (odds?.over25) oddsExtras.push(`Over 2.5: ${odds.over25}`);
    if (odds?.under25) oddsExtras.push(`Under 2.5: ${odds.under25}`);
    if (odds?.bttsYes) oddsExtras.push(`BTTS Sí: ${odds.bttsYes}`);
    if (odds?.bttsNo) oddsExtras.push(`BTTS No: ${odds.bttsNo}`);
    const oddsExtrasLine = oddsExtras.length > 0 ? `Cuotas adicionales: ${oddsExtras.join(" · ")}` : "";

    // Construir contexto expandido de forma
    let homeContext = `Forma reciente ${homeTeam}: ${homeForm}`;
    let awayContext = `Forma reciente ${awayTeam}: ${awayForm}`;

    if (homeData) {
      homeContext += `\nÚltimos 5 partidos: ${homeData.matchDetails.join(" | ")}`;
      homeContext += `\nGoles marcados: ${homeData.goalsFor}, Goles recibidos: ${homeData.goalsAgainst}`;
      if (homeData.cornersFor > 0) homeContext += `, Corners a favor: ${homeData.cornersFor}, Corners en contra: ${homeData.cornersAgainst}`;
      homeContext += `, Porterías imbatidas: ${homeData.cleanSheets}/5`;
      homeContext += `, Partidos donde ambos anotaron (BTTS): ${homeData.bttsCount}/5`;
      homeContext += `, Partidos con +2.5 goles: ${homeData.over25Count}/5`;
      if (homeData.yellowCards > 0) homeContext += `, Tarjetas amarillas: ${homeData.yellowCards}`;
    }
    if (awayData) {
      awayContext += `\nÚltimos 5 partidos: ${awayData.matchDetails.join(" | ")}`;
      awayContext += `\nGoles marcados: ${awayData.goalsFor}, Goles recibidos: ${awayData.goalsAgainst}`;
      if (awayData.cornersFor > 0) awayContext += `, Corners a favor: ${awayData.cornersFor}, Corners en contra: ${awayData.cornersAgainst}`;
      awayContext += `, Porterías imbatidas: ${awayData.cleanSheets}/5`;
      awayContext += `, Partidos donde ambos anotaron (BTTS): ${awayData.bttsCount}/5`;
      awayContext += `, Partidos con +2.5 goles: ${awayData.over25Count}/5`;
      if (awayData.yellowCards > 0) awayContext += `, Tarjetas amarillas: ${awayData.yellowCards}`;
    }

    // Contexto H2H
    let h2hContext = "";
    if (h2hData.matches.length > 0) {
      h2hContext = `\nHISTORIAL DIRECTO (H2H, últimos ${h2hData.matches.length}):\n${h2hData.summary}\nPartidos: ${h2hData.matches.join(" | ")}`;
    }

    const systemPrompt = `Eres un analista deportivo profesional y experto en predicciones para una casa de apuestas latinoamericana.
Tu trabajo es producir un PRONÓSTICO EXPANDIDO, PRECISO y COMERCIAL, con tono seguro, data-driven, pero genuino. Siempre en español neutro.

ANALIZA OBLIGATORIAMENTE:
1. Últimos 5 partidos de CADA equipo (racha, goles, tendencias)
2. Historial directo H2H entre ambos equipos (si está disponible)
3. Factor local/visitante
4. Tendencia de goles (Over/Under, BTTS)
5. Corners promedio si los datos están disponibles
6. Cuotas del mercado (identificar value bets si la cuota no refleja la realidad estadística)

ESTRUCTURA EXACTA (JSON):
{
  "tldr": "una línea con el veredicto principal",
  "analysis": "4-6 oraciones de análisis profundo, citando resultados específicos recientes, el H2H, y datos estadísticos. MENCIONA partidos concretos y marcadores.",
  "predictedScore": "el marcador más probable (ej: '2-1')",
  "markets": [
    {
      "market": "nombre del mercado",
      "pick": "la selección sugerida",
      "confidence": "Alta/Media/Baja",
      "reasoning": "1 oración justificando con datos"
    }
  ],
  "parlay": {
    "picks": ["pick 1", "pick 2", "pick 3"],
    "combinedConfidence": "Alta/Media/Baja",
    "description": "1 oración vendedora de por qué esta combinada tiene valor"
  },
  "valueBet": {
    "market": "el mercado con mejor valor",
    "pick": "la selección",
    "reasoning": "por qué la cuota está por encima de la probabilidad real"
  },
  "pick": "el pick PRINCIPAL (el de mayor confianza)",
  "confidence": "Alta/Media/Baja",
  "caption": "Copy listo para IG/WhatsApp/TikTok, 5-7 líneas, con emojis y tono profesional. DEBE incluir: enfrentamiento, hora, pick principal, marcador predicho, 1-2 picks secundarios, y CTA para apostar. Menciona el H2H si es relevante."
}

REGLAS:
- Genera MÍNIMO 4 mercados y MÁXIMO 7 (siempre incluye 1X2, Over/Under, BTTS, y al menos un mercado de especialidad como Corners, Resultado Exacto, Handicap, o Primera Mitad).
- SIEMPRE incluye un marcador predicho.
- SIEMPRE incluye una combinada (parlay) de 2-3 picks.
- Si identificas una value bet (cuota que no refleja la probabilidad real), inclúyela.
- NO inventes estadísticas. Si no hay datos, reduce la confianza.
- En el caption, cita brevemente resultados recientes y el H2H para credibilidad.`;

    const userContent = `Partido: ${homeTeam} vs ${awayTeam}
Liga: ${league || "sin especificar"}
Hora: ${time || "sin especificar"}
${oddsLine}
${oddsExtrasLine}

${homeContext}

${awayContext}
${h2hContext}

Genera el JSON pronóstico expandido completo.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let forecast: any = {};
    try { forecast = JSON.parse(raw); } catch { forecast = { analysis: raw }; }

    return NextResponse.json({
      success: true,
      match: `${homeTeam} vs ${awayTeam}`,
      homeForm,
      awayForm,
      homeStats: homeData ? {
        cornersFor: homeData.cornersFor,
        cornersAgainst: homeData.cornersAgainst,
        cleanSheets: homeData.cleanSheets,
        bttsCount: homeData.bttsCount,
        over25Count: homeData.over25Count,
        yellowCards: homeData.yellowCards,
        matchDetails: homeData.matchDetails,
      } : null,
      awayStats: awayData ? {
        cornersFor: awayData.cornersFor,
        cornersAgainst: awayData.cornersAgainst,
        cleanSheets: awayData.cleanSheets,
        bttsCount: awayData.bttsCount,
        over25Count: awayData.over25Count,
        yellowCards: awayData.yellowCards,
        matchDetails: awayData.matchDetails,
      } : null,
      h2h: h2hData,
      forecast,
    });
  } catch (error: any) {
    console.error("[MATCH-FORECAST] Error:", error);
    return NextResponse.json({ error: error.message || "Error generando pronóstico." }, { status: 500 });
  }
}
