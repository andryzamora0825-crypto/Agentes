import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';
import os from 'os';

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
  leagueId?: number;
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
      leagueId: f.league?.id,
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
    const url = `${config.baseUrl}${config.endpoint}?${config.dateParam}=${today}`;

    // ── PROTECCIÓN ANTI-BAN EXTREMA (FS Cache + Memory Cache + Coalescing + Rate Limiting) ──
    const globalStore = globalThis as any;
    if (!globalStore._sportsCache) globalStore._sportsCache = {};
    if (!globalStore._sportsPromises) globalStore._sportsPromises = {};
    if (!globalStore._sportsLastFetch) globalStore._sportsLastFetch = 0;

    const cacheKey = `${sport}`;
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    
    // Función auxiliar para caché en disco (Sobrevive reinicios de servidor y Vercel cold starts)
    const getFsCachePath = () => path.join(os.tmpdir(), `sports_cache_${sport}.json`);
    
    let cachedEntry = globalStore._sportsCache[cacheKey];

    // 1. Verificar Caché en Memoria
    if (cachedEntry && cachedEntry.date === today && (Date.now() - cachedEntry.timestamp < SIX_HOURS_MS)) {
      console.log(`[SPORTS] Retornando ${sport} desde caché RAM (Anti-Ban).`);
      return NextResponse.json({ success: true, sport, date: today, matches: cachedEntry.data, source: "memory_cache" });
    }

    // 2. Verificar Caché en Disco Físico (Fallback si la RAM se limpió)
    try {
      const fsPath = getFsCachePath();
      if (fs.existsSync(fsPath)) {
        const fsData = JSON.parse(fs.readFileSync(fsPath, 'utf8'));
        if (fsData.date === today && (Date.now() - fsData.timestamp < SIX_HOURS_MS)) {
          console.log(`[SPORTS] Retornando ${sport} desde caché de DISCO (Anti-Ban).`);
          // Restaurar a la RAM para la próxima vez
          globalStore._sportsCache[cacheKey] = fsData;
          cachedEntry = fsData;
          return NextResponse.json({ success: true, sport, date: today, matches: fsData.data, source: "disk_cache" });
        } else {
          // Guardar caché vieja por si falla la API (Stale-While-Revalidate)
          cachedEntry = fsData; 
        }
      }
    } catch (e) {
      console.log(`[SPORTS] Ignorando error de disco físico:`, e);
    }

    // 3. Promise Coalescing (Evitar Cache Stampede). Si ya hay un fetch en curso, esperamos ese.
    if (globalStore._sportsPromises[cacheKey]) {
      console.log(`[SPORTS] Esperando petición en vuelo para ${sport}...`);
      try {
        const matches = await globalStore._sportsPromises[cacheKey];
        return NextResponse.json({ success: true, sport, date: today, matches, source: "memory_cache_coalesced" });
      } catch (e) {
        // Si la petición en vuelo falla, continuamos e intentamos de nuevo
      }
    }

    // 3. Rate Limiting Básico Global (Max 1 request cada 2 segundos)
    const timeSinceLastFetch = Date.now() - globalStore._sportsLastFetch;
    if (timeSinceLastFetch < 2000) {
      await new Promise(resolve => setTimeout(resolve, 2000 - timeSinceLastFetch));
    }

    console.log(`[SPORTS] Fetching ${sport} externo: ${url}`);
    globalStore._sportsLastFetch = Date.now();

    // 4. Iniciar Fetch y guardarlo globalmente
    const fetchPromise = (async () => {
      const res = await fetch(url, {
        headers: { "x-apisports-key": apiKey },
        next: { revalidate: 21600, tags: ["sports-matches"] },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      if (json.errors && Object.keys(json.errors).length > 0) {
        throw new Error(JSON.stringify(json.errors));
      }
      const matches = config.parser(json);
      matches.sort((a: any, b: any) => a.time.localeCompare(b.time));
      return matches;
    })();

    globalStore._sportsPromises[cacheKey] = fetchPromise;

    try {
      const matches = await fetchPromise;
      
      const cacheData = {
        timestamp: Date.now(),
        date: today,
        data: matches
      };

      // Guardar en la caché local RAM
      globalStore._sportsCache[cacheKey] = cacheData;
      
      // Guardar en caché Física (Disco)
      try {
        fs.writeFileSync(getFsCachePath(), JSON.stringify(cacheData), 'utf8');
      } catch (e) {
        // Ignorar errores de escritura
      }

      delete globalStore._sportsPromises[cacheKey];
      return NextResponse.json({ success: true, sport, date: today, matches, source: "api" });
    } catch (error: any) {
      delete globalStore._sportsPromises[cacheKey];
      console.error(`[SPORTS] Error fetching ${sport}:`, error.message);
      
      // 5. STALE-WHILE-REVALIDATE: Si la API falla (ej. Rate Limit) pero tenemos caché vieja, devolvemos la vieja para no romper la app!
      if (cachedEntry) {
         console.warn(`[SPORTS] API falló. Devolviendo caché STALE para ${sport}.`);
         return NextResponse.json({ success: true, sport, date: today, matches: cachedEntry.data, source: "stale_memory_cache_fallback", warning: error.message });
      }

      return NextResponse.json({ error: "Error desde el proveedor de deportes.", detail: error.message }, { status: 502 });
    }
  } catch (error: any) {
    console.error("[SPORTS] Error general:", error);
    return NextResponse.json({ error: error.message || "Error interno." }, { status: 500 });
  }
}
