"use client";

import { UserProfile, useUser, useClerk } from "@clerk/nextjs";
import { Settings, Shield, Coins, Loader2, Calendar, LogOut, Star, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfiguracionPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>("Cargando...");
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    fetch("/api/user/sync")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCredits(data.credits);
          setPlan(data.plan || "FREE");
          setDaysLeft(data.daysLeft || 0);
        }
      })
      .catch(console.error);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFDE00] drop-shadow-[0_0_10px_rgba(255,222,0,0.5)]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 pb-32">

      {/* ── Header ── */}
      <div className="relative bg-[#111111] border border-white/5 p-6 sm:p-8 rounded-3xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FFDE00]/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <div className="bg-[#FFDE00] p-2 rounded-xl shadow-[0_0_15px_rgba(255,222,0,0.4)]">
                <Settings className="w-7 h-7 text-black" />
              </div>
              Perfil y Configuración
            </h1>
            <p className="text-gray-400 mt-2 text-sm max-w-md">
              Administra tu identidad digital y revisa los beneficios activos de tu membresía.
            </p>
          </div>

          {/* Botón Cerrar Sesión */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 px-5 py-2.5 rounded-xl font-bold transition-all group shrink-0"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* ── Info Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Avatar + Nombre */}
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
          <img
            src={user?.imageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}&background=1a1a1a&color=FFDE00`}
            alt="Avatar"
            className="w-14 h-14 rounded-2xl border border-white/10 object-cover"
          />
          <div>
            <div className="font-black text-white text-lg leading-tight">{user?.fullName || user?.firstName}</div>
            <div className="text-xs text-gray-500 mt-0.5">{user?.primaryEmailAddress?.emailAddress}</div>
          </div>
        </div>

        {/* Créditos */}
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 hover:border-[#FFDE00]/20 transition-colors group">
          <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <Coins className="w-3.5 h-3.5 text-[#FFDE00]" /> Billetera Zamtools
          </div>
          {credits === null ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#FFDE00]" />
          ) : (
            <div className="text-4xl font-black text-white group-hover:text-[#FFDE00] transition-colors">
              {credits.toLocaleString()}
              <span className="text-base font-bold text-gray-600 ml-2">créditos</span>
            </div>
          )}
        </div>

        {/* Plan */}
        <div className={`bg-[#111111] border rounded-2xl p-5 transition-colors ${plan === 'VIP' ? 'border-[#FFDE00]/20 hover:border-[#FFDE00]/40' : 'border-white/5 hover:border-white/10'}`}>
          <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#FFDE00]" /> Rango Actual
          </div>
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase tracking-wider text-sm ${
              plan === 'VIP'
                ? 'bg-[#FFDE00] text-black shadow-[0_0_20px_rgba(255,222,0,0.3)]'
                : 'bg-white/5 text-gray-400 border border-white/10'
            }`}>
              {plan === 'VIP' ? <Star className="w-4 h-4 fill-black" /> : <Zap className="w-4 h-4" />}
              {plan}
            </div>
          </div>
          {plan === "VIP" && daysLeft > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-500">
              <Calendar className="w-3.5 h-3.5 text-[#FFDE00]" />
              Expira en {daysLeft} días
            </div>
          )}
        </div>

      </div>

      {/* ── Clerk UserProfile (hash routing evita el error de catch-all) ── */}
      <div className="rounded-3xl overflow-hidden border border-white/5 shadow-xl">
        <UserProfile
          routing="hash"
          appearance={{
            variables: {
              colorBackground: "#111111",
              colorInputBackground: "#0A0A0A",
              colorInputText: "#FFFFFF",
              colorText: "#FFFFFF",
              colorTextSecondary: "#9CA3AF",
              colorPrimary: "#FFDE00",
              colorDanger: "#EF4444",
              colorSuccess: "#22C55E",
              colorNeutral: "#374151",
              borderRadius: "0.75rem",
              fontFamily: "inherit",
            },
            elements: {
              rootBox: "w-full",
              card: "w-full shadow-none border-0 bg-[#111111]",
              navbar: "bg-[#0D0D0D] border-r border-white/5",
              navbarButton: "text-gray-400 hover:text-white hover:bg-white/5",
              navbarButtonActive: "text-[#FFDE00] bg-[#FFDE00]/10",
              pageScrollBox: "p-4 sm:p-6",
              profileSectionTitle: "text-white font-bold",
              profileSectionTitleText: "text-white",
              profileSectionContent: "border-white/5",
              formFieldLabel: "text-gray-300 font-semibold",
              formFieldInput: "bg-[#0A0A0A] border-white/10 text-white",
              formButtonPrimary: "bg-[#FFDE00] text-black font-bold hover:bg-[#FFC107]",
              formButtonReset: "text-gray-400 hover:text-white",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              dividerLine: "bg-white/5",
              dividerText: "text-gray-600",
              badge: "bg-[#FFDE00]/10 text-[#FFDE00] border-[#FFDE00]/20",
              userPreviewTextContainer: "text-white",
              userPreviewSecondaryIdentifier: "text-gray-400",
              menuList: "bg-[#111111] border-white/10",
              menuItem: "text-gray-300 hover:bg-white/5 hover:text-white",
              alertText: "text-gray-300",
            }
          }}
        />
      </div>

    </div>
  );
}
