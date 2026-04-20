"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Loader2, Users, Coins, Ticket, Trash2, Plus, X, ShieldCheck,
  Copy, Check, ChevronDown, ChevronUp, Crown, AlertTriangle, Link as Link2
} from "lucide-react";

export default function OperadorPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState<any>(null);
  const [subAgents, setSubAgents] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState<Record<string, string>>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Codes
  const [codes, setCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [codeForm, setCodeForm] = useState({ code: "", reward_type: "credits", reward_value: "", combo_credits: "", stock: "" });
  const [submittingCode, setSubmittingCode] = useState(false);

  const isOperator = (user?.publicMetadata as any)?.role === "operator";

  useEffect(() => {
    if (isLoaded && !isOperator) {
      router.push("/dashboard");
    }
  }, [isLoaded, isOperator, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operador/users");
      const data = await res.json();
      if (data.success) {
        setOperator(data.operator);
        setSubAgents(data.subAgents);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCodes = async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch("/api/operador/codes");
      const data = await res.json();
      if (data.success) setCodes(data.codes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCodes(false);
    }
  };

  useEffect(() => {
    if (isOperator) {
      loadData();
      loadCodes();
    }
  }, [isOperator]);

  const assignVip = async (targetId: string) => {
    if (!confirm("¿Asignar 30 días VIP? Esto consumirá 1 Token VIP de tu inventario.")) return;
    setProcessingId(targetId);
    try {
      const res = await fetch("/api/operador/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId, action: "assign_vip" })
      });
      const data = await res.json();
      if (data.success) {
        setOperator((prev: any) => ({ ...prev, inventory: data.updatedInventory }));
        loadData();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Error de conexión.");
    } finally {
      setProcessingId(null);
    }
  };

  const modifyCredits = async (targetId: string, delta: number) => {
    if (delta === 0) return;
    const label = delta > 0 ? `ENTREGAR ${delta} créditos` : `RETIRAR ${Math.abs(delta)} créditos`;
    if (!confirm(`¿${label}?`)) return;
    setProcessingId(targetId);
    try {
      const res = await fetch("/api/operador/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId, action: "modify_credits", creditsDelta: delta })
      });
      const data = await res.json();
      if (data.success) {
        setOperator((prev: any) => ({ ...prev, inventory: data.updatedInventory }));
        setCreditInput(prev => ({ ...prev, [targetId]: "" }));
        loadData();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Error de conexión.");
    } finally {
      setProcessingId(null);
    }
  };

  const createCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeForm.code || !codeForm.reward_value) return alert("Completa los campos.");
    setSubmittingCode(true);
    try {
      const res = await fetch("/api/operador/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codeForm)
      });
      const data = await res.json();
      if (data.success) {
        setCodeForm({ code: "", reward_type: "credits", reward_value: "", combo_credits: "", stock: "" });
        setShowCodeForm(false);
        if (data.updatedInventory) {
          setOperator((prev: any) => ({ ...prev, inventory: data.updatedInventory }));
        }
        loadCodes();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Error de red.");
    } finally {
      setSubmittingCode(false);
    }
  };

  const deleteCode = async (id: string) => {
    if (!confirm("¿Eliminar este código? Los recursos NO UTILIZADOS volverán a tu inventario.")) return;
    try {
      const res = await fetch(`/api/operador/codes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadCodes();
        loadData(); // refresh inventory
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLinkUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isLoaded || !isOperator) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-5rem)]">
        <Loader2 className="w-8 h-8 text-[#FFDE00] animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-5rem)]">
        <Loader2 className="w-8 h-8 text-[#FFDE00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-32 animate-fade-in">

      {/* Header */}
      <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#FFDE00] to-[#FFB800] p-2.5 rounded-xl shadow-lg shadow-[#FFDE00]/10">
              <Crown className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Mi Agencia</h1>
              <p className="text-white/30 text-sm mt-0.5">Panel de control del Operador</p>
            </div>
          </div>

          {/* Affiliate Code */}
          {operator?.affiliateCode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyCode(operator.affiliateCode)}
                className="flex items-center gap-2.5 bg-[#FFDE00]/10 border border-[#FFDE00]/20 px-4 py-2.5 rounded-xl hover:bg-[#FFDE00]/20 transition-colors group"
                title="Copiar Código Manualmente"
              >
                <span className="hidden sm:inline text-[10px] text-[#FFDE00]/60 uppercase tracking-widest font-bold">Tu Código:</span>
                <span className="text-sm font-black text-[#FFDE00] tracking-widest">{operator.affiliateCode}</span>
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#FFDE00]/50 group-hover:text-[#FFDE00]" />}
              </button>
              
              <div className="h-8 w-px bg-white/[0.06] mx-1"></div>

              <button
                onClick={() => copyLinkUrl(`${window.location.origin}/invite/${operator.affiliateCode}`)}
                className="flex items-center gap-2 bg-[#141414] border border-white/[0.06] hover:border-cyan-500/30 hover:bg-cyan-500/10 px-4 py-2.5 rounded-xl transition-all text-sm font-bold text-white/70 hover:text-cyan-400 group"
                title="Copiar Enlace de Invitación Directo"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4 text-white/40 group-hover:text-cyan-400" />}
                <span className="hidden sm:inline">{copiedLink ? '¡Enlace Copiado!' : 'Copiar Link de Afiliado'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#141414] border border-purple-500/10 rounded-xl p-5 hover:border-purple-500/20 transition-colors">
          <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
            <Crown className="w-3 h-3 text-purple-400" /> Tokens VIP
          </div>
          <div className="text-3xl font-black text-white">{operator?.inventory?.vipTokens || 0}</div>
          <p className="text-[10px] text-white/20 mt-1">Cada token = 30 días VIP para un cliente</p>
        </div>

        <div className="bg-[#141414] border border-[#FFDE00]/10 rounded-xl p-5 hover:border-[#FFDE00]/20 transition-colors">
          <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
            <Coins className="w-3 h-3 text-[#FFDE00]" /> Créditos Mayoristas
          </div>
          <div className="text-3xl font-black text-white">{(operator?.inventory?.credits || 0).toLocaleString()}</div>
          <p className="text-[10px] text-white/20 mt-1">Para distribuir a tus sub-agentes</p>
        </div>

        <div className="bg-[#141414] border border-cyan-500/10 rounded-xl p-5 hover:border-cyan-500/20 transition-colors">
          <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3 text-cyan-400" /> Sub-Agentes
          </div>
          <div className="text-3xl font-black text-white">{subAgents.length}</div>
          <p className="text-[10px] text-white/20 mt-1">Usuarios vinculados a tu agencia</p>
        </div>
      </div>

      {/* Low inventory warning */}
      {operator?.inventory && (operator.inventory.vipTokens === 0 && operator.inventory.credits === 0) && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">⚠️ Tu inventario está vacío</p>
            <p className="text-xs text-red-400/60 mt-1">No podrás activar a tus Sub-Agentes. Contacta al Administrador Central para adquirir más licencias VIP y créditos mayoristas.</p>
          </div>
        </div>
      )}

      {/* Sub-Agents */}
      <div className="bg-[#141414] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" /> Sub-Agentes ({subAgents.length})
          </h2>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {subAgents.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-white/30 text-sm">Aún no tienes sub-agentes.</p>
              <p className="text-white/15 text-xs mt-2">Comparte tu código <strong className="text-[#FFDE00]">{operator?.affiliateCode}</strong> para que usuarios se vinculen.</p>
            </div>
          ) : (
            subAgents.map(u => (
              <div key={u.id}>
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                >
                  <div className="flex items-center gap-3">
                    <img src={u.avatar} alt="" className="w-10 h-10 rounded-full border border-white/10" />
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">{u.name}</div>
                      <div className="text-[11px] text-white/30">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest ${u.plan === 'VIP' ? 'bg-[#FFDE00]/10 text-[#FFDE00] border border-[#FFDE00]/20' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}>
                      {u.plan}
                    </span>
                    <span className="text-xs font-bold text-white/50">{(u.credits || 0).toLocaleString()} cr</span>
                    {expandedUserId === u.id ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </div>
                </button>

                {expandedUserId === u.id && (
                  <div className="px-4 pb-5 pt-2 bg-[#0A0A0A] space-y-4">
                    {/* VIP Action */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => assignVip(u.id)}
                        disabled={processingId === u.id || (operator?.inventory?.vipTokens || 0) <= 0}
                        className="flex-1 py-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {processingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                        Asignar VIP (+30 días) — Cuesta 1 Token
                      </button>
                    </div>

                    {/* Credits */}
                    <div>
                      <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Modificar Créditos</div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={creditInput[u.id] || ''}
                          onChange={(e) => setCreditInput(prev => ({ ...prev, [u.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                          placeholder="Ej: 500"
                          className="flex-1 bg-[#141414] border border-white/[0.06] rounded-xl text-white/90 placeholder-white/20 px-4 py-3 text-sm focus:outline-none focus:border-[#FFDE00]/50 transition-colors text-center font-bold"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const amt = Math.abs(Number(creditInput[u.id]));
                              if (amt > 0) modifyCredits(u.id, -amt);
                            }}
                            disabled={processingId === u.id || !creditInput[u.id] || Number(creditInput[u.id]) <= 0}
                            className="flex-1 sm:flex-none px-4 py-3 bg-red-500/10 text-red-400 text-[11px] font-black uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 border border-red-500/20 rounded-xl min-w-[90px]"
                          >
                            - Retirar
                          </button>
                          <button
                            onClick={() => {
                              const amt = Math.abs(Number(creditInput[u.id]));
                              if (amt > 0) modifyCredits(u.id, amt);
                            }}
                            disabled={processingId === u.id || !creditInput[u.id] || Number(creditInput[u.id]) <= 0}
                            className="flex-1 sm:flex-none px-4 py-3 bg-emerald-500/10 text-emerald-400 text-[11px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50 border border-emerald-500/20 rounded-xl min-w-[90px]"
                          >
                            + Entregar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Codes Section */}
      <div className="bg-[#141414] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#FFDE00]" /> Mis Códigos
          </h2>
          <button
            onClick={() => setShowCodeForm(!showCodeForm)}
            className="bg-[#FFDE00]/10 text-[#FFDE00] border border-[#FFDE00]/20 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#FFDE00] hover:text-black transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        {/* Code creation form */}
        {showCodeForm && (
          <form onSubmit={createCode} className="p-5 border-b border-white/[0.06] bg-[#0A0A0A] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Nombre del Código</label>
                <input
                  type="text"
                  value={codeForm.code}
                  onChange={e => setCodeForm({ ...codeForm, code: e.target.value })}
                  placeholder="Ej: AGENCIA2026"
                  className="w-full bg-[#141414] text-white border border-white/[0.06] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFDE00]/30 uppercase font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Tipo de Premio</label>
                <select
                  value={codeForm.reward_type}
                  onChange={e => setCodeForm({ ...codeForm, reward_type: e.target.value })}
                  className="w-full bg-[#141414] text-white border border-white/[0.06] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFDE00]/30"
                >
                  <option value="credits">Créditos</option>
                  <option value="vip_days">Días VIP</option>
                  <option value="combo">VIP + Créditos</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                  {codeForm.reward_type === 'credits' ? 'Cantidad de Créditos' : codeForm.reward_type === 'combo' ? 'Días VIP' : 'Días'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={codeForm.reward_value}
                  onChange={e => setCodeForm({ ...codeForm, reward_value: e.target.value })}
                  placeholder="Ej: 30"
                  className="w-full bg-[#141414] text-white border border-white/[0.06] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFDE00]/30"
                  required
                />
              </div>
              {codeForm.reward_type === 'combo' && (
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Créditos a Incluir</label>
                  <input
                    type="number"
                    min="1"
                    value={codeForm.combo_credits}
                    onChange={e => setCodeForm({ ...codeForm, combo_credits: e.target.value })}
                    placeholder="Ej: 500"
                    className="w-full bg-[#141414] text-white border border-white/[0.06] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFDE00]/30"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Stock (Obligatorio)</label>
                <input
                  type="number"
                  min="1"
                  value={codeForm.stock}
                  onChange={e => setCodeForm({ ...codeForm, stock: e.target.value })}
                  placeholder="Ej: 5 usos"
                  className="w-full bg-[#141414] text-white border border-white/[0.06] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFDE00]/30"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submittingCode}
                className="bg-[#FFDE00] text-black font-black py-3 px-6 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submittingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar Código"}
              </button>
              <button
                type="button"
                onClick={() => setShowCodeForm(false)}
                className="text-white/40 hover:text-white px-4 py-3 rounded-xl hover:bg-white/[0.04] transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Codes list */}
        <div className="p-5 space-y-3">
          {loadingCodes ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-[#FFDE00]" /></div>
          ) : codes.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-8">No has generado códigos aún.</p>
          ) : (
            codes.map(code => {
              const isExpired = new Date(code.expires_at) < new Date();
              const isDepleted = code.stock !== null && code.used_count >= code.stock;
              const statusBad = isExpired || isDepleted;

              return (
                <div key={code.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${statusBad ? 'bg-red-500/5 border-red-500/15' : 'bg-[#0A0A0A] border-white/[0.06] hover:border-[#FFDE00]/20'}`}>
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className={`text-lg font-black tracking-widest uppercase ${statusBad ? 'text-white/30 line-through' : 'text-[#FFDE00]'}`}>
                        {code.code}
                      </span>
                      {statusBad && <span className="bg-red-500/20 text-red-500 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full">Inactivo</span>}
                    </div>
                    <p className="text-xs text-white/40">
                      Premio: <strong className="text-white/70">{code.reward_type === 'combo' ? `${code.reward_value} Días VIP + ${code.combo_credits || 0} Créditos` : `${code.reward_value} ${code.reward_type === 'vip_days' ? 'Días VIP' : 'Créditos'}`}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg font-black text-white">{code.used_count} <span className="text-xs font-medium text-white/30">/ {code.stock || '∞'}</span></div>
                      <div className="text-[9px] uppercase font-bold text-white/20 tracking-wider">Usados</div>
                    </div>
                    <button
                      onClick={() => deleteCode(code.id)}
                      className="p-2.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-colors"
                      title="Eliminar y recuperar inventario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
