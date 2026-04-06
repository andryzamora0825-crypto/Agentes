"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { DollarSign, Clock, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, ShieldAlert, MessageSquare, Filter } from "lucide-react";
import VipGate from "@/components/VipGate";

interface Recarga {
  id: string;
  phone_number: string;
  client_name: string;
  amount: number | null;
  bank: string | null;
  status: string;
  is_scammer: boolean;
  created_at: string;
}

export default function RecargasPage() {
  const { user } = useUser();
  const [recargas, setRecargas] = useState<Recarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chatPreview, setChatPreview] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRecargas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recargas?status=${filter}`);
      const data = await res.json();
      if (data.success) setRecargas(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecargas();
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await fetch("/api/recargas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      setRecargas(prev => prev.filter(r => r.id !== id));
    } catch(e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const togglePreview = async (recarga: Recarga) => {
    if (expandedId === recarga.id) {
      setExpandedId(null);
      setChatPreview([]);
      return;
    }
    
    setExpandedId(recarga.id);
    setLoadingChat(true);
    try {
      const res = await fetch(`/api/recargas/preview?phone=${encodeURIComponent(recarga.phone_number)}`);
      const data = await res.json();
      if (data.success) setChatPreview(data.messages);
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingChat(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-EC", { 
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true 
    });
  };

  const pendingCount = recargas.length;

  return (
    <VipGate>
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-[#0A0A0A] rounded-3xl border border-white/5 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Recargas Pendientes
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Solicitudes de recarga detectadas automáticamente por el bot.
              </p>
            </div>
          </div>

          <button 
            onClick={fetchRecargas}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mt-5 overflow-x-auto pb-1">
          {[
            { key: "pending", label: "Pendientes", icon: Clock, color: "yellow" },
            { key: "completed", label: "Completadas", icon: CheckCircle2, color: "green" },
            { key: "rejected", label: "Rechazadas", icon: XCircle, color: "red" },
            { key: "all", label: "Todas", icon: Filter, color: "gray" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                filter === f.key
                  ? f.color === "yellow" ? "bg-[#FFDE00]/20 text-[#FFDE00] border border-[#FFDE00]/30"
                  : f.color === "green" ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : f.color === "red" ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-white/10 text-white border border-white/20"
                  : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10 hover:text-gray-300"
              }`}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Recargas */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFDE00]" />
        </div>
      ) : recargas.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-500">Sin recargas {filter === "pending" ? "pendientes" : ""}</h3>
          <p className="text-gray-600 mt-2">Cuando un cliente solicite una recarga por WhatsApp, aparecerá aquí automáticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recargas.map(r => (
            <div key={r.id} className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden shadow-lg hover:border-white/10 transition-all">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Info del cliente */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    r.is_scammer 
                      ? "bg-red-500/20 border border-red-500/30" 
                      : r.status === "completed" ? "bg-green-500/20 border border-green-500/30"
                      : r.status === "rejected" ? "bg-red-500/20 border border-red-500/30"
                      : "bg-[#FFDE00]/20 border border-[#FFDE00]/30"
                  }`}>
                    {r.is_scammer ? (
                      <ShieldAlert className="w-6 h-6 text-red-400" />
                    ) : (
                      <DollarSign className={`w-6 h-6 ${
                        r.status === "completed" ? "text-green-400" 
                        : r.status === "rejected" ? "text-red-400"
                        : "text-[#FFDE00]"
                      }`} />
                    )}
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white truncate">{r.client_name || "Cliente"}</span>
                      {r.is_scammer && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-black uppercase border border-red-500/30">
                          🚨 ESTAFADOR
                        </span>
                      )}
                      {r.status === "completed" && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-black uppercase border border-green-500/30">
                          ✅ COMPLETADA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                      <span className="font-mono">{r.phone_number?.replace("@c.us", "")}</span>
                      <span>•</span>
                      <span>{formatTime(r.created_at)}</span>
                      {r.bank && (
                        <>
                          <span>•</span>
                          <span className="text-gray-400">{r.bank}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Monto + Acciones */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className={`text-2xl font-black px-4 py-1 rounded-xl ${
                    r.is_scammer ? "text-red-400 bg-red-500/10" : "text-[#FFDE00] bg-[#FFDE00]/10"
                  }`}>
                    ${r.amount?.toFixed(2) || "?"}
                  </div>

                  {r.status === "pending" && !r.is_scammer && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(r.id, "completed")}
                        disabled={updatingId === r.id}
                        className="bg-green-500/20 hover:bg-green-500/30 text-green-400 p-2.5 rounded-xl transition-all border border-green-500/20 disabled:opacity-50"
                        title="Marcar como completada"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "rejected")}
                        disabled={updatingId === r.id}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2.5 rounded-xl transition-all border border-red-500/20 disabled:opacity-50"
                        title="Rechazar"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => togglePreview(r)}
                    className="bg-white/5 hover:bg-white/10 text-gray-400 p-2.5 rounded-xl transition-all border border-white/5"
                    title="Ver conversación"
                  >
                    {expandedId === r.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Vista previa del chat */}
              {expandedId === r.id && (
                <div className="border-t border-white/5 bg-[#050505] p-4 max-h-[300px] overflow-y-auto">
                  {loadingChat ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FFDE00]" />
                    </div>
                  ) : chatPreview.length === 0 ? (
                    <p className="text-gray-600 text-center py-4 text-sm">No hay mensajes previos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {chatPreview.map((msg: any, i: number) => (
                        <div key={i} className={`flex ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                            msg.role === 'model' 
                              ? 'bg-white/5 text-gray-300 border border-white/5' 
                              : 'bg-[#FFDE00]/10 text-[#FFDE00] border border-[#FFDE00]/20'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <span className="text-[10px] text-gray-600 mt-1 block">
                              {msg.role === 'model' ? '🤖 Bot' : '👤 Cliente'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </VipGate>
  );
}
