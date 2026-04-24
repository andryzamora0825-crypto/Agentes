import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ── CONFIGURACIÓN DE DEPORTES Y LIGAS ──
// Cada deporte tiene su propia URL base en api-sports.io
const SPORT_CONFIG: Record<string, {
  baseUrl: string;
  endpoint: string;
  dateParam: string;
  parser: (data: any) => MatchResult[];
}> = {
  football: {
    baseUrl: "https://v3.football.api-sports.io",
    endpoint: "/fixtures",
    dateParam: "date",
    parser: parseFootball,
  },
  basketball: {
    baseUrl: "https://v1.basketball.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseBasketball,
  },
  baseball: {
    baseUrl: "https://v1.baseball.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseBaseball,
  },
  tennis: {
    baseUrl: "https://v1.tennis.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseTennis,
  },
  hockey: {
    baseUrl: "https://v1.hockey.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseHockey,
  },
  volleyball: {
    baseUrl: "https://v1.volleyball.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseVolleyball,
  },
  handball: {
    baseUrl: "https://v1.handball.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseHandball,
  },
  rugby: {
    baseUrl: "https://v1.rugby.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseRugby,
  },
  "american-football": {
    baseUrl: "https://v1.american-football.api-sports.io",
    endpoint: "/games",
    dateParam: "date",
    parser: parseAmericanFootball,
  },
};

// Ligas de Fútbol admisibles (Top Leagues) para no inundar la UI
const TOP_FOOTBALL_LEAGUES = new Set([
  2,    // Champions League
  3,    // Europa League  
  1,    // World Cup
  848,  // Conference League
  39,   // Premier League
  140,  // La Liga España
  135,  // Serie A Italia
  78,   // Bundesliga
  61,   // Ligue 1
  71,   // Serie A Brasil
  128,  // Liga Pro Ecuador
  239,  // Liga Betplay Colombia
  13,   // Copa Libertadores
  11,   // Copa Sudamericana
  253,  // MLS
  262,  // Liga MX
  188,  // Liga 1 Perú
  299,  // Liga Profesional Argentina
]);

interface MatchResult {
  id: number;
  home: string;
  away: string;
  time: string;
  league: string;
  status: string;
  homeId?: number;
  awayId?: number;
}

// ── PARSERS POR DEPORTE ──
function parseFootball(data: any): MatchResult[] {
  const fixtures = data?.response || [];
  return fixtures
    .filter((f: any) => TOP_FOOTBALL_LEAGUES.has(f.league?.id))
    .map((f: any) => ({
      id: f.fixture?.id || 0,
      home: f.teams?.home?.name || "???",
      away: f.teams?.away?.name || "???",
      homeId: f.teams?.home?.id,
      awayId: f.teams?.away?.id,
      time: formatTime(f.fixture?.date),
      league: f.league?.name || "",
      status: f.fixture?.status?.short || "NS",
    }));
}

function parseBasketball(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.teams?.home?.name || "???",
    away: g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.status?.short || "NS",
  }));
}

function parseBaseball(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.teams?.home?.name || "???",
    away: g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.status?.short || "NS",
  }));
}

function parseTennis(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.players?.home?.name || g.teams?.home?.name || "???",
    away: g.players?.away?.name || g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.status?.short || "NS",
  }));
}

function parseHockey(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.teams?.home?.name || "???",
    away: g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.status?.short || "NS",
  }));
}

function parseVolleyball(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.teams?.home?.name || "???",
    away: g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.status?.short || "NS",
  }));
}

function parseHandball(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.teams?.home?.name || "???",
    away: g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.status?.short || "NS",
  }));
}

function parseRugby(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.teams?.home?.name || "???",
    away: g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.status?.short || "NS",
  }));
}

function parseAmericanFootball(data: any): MatchResult[] {
  const games = data?.response || [];
  return games.map((g: any) => ({
    id: g.id || 0,
    home: g.teams?.home?.name || "???",
    away: g.teams?.away?.name || "???",
    time: formatTime(g.date),
    league: g.league?.name || "",
    status: g.game?.status?.short || "NS",
  }));
}

function formatTime(isoDate: string | undefined | null): string {
  if (!isoDate) return "--:--";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "--:--";

    // Ecuador = UTC-5. Calcular manualmente para evitar problemas
    // con toLocaleTimeString en runtimes serverless de Node.
    const utcMs = d.getTime();
    const ecMs = utcMs + (-5 * 60 * 60 * 1000);
    const ecDate = new Date(ecMs);

    const hours = String(ecDate.getUTCHours()).padStart(2, "0");
    const minutes = String(ecDate.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "--:--";
  }
}

function getTodayDate(): string {
  // Fecha en zona de Ecuador (UTC-5)
  const now = new Date();
  const ecDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }));
  const y = ecDate.getFullYear();
  const m = String(ecDate.getMonth() + 1).padStart(2, "0");
  const d = String(ecDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Genera un bloque que cambia cada 6 horas (Ecuador time).
// Esto asegura que a las 6:00 AM exactas, el parámetro _cb cambie,
// forzando un refresco total de la cartelera sin romper el límite de 100 req/día.
function getCacheWindow(): string {
  const now = new Date();
  const ecDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }));
  return Math.floor(ecDate.getHours() / 6).toString();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") || "football";

    const config = SPORT_CONFIG[sport];
    if (!config) {
      return NextResponse.json({ error: `Deporte "${sport}" no soportado.` }, { status: 400 });
    }

    const apiKey = process.env.API_SPORTS_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta API_SPORTS_KEY en las variables." }, { status: 500 });
    }

    const today = getTodayDate();
    // NOTA: No podemos enviar parámetros extra como _cb a api-sports.io porque rechazan parámetros desconocidos
    const url = `${config.baseUrl}${config.endpoint}?${config.dateParam}=${today}`;

    console.log(`[SPORTS] Fetching ${sport}: ${url}`);

    // ── CACHÉ: 6 horas (21600s) ──
    // Se renovará automáticamente por el cambio de URL (_cb), pero igual bajamos el TTL a 6h.
    // Consumo máximo por deporte: 4 reqs/día. Total 9 deportes = 36 reqs/día (Límite 100).
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 21600, tags: ["sports-matches"] },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[SPORTS] API error (${res.status}):`, errText);
      return NextResponse.json({ error: "Error consultando API-Sports.", detail: errText }, { status: 502 });
    }

    const json = await res.json();
    
    // API-Sports devuelve 200 OK incluso si hay errores de rate-limit
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.error(`[SPORTS] API-Sports Errors:`, json.errors);
      return NextResponse.json({ 
        error: "Error desde el proveedor de deportes.", 
        detail: JSON.stringify(json.errors) 
      }, { status: 502 });
    }

    const matches = config.parser(json);

    // Ordenar por hora
    matches.sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json({ success: true, sport, date: today, matches });
  } catch (error: any) {
    console.error("[SPORTS] Error general:", error);
    return NextResponse.json({ error: error.message || "Error interno." }, { status: 500 });
  }
}
