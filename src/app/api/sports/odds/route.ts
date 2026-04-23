import { NextResponse } from "next/server";

// ── Mapeo de deporte → base URL de API-Sports ──
const SPORT_BASE: Record<string, string> = {
  football: "https://v3.football.api-sports.io",
  basketball: "https://v1.basketball.api-sports.io",
  baseball: "https://v1.baseball.api-sports.io",
  tennis: "https://v1.tennis.api-sports.io",
  hockey: "https://v1.hockey.api-sports.io",
  volleyball: "https://v1.volleyball.api-sports.io",
  handball: "https://v1.handball.api-sports.io",
  rugby: "https://v1.rugby.api-sports.io",
  "american-football": "https://v1.american-football.api-sports.io",
};

// Bookmakers preferidos (en orden). Tomamos el primero disponible.
const PREFERRED_BOOKMAKERS = ["Bet365", "Pinnacle", "1xBet", "Betfair", "William Hill"];

interface OddsResult {
  fixtureId: number;
  bookmaker: string | null;
  // 1X2 — ganador local / empate / ganador visitante
  home: number | null;
  draw: number | null;
  away: number | null;
  // Over/Under 2.5 goles
  over25: number | null;
  under25: number | null;
  // Ambos anotan
  bttsYes: number | null;
  bttsNo: number | null;
  updatedAt: string;
}

function emptyOdds(fixtureId: number): OddsResult {
  return {
    fixtureId,
    bookmaker: null,
    home: null, draw: null, away: null,
    over25: null, under25: null,
    bttsYes: null, bttsNo: null,
    updatedAt: new Date().toISOString(),
  };
}

function parseFootballOdds(fixtureId: number, json: any): OddsResult {
  const response = json?.response || [];
  if (!response.length) return emptyOdds(fixtureId);

  const fixture = response[0];
  const bookmakers: any[] = fixture?.bookmakers || [];

  // Elegir bookmaker preferido
  let chosen: any = null;
  for (const name of PREFERRED_BOOKMAKERS) {
    chosen = bookmakers.find(b => (b.name || "").toLowerCase().includes(name.toLowerCase()));
    if (chosen) break;
  }
  if (!chosen) chosen = bookmakers[0];
  if (!chosen) return emptyOdds(fixtureId);

  const result: OddsResult = emptyOdds(fixtureId);
  result.bookmaker = chosen.name || null;

  for (const bet of chosen.bets || []) {
    const betName = (bet.name || "").toLowerCase();
    const values: any[] = bet.values || [];

    if (betName.includes("match winner") || betName === "1x2" || betName.includes("fulltime result")) {
      for (const v of values) {
        const label = (v.value || "").toLowerCase();
        const odd = parseFloat(v.odd);
        if (isNaN(odd)) continue;
        if (label === "home" || label === "1") result.home = odd;
        else if (label === "draw" || label === "x") result.draw = odd;
        else if (label === "away" || label === "2") result.away = odd;
      }
    } else if (betName.includes("goals over/under") || betName.includes("over/under")) {
      for (const v of values) {
        const label = (v.value || "").toLowerCase();
        const odd = parseFloat(v.odd);
        if (isNaN(odd)) continue;
        if (label.includes("over") && label.includes("2.5")) result.over25 = odd;
        else if (label.includes("under") && label.includes("2.5")) result.under25 = odd;
      }
    } else if (betName.includes("both teams") || betName.includes("btts")) {
      for (const v of values) {
        const label = (v.value || "").toLowerCase();
        const odd = parseFloat(v.odd);
        if (isNaN(odd)) continue;
        if (label.includes("yes")) result.bttsYes = odd;
        else if (label.includes("no")) result.bttsNo = odd;
      }
    }
  }

  return result;
}

// Parser genérico para otros deportes (solo 1X2)
function parseGenericOdds(fixtureId: number, json: any): OddsResult {
  const response = json?.response || [];
  if (!response.length) return emptyOdds(fixtureId);

  const fixture = response[0];
  const bookmakers: any[] = fixture?.bookmakers || [];
  let chosen: any = null;
  for (const name of PREFERRED_BOOKMAKERS) {
    chosen = bookmakers.find(b => (b.name || "").toLowerCase().includes(name.toLowerCase()));
    if (chosen) break;
  }
  if (!chosen) chosen = bookmakers[0];
  if (!chosen) return emptyOdds(fixtureId);

  const result: OddsResult = emptyOdds(fixtureId);
  result.bookmaker = chosen.name || null;

  for (const bet of chosen.bets || []) {
    const betName = (bet.name || "").toLowerCase();
    if (betName.includes("winner") || betName.includes("money line") || betName.includes("3way")) {
      for (const v of bet.values || []) {
        const label = (v.value || "").toLowerCase();
        const odd = parseFloat(v.odd);
        if (isNaN(odd)) continue;
        if (label === "home" || label === "1") result.home = odd;
        else if (label === "draw" || label === "x") result.draw = odd;
        else if (label === "away" || label === "2") result.away = odd;
      }
    }
  }

  return result;
}

async function fetchOddsForFixture(
  sport: string,
  fixtureId: number,
  apiKey: string,
): Promise<OddsResult> {
  const baseUrl = SPORT_BASE[sport] || SPORT_BASE.football;
  const endpoint = sport === "football" ? "/odds" : "/odds";
  const param = sport === "football" ? "fixture" : "game";

  try {
    const url = `${baseUrl}${endpoint}?${param}=${fixtureId}`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      // Cuotas cambian — cache corto (10 min)
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      console.warn(`[ODDS] API error ${res.status} para fixture ${fixtureId}`);
      return emptyOdds(fixtureId);
    }
    const json = await res.json();
    return sport === "football"
      ? parseFootballOdds(fixtureId, json)
      : parseGenericOdds(fixtureId, json);
  } catch (e) {
    console.warn(`[ODDS] Error trayendo odds de ${fixtureId}:`, e);
    return emptyOdds(fixtureId);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") || "football";
    const fixturesParam = searchParams.get("fixtures") || "";

    if (!SPORT_BASE[sport]) {
      return NextResponse.json({ error: `Deporte "${sport}" no soportado.` }, { status: 400 });
    }

    const ids = fixturesParam
      .split(",")
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);

    if (ids.length === 0) {
      return NextResponse.json({ error: "Envía ?fixtures=id1,id2,..." }, { status: 400 });
    }
    if (ids.length > 10) {
      return NextResponse.json({ error: "Máximo 10 partidos por consulta." }, { status: 400 });
    }

    const apiKey = process.env.API_SPORTS_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta API_SPORTS_KEY." }, { status: 500 });
    }

    // Traer cuotas en paralelo
    const results = await Promise.all(ids.map(id => fetchOddsForFixture(sport, id, apiKey)));

    return NextResponse.json({
      success: true,
      sport,
      odds: results,
    });
  } catch (error: any) {
    console.error("[ODDS] Error:", error);
    return NextResponse.json({ error: "Error consultando odds." }, { status: 500 });
  }
}
