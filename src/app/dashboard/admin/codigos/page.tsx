"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Ticket, Trash2, ShieldAlert } from "lucide-react";

export default function AdminCodigosPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [codeName, setCodeName] = useState("");
  const [rewardType, setRewardType] = useState("vip_days");
  const [rewardValue, setRewardValue] = useState("");
  const [comboCredits, setComboCredits] = useState("");
  const [stock, setStock] = useState("");

  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isLoaded, isAdmin, router]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes");
      const data = await res.json();
      if (data.success) {
        setCodes(data.codes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadCodes();
    }
  }, [isAdmin]);

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeName || !rewardValue) return alert("Completa los campos obligatorios");

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeName,
          reward_type: rewardType,
          reward_value: rewardValue,
          combo_credits: rewardType === 'combo' ? comboCredits : null,
          stock: stock ? stock : null
        })
      });

      const data = await res.json();

      if (data.success) {
        setCodeName("");
        setRewardValue("");
        setComboCredits("");
        setStock("");
        loadCodes();
      } else {
        alert(data.error || "Error creando código");
      }
    } catch (err) {
      alert("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar/expirar este código? Ya no podrá usarse.")) return;
    try {
      const res = await fetch(`/api/admin/promo-codes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadCodes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isLoaded || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-5rem)]">
        <Loader2 className="w-8 h-8 text-[#FFDE00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-white flex items-center gap-3">
          <Ticket className="w-10 h-10 text-[#FFDE00]" />
          Códigos Promocionales
        </h1>
        <p className="text-gray-400 mt-2 text-lg">
          Genera códigos para regalar créditos o días VIP. Expiran en 24h.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* FORM */}
        <div className="bg-[#0b0b0b] border border-white/10 p-6 rounded-2xl lg:col-span-1 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#FFDE00]" />
            Nuevo Código
          </h2>
          
          <form onSubmit={handleCreateCode} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Código</label>
              <input 
                type="text" 
                placeholder="Ej. BFX2026"
                value={codeName}
                onChange={e => setCodeName(e.target.value)}
                className="w-full bg-[#111111] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FFDE00] uppercase font-bold"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Premio</label>
              <select 
                value={rewardType}
                onChange={e => setRewardType(e.target.value)}
                className="w-full bg-[#111111] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FFDE00]"
              >
                <option value="vip_days">Días VIP</option>
                <option value="credits">Créditos</option>
                <option value="combo">VIP + Créditos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                {rewardType === 'combo' ? 'Días VIP' : rewardType === 'vip_days' ? 'Días' : 'Cantidad de Créditos'}
              </label>
              <input 
                type="number" 
                min="1"
                placeholder={rewardType === 'credits' ? "Ej. 1000" : "Ej. 3"}
                value={rewardValue}
                onChange={e => setRewardValue(e.target.value)}
                className="w-full bg-[#111111] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FFDE00]"
                required
              />
            </div>

            {rewardType === 'combo' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Créditos a Incluir</label>
                <input 
                  type="number" 
                  min="1"
                  placeholder="Ej. 500"
                  value={comboCredits}
                  onChange={e => setComboCredits(e.target.value)}
                  className="w-full bg-[#111111] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FFDE00]"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock (Opcional)</label>
              <input 
                type="number" 
                min="1"
                placeholder="Ilimitado si está vacío"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full bg-[#111111] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FFDE00]"
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-[#FFDE00] text-black font-black py-4 rounded-xl hover:bg-white hover:scale-[1.02] active:scale-95 transition-all mt-4 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generar Código"}
            </button>
          </form>
        </div>

        {/* LIST */}
        <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl lg:col-span-2 shadow-2xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-white/5 shrink-0">
            <h2 className="text-xl font-bold text-white">Códigos Activos e Historial</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#FFDE00]" /></div>
            ) : codes.length === 0 ? (
              <div className="text-center py-20 text-gray-500 font-medium">
                No has generado códigos promocionales aún.
              </div>
            ) : (
              codes.map(code => {
                const isExpired = new Date(code.expires_at) < new Date();
                const isDepleted = code.stock !== null && code.used_count >= code.stock;
                const statusBad = isExpired || isDepleted;

                return (
                  <div key={code.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${statusBad ? 'bg-red-500/5 border-red-500/20' : 'bg-[#111111] border-white/10 hover:border-[#FFDE00]/40'}`}>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xl font-black tracking-widest uppercase ${statusBad ? 'text-gray-500 line-through' : 'text-[#FFDE00]'}`}>
                          {code.code}
                        </span>
                        {statusBad && (
                          <span className="bg-red-500/20 text-red-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        Premio: <strong className="text-white">
                          {code.reward_type === 'combo'
                            ? `${code.reward_value} Días VIP + ${code.combo_credits || 0} Créditos`
                            : `${code.reward_value} ${code.reward_type === 'vip_days' ? 'Días VIP' : 'Créditos'}`
                          }
                        </strong>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Expira: {new Date(code.expires_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-black text-white">{code.used_count} <span className="text-sm font-medium text-gray-500">/ {code.stock ? code.stock : '∞'}</span></div>
                        <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Usados</div>
                      </div>
                      
                      <button 
                        onClick={() => handleDelete(code.id)}
                        className="p-3 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
