"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Save, Database, Cpu, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WhatsAppAgentPage() {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [saved, setSaved] = useState(false);

  // Estados de Configuración
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [aiPersona, setAiPersona] = useState("Eres un asistente amigable y profesional de ventas de la agencia Zamtools. Tu trabajo es ayudar a los clientes con sus dudas y si es algo complejo derivarlos a un agente humano.");
  const [knowledgeBase, setKnowledgeBase] = useState("Somos la agencia Zamtools.\nNuestro catálogo / tienda está en: https://...\nHorarios de atención: Lunes a Viernes 9am a 6pm.");

  useEffect(() => {
    fetch("/api/user/whatsapp")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setIsUnlocked(!!data.settings.isUnlocked);
          setIsActive(data.settings.isActive || false);
          if (data.settings.aiPersona) setAiPersona(data.settings.aiPersona);
          if (data.settings.knowledgeBase) setKnowledgeBase(data.settings.knowledgeBase);
        }
      })
      .catch(console.error)
      .finally(() => setInitialLoad(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked) return;
    
    setLoading(true);
    setSaved(false);

    try {
      // Solo guardamos los campos no-técnicos
      const res = await fetch("/api/user/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive,
          aiPersona,
          knowledgeBase
        })
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <div className="min-h-screen p-8 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFDE00]"></div>
      </div>
    );
  }

  // ==== ESTADO BLOQUEADO (PANTALLA DE VENTA) ====
  if (!isUnlocked) {
    return (
      <div className="min-h-[85vh] p-4 sm:p-8 text-white flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#25D366]/20 rounded-full blur-[120px] pointer-events-none -z-10" />
        
        <div className="max-w-xl w-full bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <MessageSquare className="w-40 h-40" />
          </div>

          <div className="w-20 h-20 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,211,102,0.4)] relative">
            <Lock className="w-8 h-8 text-white absolute -bottom-2 -right-2 drop-shadow-lg" />
            <MessageSquare className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight">Agente IA de WhatsApp</h1>
          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            Automatiza la atención al cliente de tu agencia 24/7. Nuestro sistema conectará una Inteligencia Artificial entrenada por ti a tu número de WhatsApp para cerrar ventas y responder dudas automáticamente.
          </p>

          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 text-left mb-8 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-[#25D366]" /> <span>Respuesta instantánea a clientes las 24 horas.</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-[#25D366]" /> <span>Cero configuraciones técnicas complicadas.</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-[#25D366]" /> <span>Entrenamiento personalizado con tus propias reglas e identidad.</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-5 h-5 text-[#25D366]" /> <span>Control total: apágalo o enciéndelo cuando quieras.</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FFDE00]/10 border border-[#FFDE00]/20 p-5 rounded-2xl">
            <div className="text-left">
              <p className="text-xs text-[#FFDE00] font-bold uppercase tracking-widest">Inversión Mensual</p>
              <p className="text-3xl font-black text-white">$25 <span className="text-sm font-normal text-gray-400">USD/mes</span></p>
            </div>
            <Link href="/dashboard/chat" className="w-full sm:w-auto bg-[#FFDE00] hover:bg-[#FFC107] text-black px-6 py-3 rounded-xl font-black transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
              Adquirir ahora <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==== ESTADO DESBLOQUEADO (CONFIG ACTIVADA PARA AGENTE) ====
  return (
    <div className="min-h-screen p-4 sm:p-8 text-white max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#128C7E]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Título */}
      <div className="bg-[#0A0A0A] p-6 rounded-3xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,211,102,0.3)]">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              WhatsApp AI <span className="text-xs bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full uppercase border border-[#25D366]/30">ACTIVO</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">Configura la personalidad de tu agente inteligente.</p>
          </div>
        </div>

        {/* Interruptor Global */}
        <label className="flex items-center cursor-pointer gap-3 bg-white/5 px-4 py-2 rounded-xl group hover:bg-white/10 transition-colors border border-white/5 m-auto sm:m-0">
          <span className={`text-sm font-bold ${isActive ? 'text-[#25D366]' : 'text-gray-500'}`}>
            {isActive ? "BOT ENCENDIDO" : "BOT APAGADO"}
          </span>
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <div className={`block w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-[#25D366]' : 'bg-gray-700'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'transform translate-x-6' : ''}`}></div>
          </div>
        </label>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div className="bg-[#0A0A0A] rounded-3xl border border-white/5 p-6 shadow-xl flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFDE00]/5 rounded-full blur-[50px] -m-10" />

          <div className="flex items-center gap-3 mb-6 relative">
            <div className="bg-white/5 p-2 rounded-xl">
              <Cpu className="w-5 h-5 text-[#FFDE00]" />
            </div>
            <h2 className="text-xl font-black">Entrenamiento del Bot</h2>
          </div>

          <div className="space-y-6 flex flex-col">
            <div className="flex flex-col">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Identidad de tu Agencia (System Prompt)
              </label>
              <textarea
                className="w-full min-h-[120px] bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFDE00] focus:ring-1 focus:ring-[#FFDE00] transition-all text-sm resize-none"
                value={aiPersona}
                onChange={(e) => setAiPersona(e.target.value)}
                placeholder="Ej: Eres un experto en ventas de la agencia X. Responde siempre de forma corta, amable y directa."
                required
              />
            </div>

            <div className="flex flex-col">
              <label className="flex flex-col gap-1 mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-3 h-3" /> Base de Conocimiento Clandestina
                </span>
                <span className="text-[10px] text-gray-500">¿Qué debe responder la IA cuando pregunten precios, horarios, o links? Dicta las respuestas aquí.</span>
              </label>
              <textarea
                  className="w-full min-h-[220px] bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFDE00] focus:ring-1 focus:ring-[#FFDE00] transition-all text-sm resize-none"
                  value={knowledgeBase}
                  onChange={(e) => setKnowledgeBase(e.target.value)}
                  placeholder="Regla 1: El precio VIP es $100.&#10;Regla 2: El link oficial para registrarse es https://...&#10;Regla 3: Si preguntan por pagos, di que aceptamos Binance."
                  required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#FFDE00] hover:bg-[#FFC107] text-black py-4 rounded-2xl font-black text-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-[0_0_20px_rgba(255,222,0,0.3)]"
        >
          {loading ? <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Save className="w-6 h-6" />}
          {saved ? "¡ENTRENAMIENTO GUARDADO!" : "GUARDAR Y APLICAR APRENDIZAJE"}
        </button>
      </form>
    </div>
  );
}
