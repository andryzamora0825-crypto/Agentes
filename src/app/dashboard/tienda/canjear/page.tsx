"use client";

import { useState } from "react";
import { Ticket, Loader2, Gift, Sparkles } from "lucide-react";

export default function CanjearCodigoPage() {
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/user/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setPromoCode("");
        window.location.reload();
      } else {
        alert(data.error || "Código inválido");
      }
    } catch (err) {
      alert("Error de conexión");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-8 pt-12">

      {/* Header */}
      <div className="text-center space-y-4 relative">
        <div className="absolute top-0 inset-x-0 mx-auto w-52 h-52 bg-[#FFDE00]/10 rounded-full blur-[120px] -z-10 animate-pulse" />
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#FFDE00]/10 border border-[#FFDE00]/30 mx-auto shadow-[0_0_30px_rgba(255,222,0,0.2)]">
          <Gift className="w-10 h-10 text-[#FFDE00]" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tighter">
          Canjear <span className="text-[#FFDE00]">Código</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          Si tienes un código de regalo de días VIP o Créditos, ingrésalo aquí para activar tu recompensa al instante.
        </p>
      </div>

      {/* Card de Canjeo */}
      <div className="bg-[#0A0A0A] border border-[#FFDE00]/20 rounded-3xl p-8 sm:p-10 shadow-[0_0_30px_rgba(255,222,0,0.05)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFDE00]/5 blur-[80px] rounded-full pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#FFDE00]/10 p-3 rounded-xl border border-[#FFDE00]/20">
            <Ticket className="w-6 h-6 text-[#FFDE00]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Código Promocional</h2>
            <p className="text-gray-500 text-sm">Ingresa tu código exactamente como lo recibiste</p>
          </div>
        </div>

        <form onSubmit={handleRedeem} className="space-y-4">
          <input 
            type="text"
            value={promoCode}
            onChange={e => setPromoCode(e.target.value)}
            placeholder="Ej. BFX2026"
            className="w-full bg-[#111111] border border-white/10 rounded-2xl px-6 py-4 text-white text-xl text-center focus:outline-none focus:border-[#FFDE00] focus:ring-2 focus:ring-[#FFDE00]/20 uppercase tracking-[0.3em] font-black placeholder:font-normal placeholder:tracking-widest placeholder:text-gray-600 transition-all"
          />
          <button 
            type="submit" 
            disabled={redeeming || !promoCode.trim()}
            className="w-full bg-[#FFDE00] text-black font-black px-6 py-4 rounded-2xl text-lg hover:bg-white transition-all hover:shadow-[0_0_25px_rgba(255,222,0,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {redeeming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {redeeming ? "Canjeando..." : "Aplicar Premio"}
          </button>
        </form>
      </div>

      {/* Info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Códigos de Créditos</p>
          <p className="text-sm text-gray-300">Los créditos se suman inmediatamente a tu saldo y no expiran. Úsalos en el Estudio IA.</p>
        </div>
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Códigos de VIP</p>
          <p className="text-sm text-gray-300">Los días VIP se suman a tu membresía actual. Si no eres VIP, se activan al instante.</p>
        </div>
      </div>
    </div>
  );
}
