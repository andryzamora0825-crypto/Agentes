"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { DollarSign, Clock, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, ShieldAlert, MessageSquare, Filter, Loader2, Lock, ShoppingBag, ExternalLink } from "lucide-react";
import VipGate from "@/components/VipGate";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [recargas, setRecargas] = useState<Recarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chatPreview, setChatPreview] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [hasWhatsappBot, setHasWhatsappBot] = useState<boolean | null>(null); // null = loading
  const [confirmModal, setConfirmModal] = useState<Recarga | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";

  // Verificar si tiene Bot
  useEffect(() => {
    fetch("/api/user/sync")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHasWhatsappBot(data.hasWhatsappBot || false);
        } else {
          setHasWhatsappBot(false);
        }
      })
      .catch(() => setHasWhatsappBot(false));
  }, []);

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
    if (hasWhatsappBot || isAdmin) {
      fetchRecargas();
    }
  }, [filter, hasWhatsappBot]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await fetch("/api/recargas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      setRecargas(prev => prev.filter(r => r.id !== id));
      if (status === "completed") {
        setConfirmSuccess(true);
        setTimeout(() => setConfirmSuccess(false), 3000);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
      setConfirmModal(null);
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

  // Loading state while checking bot
  if (hasWhatsappBot === null) {
    return (
      <VipGate>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-[#FFDE00]" />
        </div>
      </VipGate>
    );
  }

  // Gate: No tiene Bot de WhatsApp
  if (!hasWhatsappBot && !isAdmin) {
    return (
      <VipGate>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
          <div className="max-w-md w-full text-center space-y-6 relative">
            <div className="absolute inset-0 bg-[#25D366]/5 rounded-full blur-[120px] -z-10 scale-150 pointer-events-none" />
            
            <div className="relative mx-auto w-28 h-28">
              <div className="absolute inset-0 bg-[#25D366]/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-28 h-28 bg-[#111111] border-2 border-[#25D366]/30 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(37,211,102,0.15)]">
                <Lock className="w-12 h-12 text-[#25D366]" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                <MessageSquare className="w-3.5 h-3.5" />
                Requiere Bot de WhatsApp
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Recargas Pendientes</h2>
              <p className="text-gray-400 text-base leading-relaxed max-w-sm mx-auto">
                Esta sección solo está disponible para usuarios que tienen contratado el <span className="text-[#25D366] font-black">Bot de WhatsApp Automatizado</span>.
                Las recargas se detectan automáticamente por el bot.
              </p>
            </div>

            <button
              onClick={() => router.push("/dashboard/tienda")}
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-black px-8 py-3.5 rounded-2xl hover:bg-[#1DA851] hover:shadow-[0_0_30px_rgba(37,211,102,0.4)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-sm mx-auto"
            >
              <ShoppingBag className="w-5 h-5" />
              Contratar Bot en la Tienda
            </button>
          </div>
        </div>
      </VipGate>
    );
  }

  return (
    <VipGate>
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Toast de éxito */}
      {confirmSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-green-500/20 border border-green-500/40 text-green-400 px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5" />
          ¡Recarga marcada como completada exitosamente!
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Columna Izquierda: Lista de Recargas */}
        <div className="space-y-6">
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
                            onClick={() => setConfirmModal(r)}
                            disabled={updatingId === r.id}
                            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 p-2.5 rounded-xl transition-all border border-green-500/20 disabled:opacity-50 flex items-center gap-1.5"
                            title="Confirmar recarga realizada"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-xs font-bold hidden sm:inline">Confirmar</span>
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

        {/* Columna Derecha: Iframe Caja Ecuabet */}
        <div className="bg-[#121212] border border-white/10 rounded-3xl overflow-auto shadow-2xl min-h-[700px] flex flex-col relative group sticky top-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="px-5 py-4 bg-black/80 border-b border-white/10 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-white font-black text-sm tracking-widest uppercase truncate max-w-[140px] sm:max-w-none">Sistema Caja Ecuabet</span>
            </div>
            <a href="https://caja.ecuabet.com/#!/top/recargarCredito" target="_blank" rel="noreferrer" className="text-[10px] sm:text-xs font-bold text-[#FFDE00] bg-[#FFDE00]/10 hover:bg-[#FFDE00]/20 px-3 py-1.5 rounded-full transition-colors border border-[#FFDE00]/30 shadow-[0_0_10px_rgba(255,222,0,0.1)] flex items-center gap-1.5 truncate max-w-[130px] sm:max-w-none">
              <ExternalLink className="w-3 h-3 shrink-0" /> Abrir Externamente
            </a>
          </div>
          <div className="flex-1 w-full bg-[#0d0d0d] relative overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Loading placeholder underneath iframe */}
            <div className="absolute inset-x-0 top-32 flex flex-col items-center justify-center z-0">
               <Loader2 className="w-10 h-10 text-[#FFDE00] animate-spin mb-4" />
               <span className="text-gray-400 font-bold tracking-widest text-sm uppercase">Cargando Plataforma...</span>
            </div>
            {/* The actual iframe */}
            <div className="w-full h-full min-h-[800px] relative z-10 overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <iframe 
                src="https://caja.ecuabet.com/#!/top/recargarCredito" 
                className="w-full h-full border-none bg-white min-h-[800px]"
                title="Caja Ecuabet - Recargar Crédito"
              />
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* Modal de Confirmación de Recarga */}
    {confirmModal && (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-500/20 p-2.5 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-black text-white">¿Confirmar recarga realizada?</h3>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-bold uppercase">Cliente</span>
              <span className="text-sm font-bold text-white">{confirmModal.client_name || "Cliente"}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-bold uppercase">Teléfono</span>
              <span className="text-sm font-mono text-gray-300">{confirmModal.phone_number?.replace("@c.us", "")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase">Monto</span>
              <span className="text-xl font-black text-[#FFDE00]">${confirmModal.amount?.toFixed(2) || "?"}</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            Al confirmar, esta recarga será marcada como <span className="text-green-400 font-bold">completada</span> y se removerá de la lista de pendientes.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmModal(null)}
              disabled={updatingId === confirmModal.id}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold text-sm border border-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => updateStatus(confirmModal.id, "completed")}
              disabled={updatingId === confirmModal.id}
              className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {updatingId === confirmModal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {updatingId === confirmModal.id ? "Procesando..." : "Sí, Confirmar"}
            </button>
          </div>
        </div>
      </div>
    )}

    </VipGate>
  );
}
