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

// Fetch estadísticas del equipo (goles, limpias, falla en anotar, tarjetas…) temporada actual
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

// Normaliza las estadísticas de temporada a un resumen compacto para el prompt
type SeasonSummary = {
  played: { home: number; away: number; total: number };
  record: { home: string; away: string; total: string }; // "V-E-D"
  goalsFor: { home: number; away: number; total: number; avgHome: string; avgAway: string; avgTotal: string };
  goalsAgainst: { home: number; away: number; total: number; avgHome: string; avgAway: string; avgTotal: string };
  cleanSheets: { home: number; away: number; total: number };
  failedToScore: { home: number; away: number; total: number };
  biggestStreak: { wins: number; draws: number; loses: number };
  mostFrequentScore: string;
  lateGoalsShare: number | null; // % de goles anotados después del 76'
  earlyGoalsShare: number | null; // % goles en primer 30'
  secondHalfShare: number | null; // % goles en segunda mitad
  yellowAvg: number | null;
  redAvg: number | null;
  form: string | null; // "WDLWW" cadena de últimos partidos de la temporada según API
};

function summarizeSeasonStats(raw: any): SeasonSummary | null {
  if (!raw) return null;
  try {
    const f = raw.fixtures || {};
    const g = raw.goals || {};
    const cs = raw.clean_sheet || {};
    const fts = raw.failed_to_score || {};
    const big = raw.biggest || {};
    const cards = raw.cards || {};

    const homeWins = f.wins?.home || 0, homeDraws = f.draws?.home || 0, homeLoses = f.loses?.home || 0;
    const awayWins = f.wins?.away || 0, awayDraws = f.draws?.away || 0, awayLoses = f.loses?.away || 0;
    const totWins = f.wins?.total || 0, totDraws = f.draws?.total || 0, totLoses = f.loses?.total || 0;

    // Distribución de goles por minuto (para/contra) — para inferir tendencia tempranero/tardío
    const minuteBuckets = g.for?.minute || {};
    let totalMinuteGoals = 0;
    let lateGoals = 0;
    let earlyGoals = 0;
    let secondHalfGoals = 0;
    for (const bucket of Object.keys(minuteBuckets)) {
      const entry = minuteBuckets[bucket] || {};
      const total = entry.total || 0;
      if (!total) continue;
      totalMinuteGoals += total;
      // Buckets típicos: "0-15", "16-30", "31-45", "46-60", "61-75", "76-90", "91-105", "106-120"
      if (/^76-/.test(bucket) || /^91-/.test(bucket) || /^106-/.test(bucket)) lateGoals += total;
      if (/^0-/.test(bucket) || /^16-/.test(bucket)) earlyGoals += total;
      if (/^(46|61|76|91|106)-/.test(bucket)) secondHalfGoals += total;
    }

    // Promedio de tarjetas por partido (suma minutos y divide entre partidos jugados)
    function sumCardBuckets(cardObj: any): number {
      let total = 0;
      for (const key of Object.keys(cardObj || {})) {
        total += cardObj[key]?.total || 0;
      }
      return total;
    }
    const yellowTotal = sumCardBuckets(cards.yellow);
    const redTotal = sumCardBuckets(cards.red);
    const played = f.played?.total || 0;

    return {
      played: { home: f.played?.home || 0, away: f.played?.away || 0, total: played },
      record: {
        home: `${homeWins}V-${homeDraws}E-${homeLoses}D`,
        away: `${awayWins}V-${awayDraws}E-${awayLoses}D`,
        total: `${totWins}V-${totDraws}E-${totLoses}D`,
      },
      goalsFor: {
        home: g.for?.total?.home || 0,
        away: g.for?.total?.away || 0,
        total: g.for?.total?.total || 0,
        avgHome: String(g.for?.average?.home ?? "0"),
        avgAway: String(g.for?.average?.away ?? "0"),
        avgTotal: String(g.for?.average?.total ?? "0"),
      },
      goalsAgainst: {
        home: g.against?.total?.home || 0,
        away: g.against?.total?.away || 0,
        total: g.against?.total?.total || 0,
        avgHome: String(g.against?.average?.home ?? "0"),
        avgAway: String(g.against?.average?.away ?? "0"),
        avgTotal: String(g.against?.average?.total ?? "0"),
      },
      cleanSheets: { home: cs.home || 0, away: cs.away || 0, total: cs.total || 0 },
      failedToScore: { home: fts.home || 0, away: fts.away || 0, total: fts.total || 0 },
      biggestStreak: {
        wins: big.streak?.wins || 0,
        draws: big.streak?.draws || 0,
        loses: big.streak?.loses || 0,
      },
      mostFrequentScore: raw.goals?.for?.most_frequent_score || "—",
      lateGoalsShare: totalMinuteGoals > 0 ? Math.round((lateGoals / totalMinuteGoals) * 100) : null,
      earlyGoalsShare: totalMinuteGoals > 0 ? Math.round((earlyGoals / totalMinuteGoals) * 100) : null,
      secondHalfShare: totalMinuteGoals > 0 ? Math.round((secondHalfGoals / totalMinuteGoals) * 100) : null,
      yellowAvg: played > 0 ? Number((yellowTotal / played).toFixed(2)) : null,
      redAvg: played > 0 ? Number((redTotal / played).toFixed(2)) : null,
      form: typeof raw.form === "string" ? raw.form.slice(-6) : null,
    };
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

    // Traer forma de ambos equipos + H2H + estadísticas de temporada en paralelo
    const [homeFixtures, awayFixtures, h2hData, homeSeasonRaw, awaySeasonRaw] = await Promise.all([
      homeId ? fetchLastFixtures(sport, homeId, apiKey, 5) : Promise.resolve([]),
      awayId ? fetchLastFixtures(sport, awayId, apiKey, 5) : Promise.resolve([]),
      (homeId && awayId && sport === "football") ? fetchH2H(homeId, awayId, apiKey, 5) : Promise.resolve({ summary: "sin datos", matches: [] }),
      (homeId && leagueId && sport === "football") ? fetchTeamStatistics(homeId, leagueId, apiKey) : Promise.resolve(null),
      (awayId && leagueId && sport === "football") ? fetchTeamStatistics(awayId, leagueId, apiKey) : Promise.resolve(null),
    ]);

    let homeForm = "sin datos";
    let awayForm = "sin datos";
    let homeData: ReturnType<typeof summarizeFootballForm> | null = null;
    let awayData: ReturnType<typeof summarizeFootballForm> | null = null;
    const homeSeason = summarizeSeasonStats(homeSeasonRaw);
    const awaySeason = summarizeSeasonStats(awaySeasonRaw);

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
    if (odds?.dc1X) oddsExtras.push(`Doble Oportunidad 1X: ${odds.dc1X}`);
    if (odds?.dc12) oddsExtras.push(`Doble Oportunidad 12: ${odds.dc12}`);
    if (odds?.dcX2) oddsExtras.push(`Doble Oportunidad X2: ${odds.dcX2}`);
    if (odds?.cornersOver && odds?.cornersLine) oddsExtras.push(`Corners +${odds.cornersLine}: ${odds.cornersOver}`);
    if (odds?.cornersUnder && odds?.cornersLine) oddsExtras.push(`Corners -${odds.cornersLine}: ${odds.cornersUnder}`);
    if (odds?.cardsOver && odds?.cardsLine) oddsExtras.push(`Tarjetas +${odds.cardsLine}: ${odds.cardsOver}`);
    if (odds?.cardsUnder && odds?.cardsLine) oddsExtras.push(`Tarjetas -${odds.cardsLine}: ${odds.cardsUnder}`);
    if (odds?.firstHalfOver05) oddsExtras.push(`Gol 1ª mitad Sí: ${odds.firstHalfOver05}`);
    if (odds?.firstHalfUnder05) oddsExtras.push(`Gol 1ª mitad No: ${odds.firstHalfUnder05}`);
    const oddsExtrasLine = oddsExtras.length > 0 ? `Cuotas adicionales: ${oddsExtras.join(" · ")}` : "";

    // Contexto de temporada (rendimiento general + splits local/visitante + tendencia de gol por minuto)
    function seasonBlock(teamName: string, s: SeasonSummary | null, role: "L" | "V"): string {
      if (!s) return "";
      const roleLabel = role === "L" ? "jugando de LOCAL" : "jugando de VISITANTE";
      const roleRecord = role === "L" ? s.record.home : s.record.away;
      const roleGf = role === "L" ? s.goalsFor.avgHome : s.goalsFor.avgAway;
      const roleGa = role === "L" ? s.goalsAgainst.avgHome : s.goalsAgainst.avgAway;
      const roleCs = role === "L" ? s.cleanSheets.home : s.cleanSheets.away;
      const roleFts = role === "L" ? s.failedToScore.home : s.failedToScore.away;
      const rolePlayed = role === "L" ? s.played.home : s.played.away;
      const tendencias: string[] = [];
      if (s.lateGoalsShare !== null) tendencias.push(`${s.lateGoalsShare}% de sus goles caen después del minuto 75`);
      if (s.earlyGoalsShare !== null) tendencias.push(`${s.earlyGoalsShare}% en los primeros 30'`);
      if (s.secondHalfShare !== null) tendencias.push(`${s.secondHalfShare}% en la segunda mitad`);
      const cardsLine = s.yellowAvg !== null || s.redAvg !== null
        ? `Prom. tarjetas/partido: ${s.yellowAvg ?? "?"} amarillas · ${s.redAvg ?? "?"} rojas.`
        : "";
      return `\n[TEMPORADA ${teamName}] Global: ${s.record.total} en ${s.played.total} partidos | ${roleLabel}: ${roleRecord} en ${rolePlayed} juegos, ${roleGf} GF/partido y ${roleGa} GC/partido, ${roleCs} porterías a cero y ${roleFts} juegos sin anotar. Racha máxima de victorias: ${s.biggestStreak.wins}. Marcador más frecuente: ${s.mostFrequentScore}. ${tendencias.length ? `Tendencia de minuto: ${tendencias.join(", ")}.` : ""} ${cardsLine} Forma API: ${s.form || "—"}.`;
    }

    // Construir contexto expandido de forma (últimos 5 + temporada completa)
    let homeContext = `Forma reciente ${homeTeam}: ${homeForm}` + seasonBlock(homeTeam, homeSeason, "L");
    let awayContext = `Forma reciente ${awayTeam}: ${awayForm}` + seasonBlock(awayTeam, awaySeason, "V");

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
1. Últimos 5 partidos de CADA equipo (racha, goles, tendencias de remate).
2. Historial directo H2H entre ambos equipos (si está disponible).
3. Factor local/visitante — compara rendimiento del local EN CASA contra rendimiento del visitante DE VISITA usando los splits de temporada (GF/GC promedio, porterías a cero, juegos sin anotar).
4. Tendencia de goles: promedios, Over/Under, BTTS, y distribución por minuto (goles tardíos/tempraneros).
5. Corners promedio y tarjetas promedio (prom. amarillas/rojas por partido, si están).
6. Cuotas del mercado — cruza probabilidad implícita con la probabilidad real según stats. Si hay Doble Oportunidad, Corners O/U, Tarjetas O/U o Gol 1ª mitad, úsalas.
7. Marcador más frecuente histórico del local/visitante.

ESTRUCTURA EXACTA (JSON):
{
  "tldr": "una línea con el veredicto principal",
  "analysis": "5-7 oraciones de análisis profundo, citando resultados específicos, el H2H, splits local/visitante y datos estadísticos CONCRETOS (promedios, porcentajes, rachas). MENCIONA partidos concretos con marcadores.",
  "predictedScore": "el marcador más probable (ej: '2-1')",
  "keyDrivers": ["3 a 5 bullets con los datos/insights más decisivos que sostienen el pronóstico, cada uno de máx. 12 palabras"],
  "probabilities": { "home": 0-100, "draw": 0-100, "away": 0-100 },
  "markets": [
    {
      "market": "nombre del mercado",
      "pick": "la selección sugerida",
      "confidence": "Alta/Media/Baja",
      "odd": "cuota decimal si está en los datos, si no omite el campo",
      "reasoning": "1 oración justificando con datos"
    }
  ],
  "parlay": {
    "picks": ["pick 1", "pick 2", "pick 3"],
    "combinedConfidence": "Alta/Media/Baja",
    "estimatedOdd": "cuota total estimada (multiplica las cuotas individuales si están disponibles)",
    "description": "1 oración vendedora de por qué esta combinada tiene valor"
  },
  "riskyParlay": {
    "picks": ["pick 1", "pick 2", "pick 3"],
    "description": "1 oración explicando que es la combinada de mayor retorno pero más riesgo"
  },
  "valueBet": {
    "market": "el mercado con mejor valor",
    "pick": "la selección",
    "odd": "la cuota si está disponible",
    "reasoning": "por qué la cuota está por encima de la probabilidad real"
  },
  "pick": "el pick PRINCIPAL (el de mayor confianza)",
  "confidence": "Alta/Media/Baja",
  "caption": "Copy listo para IG/WhatsApp/TikTok, 5-7 líneas, con emojis y tono profesional. DEBE incluir: enfrentamiento, hora, pick principal, marcador predicho, 1-2 picks secundarios, y CTA para apostar. Menciona el H2H si es relevante."
}

MERCADOS A CUBRIR (prioriza los que tengan cuota en los datos, y si no existen, dedúcelos con base estadística):
A) 1X2 (ganador del partido).
B) Doble Oportunidad (1X / 12 / X2).
C) Over/Under 2.5 goles.
D) Ambos Equipos Anotan (BTTS Sí/No).
E) Corners totales (usa la línea que veas en las cuotas si está; si no, propón 8.5 / 9.5).
F) Tarjetas totales (línea 3.5 o 4.5).
G) Handicap asiático o europeo (-1, +1, -1.5).
H) Primera mitad: resultado o Gol en la 1ª mitad Sí/No.
I) Resultado exacto probable (1-0, 2-1, etc.).
J) Primer equipo en anotar.

REGLAS:
- Genera MÍNIMO 7 mercados y MÁXIMO 10, cubriendo al menos 1X2 + Doble Oportunidad + Over/Under + BTTS + 1 mercado de corners + 1 mercado de tarjetas + 1 mercado de primera mitad O resultado exacto.
- "probabilities" debe sumar 100.
- SIEMPRE incluye marcador predicho + combinada segura + combinada de riesgo (riskyParlay) distinta.
- Si "odd" no está en los datos, omite ese campo (NUNCA lo inventes).
- Si identificas una value bet (probabilidad real mayor a la implícita de la cuota), inclúyela explicando el edge.
- NO inventes estadísticas. Si no hay datos, reduce la confianza a "Baja" y dilo.
- En el caption, cita brevemente 1 dato puntual (marcador reciente, racha, H2H) para credibilidad.`;

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
      temperature: 0.55,
      max_tokens: 1800,
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
      homeSeason,
      awaySeason,
      h2h: h2hData,
      odds: odds || null,
      forecast,
    });
  } catch (error: any) {
    console.error("[MATCH-FORECAST] Error:", error);
    return NextResponse.json({ error: error.message || "Error generando pronóstico." }, { status: 500 });
  }
}
