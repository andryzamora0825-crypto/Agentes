"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare, Save, Database, Cpu, Lock, ArrowRight, CheckCircle2,
  Landmark, ListOrdered, HelpCircle, Menu, ChevronDown, ChevronUp, RefreshCcw
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

// ─── Componente de sección colapsable ───────────────────────────────────────
function Section({
  icon: Icon, title, subtitle, children, defaultOpen = false
}: {
  icon: any; title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#0A0A0A] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-2 rounded-xl">
            <Icon className="w-5 h-5 text-[#FFDE00]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="px-6 pb-6 pt-0 space-y-5 border-t border-white/5">{children}</div>}
    </div>
  );
}

// ─── Textarea helper ─────────────────────────────────────────────────────────
function Field({
  label, hint, value, onChange, placeholder, rows = 4, maxLen = 2000
}: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; placeholder: string; rows?: number; maxLen?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-end">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label>
        <span className={`text-[10px] font-bold ${value.length > maxLen * 0.9 ? 'text-red-400' : 'text-gray-600'}`}>
          {value.length}/{maxLen}
        </span>
      </div>
      {hint && <p className="text-[11px] text-gray-600 leading-snug">{hint}</p>}
      <textarea
        className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm
          focus:outline-none focus:border-[#FFDE00]/50 focus:ring-1 focus:ring-[#FFDE00]/20
          transition-all resize-none placeholder-gray-700"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLen}
      />
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function WhatsAppAgentPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [saved, setSaved] = useState(false);

  // Estados de Configuración
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Campos originales
  const [aiPersona, setAiPersona] = useState(
    "Eres un asistente amigable y profesional de ventas. Responde de forma corta, directa y sin rodeos. Nunca inventes información."
  );
  const [knowledgeBase, setKnowledgeBase] = useState(
    "Somos una empresa de servicios financieros.\nHorarios: Lunes a Viernes 9am a 6pm."
  );

  // ── Nuevos campos de inteligencia ──
  const [banksInfo, setBanksInfo] = useState(
    "Banco Pichincha: Cuenta de ahorros 2201234567 | Nombre: Juan Pérez\nBanco Guayaquil: Cuenta corriente 3301234567 | Nombre: Ana López"
  );
  const [rechargeSteps, setRechargeSteps] = useState(
    "1. Pregunta al cliente cuánto desea recargar.\n2. Muéstrale los bancos disponibles para que elija.\n3. Da los datos de la cuenta bancaria seleccionada.\n4. Pide el comprobante de transferencia.\n5. Confirma que lo recibiste y que procesarás en breve."
  );
  const [withdrawSteps, setWithdrawSteps] = useState(
    "1. Pregunta el monto que desea retirar.\n2. Solicita su número de cuenta bancaria y banco.\n3. Escala a un agente humano para aprobar y procesar el retiro."
  );
  const [greetingMenu, setGreetingMenu] = useState(
    "¡Hola! 👋 Bienvenido/a. ¿En qué te puedo ayudar hoy?"
  );

  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch("/api/user/whatsapp")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          const s = data.settings;
          setIsUnlocked(!!s.isUnlocked);
          setIsActive(s.isActive || false);
          if (s.aiPersona) setAiPersona(s.aiPersona);
          if (s.knowledgeBase) setKnowledgeBase(s.knowledgeBase);
          if (s.banksInfo) setBanksInfo(s.banksInfo);
          if (s.rechargeSteps) setRechargeSteps(s.rechargeSteps);
          if (s.withdrawSteps) setWithdrawSteps(s.withdrawSteps);
          if (s.greetingMenu) setGreetingMenu(s.greetingMenu);
        }
      })
      .catch(console.error)
      .finally(() => setInitialLoad(false));
  }, []);

  const handleReset = async () => {
    if (!confirm("¿Seguro que quieres reiniciar el bot? Esto borrará el historial de conversaciones y las pausas activas. La configuración del entrenamiento NO se borrará.")) return;
    
    setResetting(true);
    try {
      const res = await fetch("/api/user/whatsapp/reset", { method: "POST" });
      if (res.ok) {
        alert("El bot ha sido reiniciado. Ha olvidado contextos anteriores y las pausas han sido levantadas.");
      } else {
        alert("Hubo un error reseteando el bot.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al resetear el bot.");
    } finally {
      setResetting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked) return;
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch("/api/user/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive,
          aiPersona,
          knowledgeBase,
          banksInfo,
          rechargeSteps,
          withdrawSteps,
          greetingMenu,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <div className="min-h-screen p-8 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFDE00]" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // PANTALLA BLOQUEADA
  // ══════════════════════════════════════════════════════
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
            Automatiza la atención al cliente 24/7 con IA entrenada por ti.
          </p>
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 text-left mb-8 space-y-3">
            {[
              "Responde recargas, retiros y consultas automáticamente",
              "Detecta comprobantes y los registra en tu panel",
              "Se pausa sola cuando tú intervines en el chat",
              "Botones interactivos para guiar al cliente paso a paso",
              "Escala a ti cuando no puede resolver algo",
            ].map(feat => (
              <div key={feat} className="flex items-center gap-3 text-sm text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-[#25D366] shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
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

  // ══════════════════════════════════════════════════════
  // PANTALLA DESBLOQUEADA - CONFIG COMPLETA
  // ══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen p-4 sm:p-8 text-white max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500 pb-32 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#128C7E]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header + Toggle */}
      <div className="bg-[#0A0A0A] p-6 rounded-3xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,211,102,0.3)]">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              WhatsApp AI v3
              <span className="text-xs bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full uppercase border border-[#25D366]/30">
                Function Calling
              </span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">Configura tu agente inteligente con herramientas reales.</p>
          </div>
        </div>

        {/* Controles: Toggle On/Off y Reset */}
        <div className="flex flex-col sm:items-end items-center gap-2 m-auto sm:m-0">
          <label className="flex items-center cursor-pointer gap-3 bg-white/5 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors border border-white/5 w-full justify-between sm:w-auto sm:justify-start">
            <span className={`text-sm font-bold ${isActive ? 'text-[#25D366]' : 'text-gray-500'}`}>
              {isActive ? "BOT ACTIVO" : "BOT APAGADO"}
            </span>
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <div className={`block w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-[#25D366]' : 'bg-gray-700'}`} />
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'translate-x-6' : ''}`} />
            </div>
          </label>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 hover:border-red-500/50 border border-transparent px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 w-full justify-center sm:w-auto"
          >
            {resetting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            Resetear Historial y Pausas
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">

        {/* 1. Personalidad */}
        <Section icon={Cpu} title="Personalidad del Bot" subtitle="Cómo habla y se comporta tu IA" defaultOpen>
          <Field
            label="Identidad y Tono (System Prompt)"
            hint="Describe cómo debe presentarse, su tono, límites y comportamiento general."
            value={aiPersona}
            onChange={setAiPersona}
            placeholder="Ej: Eres un asistente de ventas de la agencia X. Responde siempre de forma corta y directa. No inventes datos."
            rows={5}
            maxLen={3000}
          />
          <Field
            label="Base de Conocimiento"
            hint="Precios, horarios, links, reglas especiales. La IA usará SOLO esto para responder consultas."
            value={knowledgeBase}
            onChange={setKnowledgeBase}
            placeholder={"Precio VIP: $100/mes\nLink de registro: https://...\nHorarios: Lun-Vie 9am-6pm\nSoporte: @nombredeusuario"}
            rows={6}
            maxLen={4000}
          />
        </Section>

        {/* 2. Saludo y Menú */}
        <Section icon={Menu} title="Menú de Bienvenida" subtitle="Lo que el bot dice cuando alguien saluda por primera vez">
          <Field
            label="Mensaje de saludo inicial"
            hint='Se envía junto con los botones: "💰 Recargar | 📤 Retirar | ❓ Consulta | 🆘 Soporte"'
            value={greetingMenu}
            onChange={setGreetingMenu}
            placeholder="¡Hola! 👋 Bienvenido/a a [tu agencia]. ¿En qué te ayudo hoy?"
            rows={2}
            maxLen={300}
          />
          <div className="bg-[#111111] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">Vista previa de botones automáticos:</p>
            <div className="flex flex-wrap gap-2">
              {["💰 Recargar", "📤 Retirar", "❓ Consulta", "🆘 Soporte"].map(b => (
                <span key={b} className="bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-bold px-3 py-1.5 rounded-lg">{b}</span>
              ))}
            </div>
          </div>
        </Section>

        {/* 3. Bancos */}
        <Section icon={Landmark} title="Bancos Aceptados" subtitle="El bot los mostrará como botones cuando el cliente quiera recargar">
          <Field
            label="Lista de bancos (uno por línea)"
            hint={'Formato: "Nombre Banco: Tipo de cuenta [número] | Titular"\nEl nombre antes de ":" se usará como botón de WhatsApp.'}
            value={banksInfo}
            onChange={setBanksInfo}
            placeholder={"Banco Pichincha: Ahorro 2201234567 | Juan Pérez\nBanco Guayaquil: Corriente 3301234567 | Ana López\nTransferencia Móvil: 0991234567"}
            rows={5}
            maxLen={1500}
          />
          {banksInfo && (
            <div className="bg-[#111111] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">Botones de banco que el cliente verá:</p>
              <div className="flex flex-wrap gap-2">
                {banksInfo.split('\n').filter(l => l.trim()).map(line => {
                  const name = line.split(':')[0].trim();
                  return name ? (
                    <span key={name} className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg">{name}</span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </Section>

        {/* 4. Proceso de Recarga */}
        <Section icon={ListOrdered} title="Proceso de Recarga" subtitle="Pasos que el bot sigue cuando un cliente quiere recargar">
          <Field
            label="Pasos del proceso de recarga"
            hint="Instrucciones internas para el bot. Una paso por línea con número."
            value={rechargeSteps}
            onChange={setRechargeSteps}
            placeholder={"1. Pregunta el monto a recargar.\n2. Muestra los bancos disponibles.\n3. Da los datos de la cuenta elegida.\n4. Pide el comprobante.\n5. Confirma recepción."}
            rows={5}
            maxLen={1500}
          />
        </Section>

        {/* 5. Proceso de Retiro */}
        <Section icon={HelpCircle} title="Proceso de Retiro" subtitle="Pasos que el bot sigue cuando un cliente quiere retirar fondos">
          <Field
            label="Pasos del proceso de retiro"
            hint="Los retiros normalmente requieren aprobación humana. El bot puede recopilar los datos y escalar."
            value={withdrawSteps}
            onChange={setWithdrawSteps}
            placeholder={"1. Pregunta el monto a retirar.\n2. Solicita cuenta bancaria y banco.\n3. Escala a humano para procesar."}
            rows={4}
            maxLen={1200}
          />
        </Section>

        {/* Botón Guardar */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#FFDE00] hover:bg-[#FFC107] text-black py-4 rounded-2xl font-black text-lg transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-[0_0_20px_rgba(255,222,0,0.3)]"
        >
          {loading
            ? <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            : <Save className="w-6 h-6" />
          }
          {saved ? "✅ ¡ENTRENAMIENTO GUARDADO!" : "GUARDAR Y APLICAR ENTRENAMIENTO"}
        </button>
      </form>
    </div>
  );
}
