"use client";

import { Target, Clock, Gift, Users, Lock } from "lucide-react";

export default function MisionesPage() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 pt-12">

      {/* Header */}
      <div className="text-center space-y-4 relative">
        <div className="absolute top-0 inset-x-0 mx-auto w-52 h-52 bg-purple-500/10 rounded-full blur-[120px] -z-10 animate-pulse" />
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/30 mx-auto shadow-[0_0_30px_rgba(168,85,247,0.2)]">
          <Target className="w-10 h-10 text-purple-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tighter">
          Centro de <span className="text-purple-400">Misiones</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          Completa desafíos y gana recompensas exclusivas como días VIP y créditos gratis.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-[#0A0A0A] border border-purple-500/20 rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#FFDE00]/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5" />
            Próximamente
          </div>

          <h2 className="text-3xl font-black text-white">Misiones están en desarrollo</h2>
          <p className="text-gray-400 max-w-lg mx-auto text-lg leading-relaxed">
            Estamos preparando misiones increíbles para ti. Pronto podrás ganar recompensas invitando amigos, completando retos y más.
          </p>

          {/* Preview de la primera misión */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 max-w-md mx-auto text-left mt-8 opacity-60">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#FFDE00]/10 p-2.5 rounded-xl border border-[#FFDE00]/20">
                <Users className="w-5 h-5 text-[#FFDE00]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Invita 3 Amigos VIP</h3>
                <p className="text-gray-500 text-xs">Comparte tu link y gana cuando tus amigos compren VIP</p>
              </div>
              <Lock className="w-5 h-5 text-gray-600 ml-auto" />
            </div>

            {/* Barra de progreso (demo) */}
            <div className="w-full bg-white/5 rounded-full h-2.5 mb-2">
              <div className="bg-gray-600 h-2.5 rounded-full" style={{ width: "0%" }} />
            </div>
            <p className="text-gray-600 text-xs font-bold">0 / 3 referidos VIP</p>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
              <Gift className="w-4 h-4 text-[#FFDE00]" />
              <span className="text-gray-400 text-xs font-bold">Recompensa: 15 días VIP + 10,000 créditos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
