"use client";

import { Share2, Sparkles } from "lucide-react";

interface EmptyStateProps {
  onGenerate: () => void;
  filterActive?: boolean;
}

export default function EmptyState({ onGenerate, filterActive }: EmptyStateProps) {
  return (
    <div className="bg-[#121212] border border-white/5 rounded-3xl p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden">
      {/* Glow decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#FFDE00]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="bg-[#FFDE00]/10 p-5 rounded-2xl mb-6 border border-[#FFDE00]/20 relative">
        <Share2 className="w-12 h-12 text-[#FFDE00]" />
      </div>

      <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
        {filterActive
          ? "No hay posts con este filtro"
          : "Aún no has generado ningún post"}
      </h3>
      <p className="text-gray-500 text-sm max-w-md mb-8 leading-relaxed">
        {filterActive
          ? "Prueba cambiando el filtro para ver otros posts disponibles."
          : "Genera tu primer post con IA y comienza a automatizar tu contenido para redes sociales."}
      </p>

      {!filterActive && (
        <button
          onClick={onGenerate}
          className="bg-[#FFDE00] text-black font-black px-8 py-3.5 rounded-xl flex items-center gap-2 hover:bg-[#FFC107] transition-all shadow-[0_0_20px_rgba(255,222,0,0.3)] hover:shadow-[0_0_30px_rgba(255,222,0,0.5)] active:scale-95"
        >
          <Sparkles className="w-5 h-5 fill-black" />
          Generar Primer Post
        </button>
      )}
    </div>
  );
}
