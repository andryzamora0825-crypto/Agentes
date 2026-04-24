"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, Trophy, Copy, Check, AlertCircle, Search, Clock, Sparkles, Target,
  Flame, BarChart3, TrendingUp, Shield, Zap, Gauge, ChevronRight, Dice5, Radar,
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
  leagueId?: number;
  status: string;
}

interface MarketPick {
  market: string;
  pick: string;
  confidence: string;
  odd?: string | number;
  reasoning: string;
}

interface Forecast {
  tldr?: string;
  analysis?: string;
  pick?: string;
  confidence?: string;
  caption?: string;
  markets?: MarketPick[];
  predictedScore?: string;
  keyDrivers?: string[];
  probabilities?: { home?: number; draw?: number; away?: number };
  parlay?: { picks: string[]; combinedConfidence: string; estimatedOdd?: string | number; description: string };
  riskyParlay?: { picks: string[]; description: string };
  valueBet?: { market: string; pick: string; odd?: string | number; reasoning: string };
}

interface H2HData {
  summary: string;
  matches: string[];
}

interface TeamStats {
  cornersFor: number;
  cornersAgainst: number;
  cleanSheets: number;
  bttsCount: number;
  over25Count: number;
  yellowCards: number;
  matchDetails: string[];
}

interface SeasonSummary {
  played: { home: number; away: number; total: number };
  record: { home: string; away: string; total: string };
  goalsFor: { home: number; away: number; total: number; avgHome: string; avgAway: string; avgTotal: string };
  goalsAgainst: { home: number; away: number; total: number; avgHome: string; avgAway: string; avgTotal: string };
  cleanSheets: { home: number; away: number; total: number };
  failedToScore: { home: number; away: number; total: number };
  biggestStreak: { wins: number; draws: number; loses: number };
  mostFrequentScore: string;
  lateGoalsShare: number | null;
  earlyGoalsShare: number | null;
  secondHalfShare: number | null;
  yellowAvg: number | null;
  redAvg: number | null;
  form: string | null;
}

interface OddsPayload {
  home?: number | null; draw?: number | null; away?: number | null;
  over25?: number | null; under25?: number | null;
  bttsYes?: number | null; bttsNo?: number | null;
  dc1X?: number | null; dc12?: number | null; dcX2?: number | null;
  cornersOver?: number | null; cornersUnder?: number | null; cornersLine?: number | null;
  cardsOver?: number | null; cardsUnder?: number | null; cardsLine?: number | null;
  firstHalfOver05?: number | null; firstHalfUnder05?: number | null;
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

  const [oddsFor, setOddsFor] = useState<OddsPayload | null>(null);
  const [oddsLoading, setOddsLoading] = useState(false);

  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [homeForm, setHomeForm] = useState<string>("");
  const [awayForm, setAwayForm] = useState<string>("");
  const [homeStats, setHomeStats] = useState<TeamStats | null>(null);
  const [awayStats, setAwayStats] = useState<TeamStats | null>(null);
  const [homeSeason, setHomeSeason] = useState<SeasonSummary | null>(null);
  const [awaySeason, setAwaySeason] = useState<SeasonSummary | null>(null);
  const [h2h, setH2h] = useState<H2HData | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const loadMatches = useCallback(async (sportId: string) => {
    setLoadingMatches(true);
    setMatchError(null);
    setMatches([]);
    setSelected(null);
    setForecast(null);
    setOddsFor(null);
    setHomeStats(null);
    setAwayStats(null);
    setHomeSeason(null);
    setAwaySeason(null);
    setH2h(null);
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
    setHomeStats(null);
    setAwayStats(null);
    setHomeSeason(null);
    setAwaySeason(null);
    setH2h(null);
    setOddsLoading(true);
    try {
      const res = await fetch(`/api/sports/odds?sport=${sport}&fixtures=${m.id}`);
      const data = await res.json();
      const row = data?.odds?.[0];
      if (row) setOddsFor({
        home: row.home, draw: row.draw, away: row.away,
        over25: row.over25, under25: row.under25,
        bttsYes: row.bttsYes, bttsNo: row.bttsNo,
        dc1X: row.dc1X, dc12: row.dc12, dcX2: row.dcX2,
        cornersOver: row.cornersOver, cornersUnder: row.cornersUnder, cornersLine: row.cornersLine,
        cardsOver: row.cardsOver, cardsUnder: row.cardsUnder, cardsLine: row.cardsLine,
        firstHalfOver05: row.firstHalfOver05, firstHalfUnder05: row.firstHalfUnder05,
      });
    } catch { /* ignorar */ }
    finally { setOddsLoading(false); }
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
          leagueId: selected.leagueId,
          time: selected.time,
          odds: oddsFor || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setForecast(data.forecast);
        setHomeForm(data.homeForm || "");
        setAwayForm(data.awayForm || "");
        setHomeStats(data.homeStats || null);
        setAwayStats(data.awayStats || null);
        setHomeSeason(data.homeSeason || null);
        setAwaySeason(data.awaySeason || null);
        setH2h(data.h2h || null);
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

  const handleShareAll = () => {
    if (!forecast || !selected) return;
    const lines: string[] = [
      `🏆 *${selected.home} vs ${selected.away}*`,
      `📅 ${selected.league} · ${selected.time}`,
      '',
    ];
    if (forecast.predictedScore) lines.push(`⚽ Marcador predicho: *${forecast.predictedScore}*`);
    if (forecast.pick) lines.push(`🎯 Pick principal: *${forecast.pick}* (${forecast.confidence || '—'})`);
    if (forecast.markets?.length) {
      lines.push('', '📊 *Mercados:*');
      forecast.markets.forEach(m => lines.push(`${confidenceBadge(m.confidence)} ${m.market}: *${m.pick}*${m.odd ? ` @ ${m.odd}` : ''} — ${m.reasoning}`));
    }
    if (forecast.parlay) {
      lines.push('', `🔥 *Combinada segura:* ${forecast.parlay.picks.join(' + ')} (${forecast.parlay.combinedConfidence}${forecast.parlay.estimatedOdd ? ` @ ${forecast.parlay.estimatedOdd}` : ''})`);
    }
    if (forecast.riskyParlay) {
      lines.push(`⚡ *Combinada de riesgo:* ${forecast.riskyParlay.picks.join(' + ')}`);
    }
    if (forecast.valueBet) {
      lines.push(`💎 *Value Bet:* ${forecast.valueBet.pick}${forecast.valueBet.odd ? ` @ ${forecast.valueBet.odd}` : ''} — ${forecast.valueBet.reasoning}`);
    }
    if (h2h && h2h.matches.length > 0) {
      lines.push('', `🤝 *H2H:* ${h2h.summary}`);
    }
    if (homeForm || awayForm) {
      lines.push('', `📈 Forma: ${selected.home} ${homeForm} | ${selected.away} ${awayForm}`);
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
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
    if (v.includes("alta")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    if (v.includes("media")) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  };

  const confidenceBadge = (c: string | undefined) => {
    const v = (c || "").toLowerCase();
    if (v.includes("alta")) return "🟢";
    if (v.includes("media")) return "🟡";
    return "🔴";
  };

  // Probabilidades implícitas de las cuotas 1X2 (para comparar con las del modelo)
  const impliedProbs = useMemo(() => {
    if (!oddsFor?.home || !oddsFor?.draw || !oddsFor?.away) return null;
    const invH = 1 / oddsFor.home;
    const invD = 1 / oddsFor.draw;
    const invA = 1 / oddsFor.away;
    const sum = invH + invD + invA;
    return {
      home: Math.round((invH / sum) * 100),
      draw: Math.round((invD / sum) * 100),
      away: Math.round((invA / sum) * 100),
    };
  }, [oddsFor]);

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-white">
      {/* ── HERO / HEADER tipo sportsbook ── */}
      <div className="relative overflow-hidden border-b border-emerald-500/10 bg-gradient-to-b from-emerald-500/[0.06] to-transparent">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(16,185,129,0.8) 1px, transparent 0)",
          backgroundSize: "24px 24px"
        }} />
        <div className="relative max-w-6xl mx-auto px-6 py-6 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <Radar className="w-6 h-6 text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-white">Pronosticador IA</h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest">
                VIP · LIVE DATA
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Análisis multi-mercado con datos reales: forma reciente, temporada completa, H2H, corners, tarjetas y value bets.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-5">
        {/* Deportes — chips estilo sportsbook */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          {SPORTS.map(s => (
            <button
              key={s.id}
              onClick={() => setSport(s.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                sport === s.id
                  ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span className="mr-1.5">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* ─────── Columna izquierda: cartelera ─────── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar equipo o liga..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-[#0E0F13] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {loadingMatches && (
              <div className="flex items-center justify-center py-10 text-zinc-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando cartelera...
              </div>
            )}

            {matchError && !loadingMatches && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {matchError}
              </div>
            )}

            <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-1">
              {filtered.map(m => {
                const isActive = selected?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m)}
                    className={`group w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all border ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                        : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-emerald-500/20"
                    }`}
                  >
                    <div className={`w-1 h-10 rounded-full transition-colors ${isActive ? "bg-emerald-400" : "bg-white/10 group-hover:bg-emerald-500/40"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? "text-white" : "text-white/80"}`}>
                        {m.home} <span className="text-zinc-600 font-normal">vs</span> {m.away}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate uppercase tracking-wider">{m.league}</p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        <span className="text-[11px] font-mono font-bold text-zinc-300">{m.time}</span>
                      </div>
                      <ChevronRight className={`w-3 h-3 mt-1 transition-transform ${isActive ? "text-emerald-400 translate-x-0.5" : "text-zinc-700"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─────── Columna derecha: bet-slip style ─────── */}
          <div className="lg:col-span-3 space-y-4">
            {!selected && (
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-transparent p-10 text-center">
                <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-zinc-400">Selecciona un partido</p>
                <p className="text-xs text-zinc-600 mt-1">La IA analizará últimos 5 partidos, temporada completa, H2H y cuotas en vivo.</p>
              </div>
            )}

            {selected && (
              <div className="rounded-2xl bg-gradient-to-b from-[#10141C] to-[#0B0E13] border border-white/[0.06] overflow-hidden">
                {/* Header del partido */}
                <div className="relative px-5 py-4 border-b border-white/[0.05] bg-gradient-to-r from-emerald-500/[0.04] via-transparent to-transparent">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-300/70">{selected.league}</p>
                      <h2 className="text-lg sm:text-xl font-black text-white mt-0.5 truncate">
                        {selected.home}
                        <span className="text-zinc-600 font-normal mx-2">vs</span>
                        {selected.away}
                      </h2>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                      <Clock className="w-3 h-3 text-emerald-300" />
                      <span className="text-xs font-mono font-black text-emerald-200">{selected.time}</span>
                    </div>
                  </div>
                </div>

                {/* Board de cuotas — estilo sportsbook */}
                <div className="px-5 py-4 space-y-3 border-b border-white/[0.05]">
                  {oddsLoading && !oddsFor && (
                    <div className="flex items-center justify-center py-6 text-zinc-500 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Cargando cuotas...
                    </div>
                  )}

                  {oddsFor && (
                    <>
                      {/* 1X2 */}
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                          <Gauge className="w-3 h-3" /> Ganador del Partido
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <OddTile label={selected.home.slice(0, 14)} subLabel="LOCAL" odd={oddsFor.home} tone="emerald" />
                          <OddTile label="EMPATE" subLabel="X" odd={oddsFor.draw} tone="zinc" />
                          <OddTile label={selected.away.slice(0, 14)} subLabel="VISITA" odd={oddsFor.away} tone="emerald" />
                        </div>
                      </div>

                      {/* Doble oportunidad */}
                      {(oddsFor.dc1X || oddsFor.dc12 || oddsFor.dcX2) && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                            <Shield className="w-3 h-3" /> Doble Oportunidad
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            <OddTile label="1X" subLabel="Local/Emp" odd={oddsFor.dc1X} tone="cyan" />
                            <OddTile label="12" subLabel="Sin Empate" odd={oddsFor.dc12} tone="cyan" />
                            <OddTile label="X2" subLabel="Emp/Visit" odd={oddsFor.dcX2} tone="cyan" />
                          </div>
                        </div>
                      )}

                      {/* Secondary markets grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* O/U 2.5 */}
                        {(oddsFor.over25 || oddsFor.under25) && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                              <TrendingUp className="w-3 h-3" /> Total Goles 2.5
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <OddTile label="+2.5" subLabel="OVER" odd={oddsFor.over25} tone="amber" />
                              <OddTile label="-2.5" subLabel="UNDER" odd={oddsFor.under25} tone="amber" />
                            </div>
                          </div>
                        )}

                        {/* BTTS */}
                        {(oddsFor.bttsYes || oddsFor.bttsNo) && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                              <Flame className="w-3 h-3" /> Ambos Anotan
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <OddTile label="SÍ" subLabel="BTTS" odd={oddsFor.bttsYes} tone="purple" />
                              <OddTile label="NO" subLabel="BTTS" odd={oddsFor.bttsNo} tone="purple" />
                            </div>
                          </div>
                        )}

                        {/* Corners */}
                        {(oddsFor.cornersOver || oddsFor.cornersUnder) && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                              🚩 Corners {oddsFor.cornersLine ?? ""}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <OddTile label={`+${oddsFor.cornersLine}`} subLabel="OVER" odd={oddsFor.cornersOver} tone="sky" />
                              <OddTile label={`-${oddsFor.cornersLine}`} subLabel="UNDER" odd={oddsFor.cornersUnder} tone="sky" />
                            </div>
                          </div>
                        )}

                        {/* Cards */}
                        {(oddsFor.cardsOver || oddsFor.cardsUnder) && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                              🟨 Tarjetas {oddsFor.cardsLine ?? ""}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <OddTile label={`+${oddsFor.cardsLine}`} subLabel="OVER" odd={oddsFor.cardsOver} tone="rose" />
                              <OddTile label={`-${oddsFor.cardsLine}`} subLabel="UNDER" odd={oddsFor.cardsUnder} tone="rose" />
                            </div>
                          </div>
                        )}

                        {/* First half */}
                        {(oddsFor.firstHalfOver05 || oddsFor.firstHalfUnder05) && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> Gol 1ª Mitad
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <OddTile label="SÍ" subLabel="1T +0.5" odd={oddsFor.firstHalfOver05} tone="indigo" />
                              <OddTile label="NO" subLabel="1T 0-0" odd={oddsFor.firstHalfUnder05} tone="indigo" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Probabilidad implícita */}
                      {impliedProbs && (
                        <div className="mt-2">
                          <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-600 mb-1.5">Probabilidad Implícita (cuotas)</p>
                          <ProbBar home={impliedProbs.home} draw={impliedProbs.draw} away={impliedProbs.away} />
                        </div>
                      )}
                    </>
                  )}

                  {!oddsFor && !oddsLoading && (
                    <p className="text-xs text-zinc-600 text-center py-2">No hay cuotas disponibles para este partido.</p>
                  )}
                </div>

                {/* CTA Generar pronóstico */}
                <div className="px-5 py-4">
                  <button
                    onClick={handleGenerate}
                    disabled={loadingForecast}
                    className="relative w-full py-3.5 rounded-xl overflow-hidden bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-black uppercase tracking-wider text-sm shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingForecast ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Analizando datos en vivo...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" /> {forecast ? "Regenerar análisis" : "Generar pronóstico IA"}
                      </>
                    )}
                  </button>
                </div>

                {forecastError && (
                  <div className="mx-5 mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {forecastError}
                  </div>
                )}

                {forecast && (
                  <div className="px-5 pb-5 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Veredicto destacado + Marcador */}
                    <div className="flex gap-2">
                      {forecast.tldr && (
                        <div className="flex-1 p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/25">
                          <p className="text-[10px] uppercase tracking-widest font-black text-emerald-300 mb-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Veredicto IA
                          </p>
                          <p className="text-sm text-white font-bold leading-snug">{forecast.tldr}</p>
                        </div>
                      )}
                      {forecast.predictedScore && (
                        <div className="shrink-0 p-3 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/35 text-center min-w-[95px]">
                          <p className="text-[9px] uppercase tracking-widest font-black text-amber-300 mb-0.5">Marcador</p>
                          <p className="text-3xl font-black text-white font-mono tabular-nums">{forecast.predictedScore}</p>
                        </div>
                      )}
                    </div>

                    {/* Probabilidades del modelo vs Cuotas */}
                    {forecast.probabilities && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 flex items-center gap-1.5">
                            <BarChart3 className="w-3 h-3" /> Probabilidad según la IA
                          </p>
                          {impliedProbs && <span className="text-[9px] text-zinc-600">vs cuotas</span>}
                        </div>
                        <ProbBar
                          home={forecast.probabilities.home || 0}
                          draw={forecast.probabilities.draw || 0}
                          away={forecast.probabilities.away || 0}
                          labels={{ home: selected.home, away: selected.away }}
                        />
                        {impliedProbs && (
                          <div className="mt-2 pt-2 border-t border-white/[0.04]">
                            <p className="text-[9px] text-zinc-600 mb-1">Probabilidad implícita del mercado:</p>
                            <ProbBar home={impliedProbs.home} draw={impliedProbs.draw} away={impliedProbs.away} muted />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Key drivers */}
                    {forecast.keyDrivers && forecast.keyDrivers.length > 0 && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                          <Target className="w-3 h-3" /> Claves del Análisis
                        </p>
                        <ul className="space-y-1">
                          {forecast.keyDrivers.map((k, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-white/85">
                              <span className="text-emerald-400 mt-0.5">▸</span>
                              <span>{k}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Forma reciente + temporada */}
                    {(homeForm || awayForm || homeSeason || awaySeason) && (
                      <div className="grid grid-cols-2 gap-2">
                        <TeamCard
                          name={selected.home}
                          role="LOCAL"
                          form={homeForm}
                          stats={homeStats}
                          season={homeSeason}
                          seasonRole="L"
                        />
                        <TeamCard
                          name={selected.away}
                          role="VISITA"
                          form={awayForm}
                          stats={awayStats}
                          season={awaySeason}
                          seasonRole="V"
                        />
                      </div>
                    )}

                    {/* H2H */}
                    {h2h && h2h.matches.length > 0 && (
                      <div className="p-3 rounded-xl bg-cyan-500/8 border border-cyan-500/20">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-cyan-300 mb-1.5 flex items-center gap-1.5">
                          🤝 Cara a Cara
                        </p>
                        <p className="text-xs font-bold text-white/90 mb-1.5">{h2h.summary}</p>
                        <div className="space-y-0.5">
                          {h2h.matches.map((m, i) => (
                            <p key={i} className="text-[10px] text-zinc-400 font-mono">{m}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Análisis detallado */}
                    {forecast.analysis && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1.5">Análisis Detallado</p>
                        <p className="text-xs text-white/80 leading-relaxed">{forecast.analysis}</p>
                      </div>
                    )}

                    {/* Multi-Mercados */}
                    {forecast.markets && forecast.markets.length > 0 && (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center gap-1.5">
                          <BarChart3 className="w-3 h-3" /> Mercados Analizados ({forecast.markets.length})
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {forecast.markets.map((m, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-emerald-500/20 transition-colors">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-sm">{confidenceBadge(m.confidence)}</span>
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider truncate">{m.market}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${confidenceColor(m.confidence)}`}>{m.confidence}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-black text-white">{m.pick}</p>
                                {m.odd && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
                                    @{m.odd}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-500 leading-relaxed">{m.reasoning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pick principal — hero */}
                    {forecast.pick && (
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 flex items-center gap-3 shadow-[0_0_20px_rgba(245,158,11,0.08)]">
                        <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                          <Target className="w-5 h-5 text-amber-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] uppercase tracking-widest font-black text-amber-300">⭐ Pick Principal</p>
                          <p className="text-sm text-white font-black">{forecast.pick}</p>
                        </div>
                        {forecast.confidence && (
                          <div className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest shrink-0 ${confidenceColor(forecast.confidence)}`}>{forecast.confidence}</div>
                        )}
                      </div>
                    )}

                    {/* Parlays grid — segura vs riesgo */}
                    {(forecast.parlay || forecast.riskyParlay) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {forecast.parlay && forecast.parlay.picks?.length > 0 && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/25">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] uppercase tracking-widest font-black text-emerald-300 flex items-center gap-1.5">
                                <Shield className="w-3 h-3" /> Combinada Segura
                              </p>
                              {forecast.parlay.estimatedOdd && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-200 font-mono text-[11px] font-bold border border-emerald-500/30">
                                  @{forecast.parlay.estimatedOdd}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {forecast.parlay.picks.map((p, i) => (
                                <span key={i} className="px-2 py-1 rounded bg-black/30 text-white text-[10px] font-bold border border-white/[0.08]">{p}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-black ${confidenceColor(forecast.parlay.combinedConfidence)}`}>{forecast.parlay.combinedConfidence}</span>
                              <p className="text-[10px] text-zinc-400 flex-1">{forecast.parlay.description}</p>
                            </div>
                          </div>
                        )}

                        {forecast.riskyParlay && forecast.riskyParlay.picks?.length > 0 && (
                          <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/25">
                            <p className="text-[10px] uppercase tracking-widest font-black text-red-300 mb-2 flex items-center gap-1.5">
                              <Dice5 className="w-3 h-3" /> Combinada de Riesgo
                            </p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {forecast.riskyParlay.picks.map((p, i) => (
                                <span key={i} className="px-2 py-1 rounded bg-black/30 text-white text-[10px] font-bold border border-white/[0.08]">{p}</span>
                              ))}
                            </div>
                            <p className="text-[10px] text-zinc-400">{forecast.riskyParlay.description}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Value Bet */}
                    {forecast.valueBet && (
                      <div className="p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 shrink-0">
                          💎
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-[10px] uppercase tracking-widest font-black text-violet-300">Value Bet</p>
                            {forecast.valueBet.odd && (
                              <span className="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-200 font-mono text-[11px] font-bold border border-violet-500/30">
                                @{forecast.valueBet.odd}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-black text-white mt-0.5">{forecast.valueBet.market}: {forecast.valueBet.pick}</p>
                          <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{forecast.valueBet.reasoning}</p>
                        </div>
                      </div>
                    )}

                    {/* Caption para redes */}
                    {forecast.caption && (
                      <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/25">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Caption listo para redes</p>
                          <button onClick={handleCopyCaption} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                        <p className="text-xs text-white/85 whitespace-pre-wrap leading-relaxed">{forecast.caption}</p>
                      </div>
                    )}

                    {/* Compartir todo */}
                    <button onClick={handleShareAll} className="w-full py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-400 text-[11px] font-bold hover:bg-white/[0.08] hover:text-white hover:border-emerald-500/20 transition-all flex items-center justify-center gap-1.5">
                      {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedAll ? "¡Análisis completo copiado!" : "📋 Compartir análisis completo (WhatsApp)"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Componentes auxiliares estilo sportsbook
// ═══════════════════════════════════════════════════════════

const TONE_CLASSES: Record<string, { base: string; hover: string; accent: string }> = {
  emerald: { base: "bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-100", hover: "hover:border-emerald-500/40 hover:bg-emerald-500/10", accent: "text-emerald-300" },
  cyan:    { base: "bg-cyan-500/[0.06] border-cyan-500/20 text-cyan-100", hover: "hover:border-cyan-500/40 hover:bg-cyan-500/10", accent: "text-cyan-300" },
  amber:   { base: "bg-amber-500/[0.06] border-amber-500/20 text-amber-100", hover: "hover:border-amber-500/40 hover:bg-amber-500/10", accent: "text-amber-300" },
  purple:  { base: "bg-purple-500/[0.06] border-purple-500/20 text-purple-100", hover: "hover:border-purple-500/40 hover:bg-purple-500/10", accent: "text-purple-300" },
  sky:     { base: "bg-sky-500/[0.06] border-sky-500/20 text-sky-100", hover: "hover:border-sky-500/40 hover:bg-sky-500/10", accent: "text-sky-300" },
  rose:    { base: "bg-rose-500/[0.06] border-rose-500/20 text-rose-100", hover: "hover:border-rose-500/40 hover:bg-rose-500/10", accent: "text-rose-300" },
  indigo:  { base: "bg-indigo-500/[0.06] border-indigo-500/20 text-indigo-100", hover: "hover:border-indigo-500/40 hover:bg-indigo-500/10", accent: "text-indigo-300" },
  zinc:    { base: "bg-white/[0.03] border-white/[0.06] text-zinc-200", hover: "hover:border-white/[0.15] hover:bg-white/[0.06]", accent: "text-zinc-400" },
};

function OddTile({ label, subLabel, odd, tone = "zinc" }: { label: string; subLabel?: string; odd: number | null | undefined; tone?: string }) {
  const hasOdd = typeof odd === "number" && odd > 1;
  const c = TONE_CLASSES[tone] || TONE_CLASSES.zinc;
  return (
    <div className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${c.base} ${hasOdd ? c.hover : "opacity-40"}`}>
      <span className={`text-[9px] font-black uppercase tracking-wider truncate max-w-full px-1 ${c.accent}`}>{label}</span>
      {subLabel && <span className="text-[8px] text-zinc-500 font-semibold uppercase tracking-wider">{subLabel}</span>}
      <span className="text-sm font-mono font-black text-white mt-0.5 tabular-nums">
        {hasOdd ? odd!.toFixed(2) : "—"}
      </span>
    </div>
  );
}

function ProbBar({ home, draw, away, labels, muted = false }: {
  home: number; draw: number; away: number;
  labels?: { home: string; away: string };
  muted?: boolean;
}) {
  const total = Math.max(home + draw + away, 1);
  const hPct = (home / total) * 100;
  const dPct = (draw / total) * 100;
  const aPct = (away / total) * 100;
  const opacity = muted ? "opacity-60" : "";
  return (
    <div className={opacity}>
      <div className="flex h-5 rounded-md overflow-hidden border border-white/[0.08]">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center justify-center text-[10px] font-black text-black"
             style={{ width: `${hPct}%` }}>
          {hPct >= 12 ? `${Math.round(hPct)}%` : ""}
        </div>
        <div className="bg-gradient-to-r from-zinc-600 to-zinc-500 flex items-center justify-center text-[10px] font-black text-white"
             style={{ width: `${dPct}%` }}>
          {dPct >= 12 ? `${Math.round(dPct)}%` : ""}
        </div>
        <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 flex items-center justify-center text-[10px] font-black text-black"
             style={{ width: `${aPct}%` }}>
          {aPct >= 12 ? `${Math.round(aPct)}%` : ""}
        </div>
      </div>
      {labels && (
        <div className="flex justify-between mt-1 text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">
          <span className="truncate max-w-[40%]">{labels.home}</span>
          <span>Empate</span>
          <span className="truncate max-w-[40%] text-right">{labels.away}</span>
        </div>
      )}
    </div>
  );
}

function TeamCard({ name, role, form, stats, season, seasonRole }: {
  name: string;
  role: "LOCAL" | "VISITA";
  form: string;
  stats: TeamStats | null;
  season: SeasonSummary | null;
  seasonRole: "L" | "V";
}) {
  const rec = seasonRole === "L" ? season?.record.home : season?.record.away;
  const played = seasonRole === "L" ? season?.played.home : season?.played.away;
  const avgFor = seasonRole === "L" ? season?.goalsFor.avgHome : season?.goalsFor.avgAway;
  const avgAg = seasonRole === "L" ? season?.goalsAgainst.avgHome : season?.goalsAgainst.avgAway;
  const cs = seasonRole === "L" ? season?.cleanSheets.home : season?.cleanSheets.away;
  const accent = role === "LOCAL" ? "text-emerald-300" : "text-cyan-300";
  const roleBg = role === "LOCAL" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-cyan-500/10 border-cyan-500/20";

  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-black text-white truncate">{name}</p>
        <span className={`text-[8px] px-1.5 py-0.5 rounded border font-black uppercase tracking-widest shrink-0 ${roleBg} ${accent}`}>{role}</span>
      </div>
      {form && <p className="text-[10px] font-mono text-zinc-400 mb-1.5">Últimos 5: {form}</p>}
      {season && (
        <div className="text-[10px] text-zinc-400 leading-relaxed space-y-0.5 mb-1.5">
          <p><span className="text-zinc-500">Temporada {role === "LOCAL" ? "en casa" : "de visita"}:</span> <span className="font-mono text-white/80">{rec}</span> en {played} partidos</p>
          {avgFor && avgAg && (
            <p><span className="text-zinc-500">Promedio:</span> <span className="font-mono text-emerald-300">{avgFor}</span> GF / <span className="font-mono text-rose-300">{avgAg}</span> GC por partido</p>
          )}
          {cs !== undefined && <p><span className="text-zinc-500">Porterías a cero:</span> <span className="font-mono text-white/80">{cs}</span></p>}
          {season.form && <p><span className="text-zinc-500">Racha:</span> <span className="font-mono text-white/80">{season.form}</span></p>}
          {season.mostFrequentScore && season.mostFrequentScore !== "—" && (
            <p><span className="text-zinc-500">Marcador frecuente:</span> <span className="font-mono text-amber-300">{season.mostFrequentScore}</span></p>
          )}
        </div>
      )}
      {stats && (
        <div className="flex flex-wrap gap-1">
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[9px] font-bold">🧤 {stats.cleanSheets}/5</span>
          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[9px] font-bold">⚽ BTTS {stats.bttsCount}/5</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[9px] font-bold">📊 O2.5 {stats.over25Count}/5</span>
          {stats.cornersFor > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 text-[9px] font-bold">🚩 {stats.cornersFor}</span>
          )}
        </div>
      )}
    </div>
  );
}
