"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback } from "react";
import { Lock, Star, Zap, ShoppingBag, Loader2, RefreshCw, Clock, Crown, FileText, Sparkles, Newspaper, MessageSquare, ShieldAlert, Coins } from "lucide-react";
import { useRouter } from "next/navigation";

interface VipGateProps { children: React.ReactNode; }
const ADMIN_EMAIL = "andryzamora0825@gmail.com";
const POLL_INTERVAL_MS = 60_000;

export default function VipGate({ children }: VipGateProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [plan, setPlan] = useState<string | null>(null);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [justExpired, setJustExpired] = useState(false);
  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  const checkPlan = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/user/sync");
      const data = await res.json();
      if (data.success) {
        const prevPlan = plan; const newPlan = data.plan || "FREE";
        if (prevPlan === "VIP" && newPlan === "FREE") setJustExpired(true);
        setPlan(newPlan); setDaysLeft(data.daysLeft || 0);
      } else setPlan("FREE");
    } catch { setPlan(plan ?? "FREE");
    } finally { if (!silent) setLoading(false); }
  }, [plan]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (isAdmin) { setPlan("VIP"); setDaysLeft(9999); setLoading(false); return; }
    checkPlan(false);
  }, [isLoaded, user, isAdmin]);

  useEffect(() => {
    if (!isLoaded || !user || isAdmin) return;
    const interval = setInterval(() => checkPlan(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoaded, user, isAdmin, checkPlan]);

  if (!isLoaded || loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-white/20" />
    </div>
  );

  if (justExpired) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6 animate-fade-in">
      <div className="max-w-xs w-full text-center space-y-6">
        <Clock className="w-10 h-10 text-red-400/70 mx-auto" />
        <div>
          <p className="text-xs text-red-400/70 font-medium mb-2">Plan Expirado</p>
          <h2 className="text-xl font-semibold text-white/90">Tu VIP ha terminado</h2>
          <p className="text-sm text-white/30 mt-2">Renueva para seguir usando todas las funciones.</p>
        </div>
        <div className="space-y-2">
          <button onClick={() => router.push("/dashboard/tienda")} className="w-full py-3 bg-[#FFDE00] text-black font-semibold text-sm rounded-lg hover:brightness-110 transition-all">
            Renovar Plan VIP
          </button>
          <button onClick={() => setJustExpired(false)} className="w-full py-2 text-xs text-white/25 hover:text-white/40 transition-colors">
            Continuar como FREE
          </button>
        </div>
      </div>
    </div>
  );

  if (plan === "VIP" || isAdmin) return (
    <div>
      {!isAdmin && daysLeft <= 5 && daysLeft > 0 && <CountdownBanner daysLeft={daysLeft} checkPlan={checkPlan} />}
      {isAdmin && (
        <div className="mx-5 mt-4 sm:mx-8 mb-1">
          <p className="text-[11px] text-[#FFDE00]/50 font-medium">Admin · Acceso permanente</p>
        </div>
      )}
      {children}
    </div>
  );

  /* Lock Screen */
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6 animate-fade-in">
      <div className="max-w-sm w-full text-center space-y-8">
        <Lock className="w-10 h-10 text-[#FFDE00]/40 mx-auto" />
        <div>
          <p className="text-[11px] text-[#FFDE00]/60 font-medium uppercase tracking-wider mb-2">Contenido VIP</p>
          <h2 className="text-xl font-semibold text-white/90">Acceso Restringido</h2>
          <p className="text-sm text-white/30 mt-2 leading-relaxed">
            Exclusivo para miembros <span className="text-[#FFDE00]/70 font-medium">VIP</span>. Actualiza tu plan para desbloquear.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: FileText, label: "Notas IA" }, { icon: Sparkles, label: "Estudio IA" },
            { icon: Newspaper, label: "Novedades" }, { icon: MessageSquare, label: "Soporte" },
            { icon: ShieldAlert, label: "Alertas" }, { icon: Coins, label: "Créditos" },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-[#141414] border border-white/[0.06] rounded-lg">
              <b.icon className="w-3.5 h-3.5 text-[#FFDE00]/40 shrink-0" />
              <span className="text-xs text-white/30">{b.label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button onClick={() => router.push("/dashboard/tienda")} className="w-full py-3 bg-[#FFDE00] text-black font-semibold text-sm rounded-lg hover:brightness-110 transition-all">
            Obtener Plan VIP
          </button>
          <button onClick={() => router.push("/dashboard/configuracion")} className="w-full py-2.5 text-sm text-white/25 border border-white/[0.06] rounded-lg hover:bg-white/[0.02] transition-colors">
            Ver mi Plan
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCountdown(ts: number): string {
  const d = Math.floor(ts / 86400), h = Math.floor((ts % 86400) / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60;
  return d > 0 ? `${d}d ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function CountdownBanner({ daysLeft, checkPlan }: { daysLeft: number, checkPlan: (s?: boolean) => void }) {
  const router = useRouter();
  const [sl, setSl] = useState(daysLeft * 86400);
  useEffect(() => {
    if (sl <= 0) return;
    const t = setInterval(() => setSl(p => { if (p <= 1) { clearInterval(t); checkPlan(false); return 0; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [sl, checkPlan]);
  return (
    <div className="mx-5 mt-4 sm:mx-8 mb-1 flex items-center justify-between">
      <p className="text-[11px] text-[#FFDE00]/50 font-medium">
        VIP expira en {daysLeft}d · <span className="font-mono text-white/20">{formatCountdown(sl)}</span>
      </p>
      <button onClick={() => router.push("/dashboard/tienda")} className="text-[10px] font-semibold text-[#FFDE00]/70 hover:text-[#FFDE00] transition-colors">
        Renovar →
      </button>
    </div>
  );
}
