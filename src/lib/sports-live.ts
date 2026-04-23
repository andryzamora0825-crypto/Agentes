import { supabase } from "./supabase";

// Ligas priorizadas (reutilizadas del modal)
const TOP_FOOTBALL_LEAGUES = new Set([
  2, 3, 1, 848, 39, 140, 135, 78, 61, 71, 128, 239, 13, 11, 253, 262, 188, 299,
]);

export interface LiveFixture {
  id: number;
  home: string;
  away: string;
  homeId?: number;
  awayId?: number;
  homeLogo?: string;
  awayLogo?: string;
  league: string;
  statusShort: string;
  elapsed: number | null;
  scoreHome: number | null;
  scoreAway: number | null;
  lastEventMinute?: number | null;
  lastEvent?: string;
  lastEventPlayer?: string;
}

function parseFootballLive(data: any): LiveFixture[] {
  const fixtures: any[] = data?.response || [];
  return fixtures
    .map(f => {
      const events: any[] = Array.isArray(f.events) ? f.events : [];
      const last = events[events.length - 1];
      return {
        id: f.fixture?.id || 0,
        home: f.teams?.home?.name || "???",
        away: f.teams?.away?.name || "???",
        homeId: f.teams?.home?.id,
        awayId: f.teams?.away?.id,
        homeLogo: f.teams?.home?.logo,
        awayLogo: f.teams?.away?.logo,
        league: f.league?.name || "",
        statusShort: f.fixture?.status?.short || "1H",
        elapsed: f.fixture?.status?.elapsed ?? null,
        scoreHome: f.goals?.home ?? null,
        scoreAway: f.goals?.away ?? null,
        lastEventMinute: last?.time?.elapsed ?? null,
        lastEvent: last?.type,
        lastEventPlayer: last?.player?.name,
      } as LiveFixture;
    });
}

async function fetchLiveFromApi(apiKey: string): Promise<LiveFixture[]> {
  const url = "https://v3.football.api-sports.io/fixtures?live=all";
  const res = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API-Sports ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return parseFootballLive(json);
}

export type SyncResult =
  | { success: true; skipped: true; reason: "fresh_cache"; ageSeconds: number; fixture_count: number }
  | { success: true; skipped?: false; fixture_count: number; updated_at: string; source: "cron" | "manual" }
  | { success: false; error: string; hint?: string };

/**
 * Ejecuta una sincronización de partidos en vivo.
 *
 * - Rechaza si el caché tiene < 60s de edad (protege la quota de API-Sports).
 * - Hace UNA sola request a API-Sports (`/fixtures?live=all`).
 * - Guarda el snapshot completo en `live_fixtures_cache`.
 *
 * Se llama desde:
 *  - El cron schedule (cada 10 min en horario pico).
 *  - El endpoint manual `/api/sports/live/refresh`.
 */
export async function syncLiveFixtures(source: "cron" | "manual"): Promise<SyncResult> {
  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) {
    return { success: false, error: "Falta API_SPORTS_KEY en variables de entorno." };
  }

  // Rate-limit compartido: si el caché es < 60s fresh, no gastamos quota.
  const { data: existing, error: readErr } = await supabase
    .from("live_fixtures_cache")
    .select("updated_at, fixture_count")
    .eq("id", 1)
    .maybeSingle();

  if (readErr) {
    // Probablemente la tabla no existe
    return {
      success: false,
      error: readErr.message,
      hint: "Ejecuta docs/live_fixtures_cache.sql en Supabase SQL Editor.",
    };
  }

  if (existing?.updated_at) {
    const ageMs = Date.now() - new Date(existing.updated_at).getTime();
    if (ageMs < 60_000) {
      return {
        success: true,
        skipped: true,
        reason: "fresh_cache",
        ageSeconds: Math.round(ageMs / 1000),
        fixture_count: existing.fixture_count || 0,
      };
    }
  }

  let fixtures: LiveFixture[];
  try {
    fixtures = await fetchLiveFromApi(apiKey);
  } catch (e: any) {
    return { success: false, error: e.message || "Error consultando API-Sports." };
  }

  const updatedAt = new Date().toISOString();
  const { error: upsertErr } = await supabase
    .from("live_fixtures_cache")
    .upsert({
      id: 1,
      fixtures,
      fixture_count: fixtures.length,
      updated_at: updatedAt,
      source,
    }, { onConflict: "id" });

  if (upsertErr) {
    return {
      success: false,
      error: upsertErr.message,
      hint: "Verifica que la tabla live_fixtures_cache exista en Supabase.",
    };
  }

  return {
    success: true,
    fixture_count: fixtures.length,
    updated_at: updatedAt,
    source,
  };
}
