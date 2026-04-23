"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Radio, RefreshCw, Loader2, AlertCircle, Trophy, Clock } from "lucide-react";

interface LiveFixture {
  id: number;
  home: string;
  away: string;
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

interface LiveResponse {
  success: boolean;
  fixtures: LiveFixture[];
  fixture_count: number;
  updated_at: string | null;
  age_seconds: number | null;
  stale: boolean;
  source?: string;
}

const STATUS_LABEL: Record<string, string> = {
  "1H": "1er tiempo",
  "2H": "2do tiempo",
  "HT": "Medio tiempo",
  "ET": "Tiempo extra",
  "P": "Penales",
  "BT": "Descanso",
};

function formatAge(ageSeconds: number | null): string {
  if (ageSeconds === null || ageSeconds < 0) return "—";
  if (ageSeconds < 60) return `hace ${ageSeconds}s`;
  const min = Math.floor(ageSeconds / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h}h ${min % 60}m`;
}

export default function LiveMatchesPage() {
  const [data, setData] = useState<LiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [ticker, setTicker] = useState(0); // fuerza re-render para "hace X segs"

  const loadLive = useCallback(async () => {
    try {
      const res = await fetch("/api/sports/live", { cache: "no-store" });
      const json: LiveResponse = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError((json as any).error || "Error leyendo caché live.");
      }
    } catch (e: any) {
      setError(e.message || "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial + polling cada 30s (solo lee Supabase, no gasta API de pago)
  useEffect(() => {
    loadLive();
    const interval = setInterval(loadLive, 30_000);
    return () => clearInterval(interval);
  }, [loadLive]);

  // Tick cada 10s para que el "hace X segs" se actualice en pantalla
  useEffect(() => {
    const t = setInterval(() => setTicker(x => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch("/api/sports/live/refresh", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        if (json.refreshed === false && json.reason === "cache_fresh") {
          setRefreshMsg(`Caché actualizado hace ${json.age_seconds || 0}s — ya estás al día.`);
        } else {
          setRefreshMsg(`Actualizado: ${json.fixture_count || 0} partidos en vivo.`);
          await loadLive();
        }
      } else {
        setRefreshMsg(json.error || "Error refrescando.");
      }
    } catch (e: any) {
      setRefreshMsg(e.message || "Error de conexión.");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(null), 4000);
    }
  }, [refreshing, loadLive]);

  const fixtures = data?.fixtures || [];
  // Para mostrar edad en tiempo real, recalculamos basándonos en updated_at
  const liveAgeSec = data?.updated_at
    ? Math.max(0, Math.round((Date.now() - new Date(data.updated_at).getTime()) / 1000))
    : null;

  // Tick-based invalidation for age display
  void ticker;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/25">
              <Radio className="w-6 h-6 text-red-300" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              Partidos EN VIVO
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25 text-[10px] font-bold uppercase tracking-widest">
                LIVE
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Marcador y minuto actual de las ligas top. {data?.updated_at && (
                <span className={data.stale ? "text-amber-400" : "text-emerald-400"}>
                  Actualizado {formatAge(liveAgeSec)}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:bg-white/[0.07] hover:border-white/[0.15] transition-all disabled:opacity-50 text-sm font-semibold"
        >
          {refreshing
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {refreshMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs">
          {refreshMsg}
        </div>
      )}

      {data?.stale && !loading && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">El caché está desactualizado.</p>
            <p className="text-amber-200/70 mt-0.5">
              El sincronizador automático corre cada 10 minutos durante horario pico.
              Si estás fuera de ese rango, pulsa "Actualizar".
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && fixtures.length === 0 && (
        <div className="text-center py-20">
          <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No hay partidos en vivo de las ligas top en este momento.</p>
          <p className="text-xs text-zinc-600 mt-1">Vuelve durante horario de partidos (tarde/noche).</p>
        </div>
      )}

      {!loading && fixtures.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {fixtures.map(f => {
            const minute = f.elapsed !== null ? `${f.elapsed}'` : "—";
            const status = STATUS_LABEL[f.statusShort] || f.statusShort;
            const isHalftime = f.statusShort === "HT" || f.statusShort === "BT";
            return (
              <div
                key={f.id}
                className="p-4 rounded-2xl bg-gradient-to-b from-[#0F1015] to-[#090A0E] border border-white/[0.06] hover:border-red-500/20 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`relative flex h-2 w-2`}>
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isHalftime ? "bg-amber-500" : "bg-red-500"} opacity-75`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isHalftime ? "bg-amber-500" : "bg-red-500"}`} />
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isHalftime ? "text-amber-400" : "text-red-400"}`}>
                      {status}
                    </span>
                  </div>
                  {!isHalftime && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                      <Clock className="w-3 h-3" />
                      {minute}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-zinc-500 truncate mb-3">{f.league}</p>

                <div className="flex items-center gap-2 mb-2">
                  {f.homeLogo && (
                    <img
                      src={f.homeLogo}
                      alt={f.home}
                      className="w-6 h-6 object-contain shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <p className="text-sm font-semibold text-white/90 flex-1 truncate">{f.home}</p>
                  <span className="text-xl font-bold font-mono text-white tabular-nums">{f.scoreHome ?? 0}</span>
                </div>

                <div className="flex items-center gap-2">
                  {f.awayLogo && (
                    <img
                      src={f.awayLogo}
                      alt={f.away}
                      className="w-6 h-6 object-contain shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <p className="text-sm font-semibold text-white/90 flex-1 truncate">{f.away}</p>
                  <span className="text-xl font-bold font-mono text-white tabular-nums">{f.scoreAway ?? 0}</span>
                </div>

                {f.lastEvent && f.lastEventPlayer && (
                  <div className="mt-3 pt-3 border-t border-white/[0.05]">
                    <p className="text-[10px] text-zinc-400">
                      <span className="text-amber-400 font-bold">{f.lastEventMinute ? `${f.lastEventMinute}'` : ""} </span>
                      {f.lastEvent}: <span className="text-white/80">{f.lastEventPlayer}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info sobre el costo de la API */}
      <div className="text-[10px] text-zinc-600 text-center">
        Datos actualizados cada ~10 min durante horario pico · 0 costo por consulta para ti · Plan gratuito de API-Sports.
      </div>
    </div>
  );
}
