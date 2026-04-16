"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare, Save, Database, Cpu, Lock, ArrowRight, CheckCircle2,
  Landmark, ListOrdered, HelpCircle, Menu, ChevronDown, ChevronUp, RefreshCcw, Plus, Trash2
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Bank {
  id: string;
  name: string;
  type: string;
  customType: string;
  number: string;
  holder: string;
  cedula: string;
}

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
  const [banksInfo, setBanksInfo] = useState("");
  const [banksList, setBanksList] = useState<Bank[]>([]);
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
          if (s.banksList && s.banksList.length > 0) {
            setBanksList(s.banksList);
          } else if (s.banksInfo) {
            setBanksInfo(s.banksInfo);
          }
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

    // Compilar banksList a texto legible para el prompt de IA
    const compiledBanksInfo = banksList.length > 0 ? banksList.map(b => {
      const typeStr = b.type === "Otro" ? b.customType : `Cuenta de ${b.type.toLowerCase()}`;
      let line = `${b.name}: ${typeStr} ${b.number} | Titular: ${b.holder}`;
      if (b.cedula) line += ` | CI: ${b.cedula}`;
      return line;
    }).join('\n') : banksInfo;

    try {
      const res = await fetch("/api/user/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive,
          aiPersona,
          knowledgeBase,
          banksInfo: compiledBanksInfo,
          banksList,
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
      <div className="min-h-[85vh] p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full bg-[#141414] border border-white/[0.06] rounded-lg p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
            <MessageSquare className="w-40 h-40" />
          </div>
          <div className="w-16 h-16 bg-[#25D366] rounded-xl mx-auto flex items-center justify-center mb-6 relative">
            <Lock className="w-6 h-6 text-black absolute -bottom-2 -right-2" />
            <MessageSquare className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-2 tracking-tight text-white/90">Agente IA de WhatsApp</h1>
          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            Automatiza la atención al cliente 24/7 con IA entrenada por ti.
          </p>
          <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-6 text-left mb-8 space-y-3">
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FFDE00]/10 border border-[#FFDE00]/20 p-5 rounded-lg">
            <div className="text-left">
              <p className="text-[10px] text-[#FFDE00] font-medium uppercase tracking-widest">Inversión Mensual</p>
              <p className="text-2xl font-bold text-white">$25 <span className="text-sm font-normal text-white/40">USD/mes</span></p>
            </div>
            <Link href="/dashboard/chat" className="w-full sm:w-auto bg-[#FFDE00] hover:brightness-110 text-black px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm">
              Adquirir ahora <ArrowRight className="w-4 h-4" />
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
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-5 pb-32">
      {/* Header + Toggle */}
      <div className="bg-[#141414] p-5 sm:p-6 rounded-lg border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#25D366]/10 w-12 h-12 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-[#25D366]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white/90 flex items-center gap-2">
              WhatsApp AI v3
              <span className="text-[10px] bg-[#25D366]/10 text-[#25D366] px-2 py-0.5 rounded border border-[#25D366]/20 uppercase">
                Function Calling
              </span>
            </h1>
            <p className="text-white/30 text-sm mt-0.5">Configura tu agente inteligente con herramientas reales.</p>
          </div>
        </div>

        {/* Controles: Toggle On/Off y Reset */}
        <div className="flex flex-col sm:items-end items-center gap-2 m-auto sm:m-0">
          <label className="flex items-center cursor-pointer gap-3 bg-white/[0.04] p-1.5 pr-4 rounded-lg hover:bg-white/[0.08] transition-colors border border-white/[0.06] w-full justify-between sm:w-auto sm:justify-start">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <div className={`block w-10 h-6 rounded-md transition-colors ${isActive ? 'bg-[#25D366]' : 'bg-gray-700'}`} />
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded shadow transition-transform ${isActive ? 'translate-x-4' : ''}`} />
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wider ${isActive ? 'text-[#25D366]' : 'text-gray-500'}`}>
              {isActive ? "BOT ACTIVO" : "BOT APAGADO"}
            </span>
          </label>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-white bg-white/[0.04] hover:bg-red-500/10 border border-transparent px-3 py-2 rounded-lg transition-colors disabled:opacity-50 w-full justify-center sm:w-auto"
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
        <Section icon={Landmark} title="Bancos Aceptados" subtitle="Añade los bancos que el bot mostrará para recargas">
          {banksList.length === 0 && banksInfo && (
            <div className="bg-[#FFDE00]/10 border border-[#FFDE00]/20 rounded-xl p-4 text-xs text-[#FFDE00] mb-4">
              <p className="font-bold">⚠️ Tienes estos bancos configurados anteriormente como texto libre:</p>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap font-mono">{banksInfo}</pre>
              <p className="mt-2 text-gray-300">Añádelos manualmente en los nuevos formularios de abajo y da click a guardar para migrarlos a la nueva versión interactiva.</p>
            </div>
          )}

          <div className="space-y-4">
            {banksList.map((bank, index) => (
              <div key={bank.id} className="bg-[#111111] border border-white/10 rounded-xl p-5 relative group animate-in fade-in slide-in-from-bottom-2">
                <button
                  type="button"
                  onClick={() => setBanksList(bl => bl.filter(b => b.id !== bank.id))}
                  className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition-colors p-1"
                  title="Eliminar banco"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre del Banco</label>
                    <input
                      type="text"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FFDE00]/50"
                      placeholder="Ej: Banco Pichincha"
                      value={bank.name}
                      onChange={e => setBanksList(bl => bl.map(b => b.id === bank.id ? { ...b, name: e.target.value } : b))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Tipo de Cuenta</label>
                    <select
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#FFDE00]/50"
                      value={bank.type}
                      onChange={e => setBanksList(bl => bl.map(b => b.id === bank.id ? { ...b, type: e.target.value } : b))}
                    >
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                      <option value="Otro">Otro...</option>
                    </select>
                  </div>
                  {bank.type === "Otro" && (
                    <div className="sm:col-span-2 shadow-inner bg-[#1A1A1A]/50 p-3 rounded-lg border border-white/5">
                      <label className="text-xs font-bold text-[#FFDE00] uppercase tracking-wider block mb-1">Especifique el tipo de cuenta</label>
                      <input
                        type="text"
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#FFDE00]/50"
                        placeholder="Ej: Billetera Móvil (De Una)"
                        value={bank.customType}
                        onChange={e => setBanksList(bl => bl.map(b => b.id === bank.id ? { ...b, customType: e.target.value } : b))}
                        required={bank.type === "Otro"}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Número de Cuenta</label>
                    <input
                      type="text"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#FFDE00]/50"
                      placeholder="Ej: 2201234567"
                      value={bank.number}
                      onChange={e => setBanksList(bl => bl.map(b => b.id === bank.id ? { ...b, number: e.target.value } : b))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre del Titular</label>
                    <input
                      type="text"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#FFDE00]/50"
                      placeholder="Ej: Juan Pérez"
                      value={bank.holder}
                      onChange={e => setBanksList(bl => bl.map(b => b.id === bank.id ? { ...b, holder: e.target.value } : b))}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Número de Cédula <span className="text-gray-500 font-normal lowercase">(Opcional)</span></label>
                    <input
                      type="text"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#FFDE00]/50"
                      placeholder="Ej: 0912345678"
                      value={bank.cedula}
                      onChange={e => setBanksList(bl => bl.map(b => b.id === bank.id ? { ...b, cedula: e.target.value } : b))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button
            type="button"
            onClick={() => setBanksList([...banksList, { id: Date.now().toString() + Math.random(), name: "", type: "Ahorros", customType: "", number: "", holder: "", cedula: "" }])}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 py-3 rounded-xl font-bold transition-colors"
          >
            <Plus className="w-5 h-5" /> Añadir Banco
          </button>
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
          className="w-full flex items-center justify-center gap-2 bg-[#FFDE00] hover:brightness-110 text-black py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 mt-6"
        >
          {loading
            ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            : <Save className="w-5 h-5" />
          }
          {saved ? "Guardado con éxito" : "Guardar Configuración"}
        </button>
      </form>
    </div>
  );
}
