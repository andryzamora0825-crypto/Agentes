"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Brain, Trophy, Copy, Check, AlertCircle, Search, Clock, Sparkles, Target,
} from "lucide-react";
import VipGate from "@/components/VipGate";

const SPORTS = [
  { id: "football",   label: "Fútbol",     emoji: "⚽" },
  { id: "basketball", label: "Baloncesto", emoji: "🏀" },
  { id: "baseball",   label: "Béisbol",    emoji: "⚾" },
  { id: "tennis",     label: "Tenis",      emoji: "🎾" },
];

interface Match {
  id: number;
  home: string;
  away: string;
  homeId?: number;
  awayId?: number;
  time: string;
  league: string;
  status: string;
}

interface Forecast {
  tldr?: string;
  analysis?: string;
  pick?: string;
  confidence?: string;
  caption?: string;
}

export default function PronosticosPage() {
  return (
    <VipGate>
      <PronosticosContent />
    </VipGate>
  );
}

function PronosticosContent() {
  const [sport, setSport] = useState("football");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Match | null>(null);

  const [oddsFor, setOddsFor] = useState<{ home?: number | null; draw?: number | null; away?: number | null } | null>(null);

  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [homeForm, setHomeForm] = useState<string>("");
  const [awayForm, setAwayForm] = useState<string>("");

  const [copied, setCopied] = useState(false);

  const loadMatches = useCallback(async (sportId: string) => {
    setLoadingMatches(true);
    setMatchError(null);
    setMatches([]);
    setSelected(null);
    setForecast(null);
    setOddsFor(null);
    try {
      const res = await fetch(`/api/sports/matches?sport=${sportId}`);
      const data = await res.json();
      if (data.success) {
        setMatches(data.matches || []);
        if ((data.matches || []).length === 0) {
          setMatchError("No hay partidos hoy para este deporte.");
        }
      } else {
        setMatchError(data.error || "Error cargando partidos.");
      }
    } catch {
      setMatchError("Error de conexión.");
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  useEffect(() => { loadMatches(sport); }, [sport, loadMatches]);

  const handleSelect = async (m: Match) => {
    setSelected(m);
    setForecast(null);
    setForecastError(null);
    setOddsFor(null);
    try {
      const res = await fetch(`/api/sports/odds?sport=${sport}&fixtures=${m.id}`);
      const data = await res.json();
      const row = data?.odds?.[0];
      if (row) setOddsFor({ home: row.home, draw: row.draw, away: row.away });
    } catch { /* ignorar */ }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setLoadingForecast(true);
    setForecastError(null);
    setForecast(null);

    try {
      const res = await fetch("/api/ai/match-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport,
          homeTeam: selected.home,
          awayTeam: selected.away,
          homeId: selected.homeId,
          awayId: selected.awayId,
          league: selected.league,
          time: selected.time,
          odds: oddsFor || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setForecast(data.forecast);
        setHomeForm(data.homeForm || "");
        setAwayForm(data.awayForm || "");
      } else {
        setForecastError(data.error || "Error generando pronóstico.");
      }
    } catch (e: any) {
      setForecastError(e.message || "Error de conexión.");
    } finally {
      setLoadingForecast(false);
    }
  };

  const handleCopyCaption = () => {
    if (!forecast?.caption) return;
    navigator.clipboard.writeText(forecast.caption).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const q = search.toLowerCase().trim();
  const filtered = q
    ? matches.filter(m =>
        m.home.toLowerCase().includes(q) ||
        m.away.toLowerCase().includes(q) ||
        m.league.toLowerCase().includes(q)
      )
    : matches;

  const confidenceColor = (c: string | undefined) => {
    const v = (c || "").toLowerCase();
    if (v.includes("alta")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (v.includes("media")) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25">
          <Brain className="w-6 h-6 text-indigo-300" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            Pronósticos IA
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[10px] font-bold uppercase tracking-widest">
              VIP
            </span>
          </h1>
          <p className="text-sm text-zinc-400">Análisis + caption comercial con datos reales de forma reciente y cuotas.</p>
        </div>
      </div>

      {/* Deportes */}
      <div className="flex flex-wrap gap-2">
        {SPORTS.map(s => (
          <button
            key={s.id}
            onClick={() => setSport(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              sport === s.id
                ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-200"
                : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.15]"
            }`}
          >
            <span className="mr-1.5">{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Columna de partidos */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar equipo o liga..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-[#0A0A0A] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40"
            />
          </div>

          {loadingMatches && (
            <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando partidos...
            </div>
          )}

          {matchError && !loadingMatches && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {matchError}
            </div>
          )}

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {filtered.map(m => {
              const isActive = selected?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all border ${
                    isActive
                      ? "bg-indigo-500/12 border-indigo-500/30"
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? "text-white" : "text-white/70"}`}>
                      {m.home} vs {m.away}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">{m.league}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    <span className="text-[11px] font-mono text-zinc-400">{m.time}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Columna de pronóstico */}
        <div className="lg:col-span-3 space-y-4">
          {!selected && (
            <div className="p-8 rounded-2xl border border-dashed border-white/[0.08] text-center">
              <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Selecciona un partido a la izquierda para generar su pronóstico.</p>
            </div>
          )}

          {selected && (
            <div className="p-4 rounded-2xl bg-[#0F0F12] border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-300/80">Partido seleccionado</p>
                  <h2 className="text-lg font-bold text-white mt-0.5">{selected.home} vs {selected.away}</h2>
                  <p className="text-xs text-zinc-500">{selected.league} · {selected.time}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {oddsFor && (
                    <div className="flex items-center gap-1 text-[10px]">
                      {oddsFor.home && <span className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 font-mono">1: {oddsFor.home.toFixed(2)}</span>}
                      {oddsFor.draw && <span className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 font-mono">X: {oddsFor.draw.toFixed(2)}</span>}
                      {oddsFor.away && <span className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 font-mono">2: {oddsFor.away.toFixed(2)}</span>}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loadingForecast}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loadingForecast ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analizando datos...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> {forecast ? "Regenerar pronóstico" : "Generar pronóstico"}
                  </>
                )}
              </button>

              {forecastError && (
                <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {forecastError}
                </div>
              )}

              {forecast && (
                <div className="mt-5 space-y-3">
                  {(homeForm || awayForm) && (
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-zinc-500 uppercase tracking-widest font-bold">{selected.home}</p>
                        <p className="font-mono text-white/80 mt-0.5">{homeForm || "—"}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-zinc-500 uppercase tracking-widest font-bold">{selected.away}</p>
                        <p className="font-mono text-white/80 mt-0.5">{awayForm || "—"}</p>
                      </div>
                    </div>
                  )}

                  {forecast.tldr && (
                    <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-300 mb-1">Veredicto</p>
                      <p className="text-sm text-white/90 font-semibold">{forecast.tldr}</p>
                    </div>
                  )}

                  {forecast.analysis && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Análisis</p>
                      <p className="text-xs text-white/80 leading-relaxed">{forecast.analysis}</p>
                    </div>
                  )}

                  {(forecast.pick || forecast.confidence) && (
                    <div className="flex items-center gap-2">
                      {forecast.pick && (
                        <div className="flex-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                          <Target className="w-4 h-4 text-amber-300 shrink-0" />
                          <div>
                            <p className="text-[9px] uppercase tracking-widest font-bold text-amber-300">Pick sugerido</p>
                            <p className="text-sm text-white font-bold">{forecast.pick}</p>
                          </div>
                        </div>
                      )}
                      {forecast.confidence && (
                        <div className={`px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${confidenceColor(forecast.confidence)}`}>
                          Confianza: {forecast.confidence}
                        </div>
                      )}
                    </div>
                  )}

                  {forecast.caption && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-300">Caption listo para redes</p>
                        <button
                          onClick={handleCopyCaption}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors"
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                      <p className="text-xs text-white/85 whitespace-pre-wrap leading-relaxed">{forecast.caption}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
