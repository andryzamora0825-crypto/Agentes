"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback } from "react";
import { Lock, Star, Zap, ShoppingBag, Loader2, RefreshCw, Clock, Crown, FileText, Sparkles, Newspaper, MessageSquare, ShieldAlert, Coins } from "lucide-react";
import { useRouter } from "next/navigation";

interface VipGateProps {
  children: React.ReactNode;
}

const ADMIN_EMAIL = "andryzamora0825@gmail.com";
const POLL_INTERVAL_MS = 60_000; // Re-verificar plan cada 60 segundos

export default function VipGate({ children }: VipGateProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [plan, setPlan] = useState<string | null>(null);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [justExpired, setJustExpired] = useState(false); // Estaba VIP y expiró ahora

  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  const checkPlan = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/user/sync");
      const data = await res.json();
      if (data.success) {
        const prevPlan = plan;
        const newPlan = data.plan || "FREE";

        // Detectar si acaba de expirar (era VIP, ahora es FREE)
        if (prevPlan === "VIP" && newPlan === "FREE") {
          setJustExpired(true);
        }

        setPlan(newPlan);
        setDaysLeft(data.daysLeft || 0);
      } else {
        setPlan("FREE");
      }
    } catch {
      setPlan(plan ?? "FREE");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [plan]);

  // Carga inicial
  useEffect(() => {
    if (!isLoaded || !user) return;
    if (isAdmin) {
      setPlan("VIP");
      setDaysLeft(9999); // Admin = VIP permanente
      setLoading(false);
      return;
    }
    checkPlan(false);
  }, [isLoaded, user, isAdmin]);

  // Polling silencioso cada 60s para detectar expiración
  useEffect(() => {
    if (!isLoaded || !user || isAdmin) return;
    const interval = setInterval(() => checkPlan(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoaded, user, isAdmin, checkPlan]);

  // Eliminado el timer aquí para no re-renderizar todo el componente padre cada segundo.

  /* ─────────────────── ESTADOS DE CARGA ─────────────────── */
  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFDE00] drop-shadow-[0_0_10px_rgba(255,222,0,0.4)]" />
      </div>
    );
  }

  /* ─────────────────── MODAL DE EXPIRACIÓN ─────────────────── */
  if (justExpired) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
        <div className="max-w-md w-full text-center space-y-6 relative">
          <div className="absolute inset-0 bg-red-500/5 rounded-full blur-[120px] -z-10 scale-150 pointer-events-none" />

          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-28 h-28 bg-[#111111] border-2 border-red-500/30 rounded-full flex items-center justify-center">
              <Clock className="w-12 h-12 text-red-400" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
              ⏰ Plan Expirado
            </div>
            <h2 className="text-3xl font-extrabold text-white">Tu VIP ha terminado</h2>
            <p className="text-gray-400 text-base leading-relaxed">
              Tu acceso VIP expiró. Para seguir disfrutando de todas las funciones, renueva tu membresía.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/dashboard/tienda")}
              className="flex items-center justify-center gap-2 bg-[#FFDE00] text-black font-black px-8 py-4 rounded-2xl hover:bg-[#FFC107] hover:shadow-[0_0_30px_rgba(255,222,0,0.4)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-sm"
            >
              <RefreshCw className="w-5 h-5" />
              Renovar Plan VIP
            </button>
            <button
              onClick={() => { setJustExpired(false); }}
              className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
            >
              Continuar como FREE
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────── ACCESO PERMITIDO (VIP o Admin) ─────────────────── */
  if (plan === "VIP" || isAdmin) {
    return (
      <div>
        {/* Banner de días restantes — solo VIP no admin con poco tiempo */}
        {!isAdmin && daysLeft <= 5 && daysLeft > 0 && (
          <CountdownBanner daysLeft={daysLeft} checkPlan={checkPlan} />
        )}

        {/* Badge admin permanente */}
        {isAdmin && (
          <div className="mx-4 mt-4 sm:mx-8 mb-2">
            <div className="bg-[#FFDE00]/5 border border-[#FFDE00]/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Crown className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <p className="text-xs font-black text-[#FFDE00] uppercase tracking-widest">
                Administrador · Acceso VIP Permanente
              </p>
            </div>
          </div>
        )}

        {children}
      </div>
    );
  }

  /* ─────────────────── PANTALLA DE BLOQUEO (FREE) ─────────────────── */
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
      <div className="max-w-lg w-full text-center space-y-8 relative">
        <div className="absolute inset-0 bg-[#FFDE00]/5 rounded-full blur-[120px] -z-10 scale-150 pointer-events-none" />

        <div className="relative mx-auto w-28 h-28">
          <div className="absolute inset-0 bg-[#FFDE00]/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative w-28 h-28 bg-[#111111] border-2 border-[#FFDE00]/30 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,222,0,0.15)]">
            <Lock className="w-12 h-12 text-[#FFDE00]" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 bg-[#FFDE00]/10 border border-[#FFDE00]/20 text-[#FFDE00] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
            <Star className="w-3.5 h-3.5 fill-[#FFDE00]" />
            Contenido Exclusivo VIP
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Acceso Restringido</h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm mx-auto">
            Esta sección es exclusiva para miembros <span className="text-[#FFDE00] font-black">VIP</span>.
            Actualiza tu plan para desbloquear todas las funciones de Zamtools.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {[
            { icon: <FileText className="w-4 h-4 text-[#FFDE00]" />, label: "Notas de Retiro con IA" },
            { icon: <Sparkles className="w-4 h-4 text-[#FFDE00]" />, label: "Estudio IA (Nano Banana)" },
            { icon: <Newspaper className="w-4 h-4 text-[#FFDE00]" />, label: "Novedades y Muro" },
            { icon: <MessageSquare className="w-4 h-4 text-[#FFDE00]" />, label: "Soporte Chat prioritario" },
            { icon: <ShieldAlert className="w-4 h-4 text-[#FFDE00]" />, label: "Alertas de Estafadores" },
            { icon: <Coins className="w-4 h-4 text-[#FFDE00]" />, label: "Acceso ilimitado a créditos" },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#111111] border border-white/5 rounded-xl px-4 py-3">
              <div className="bg-[#FFDE00]/10 p-1.5 rounded-lg border border-[#FFDE00]/20 shrink-0">
                {b.icon}
              </div>
              <span className="text-sm font-semibold text-gray-300">{b.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.push("/dashboard/tienda")}
            className="flex items-center justify-center gap-2 bg-[#FFDE00] text-black font-black px-8 py-3.5 rounded-2xl hover:bg-[#FFC107] hover:shadow-[0_0_30px_rgba(255,222,0,0.4)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-sm"
          >
            <ShoppingBag className="w-5 h-5" />
            Obtener Plan VIP
          </button>
          <button
            onClick={() => router.push("/dashboard/configuracion")}
            className="flex items-center justify-center gap-2 bg-white/5 text-gray-300 border border-white/10 font-bold px-8 py-3.5 rounded-2xl hover:bg-white/10 hover:text-white transition-all text-sm"
          >
            <Zap className="w-4 h-4" />
            Ver mi Plan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Formato countdown HH:MM:SS ─── */
function formatCountdown(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function CountdownBanner({ daysLeft, checkPlan }: { daysLeft: number, checkPlan: (silent?: boolean) => void }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number>(daysLeft * 24 * 60 * 60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          checkPlan(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, checkPlan]);

  return (
    <div className="mx-4 mt-4 sm:mx-8 mb-2">
      <div className="bg-[#FFDE00]/5 border border-[#FFDE00]/20 rounded-2xl px-4 py-3 flex items-center gap-3">
        <Clock className="w-4 h-4 text-[#FFDE00] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-[#FFDE00] uppercase tracking-widest">
            VIP expira en {daysLeft} {daysLeft === 1 ? 'día' : 'días'}
          </p>
          {secondsLeft > 0 && (
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              {formatCountdown(secondsLeft)}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/dashboard/tienda")}
          className="text-[10px] font-black text-black bg-[#FFDE00] hover:bg-[#FFC107] px-3 py-1.5 rounded-lg uppercase tracking-widest shrink-0 transition-colors"
        >
          Renovar
        </button>
      </div>
    </div>
  );
}
