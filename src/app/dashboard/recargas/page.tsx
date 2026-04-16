"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { DollarSign, Clock, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, ShieldAlert, MessageSquare, Filter, Loader2, Lock, ShoppingBag } from "lucide-react";
import VipGate from "@/components/VipGate";
import EcuabetHeader from "@/components/EcuabetHeader";

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
  const [iframeKey, setIframeKey] = useState(0);

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
            
            <div className="relative mx-auto w-24 h-24">
              <div className="relative w-24 h-24 bg-[#141414] border border-[#25D366]/20 rounded-lg flex items-center justify-center">
                <Lock className="w-10 h-10 text-[#25D366]" />
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
              className="flex items-center justify-center gap-2 bg-[#25D366] text-black font-semibold px-6 py-3 rounded-lg hover:brightness-110 transition-colors uppercase tracking-widest text-xs mx-auto"
            >
              <ShoppingBag className="w-4 h-4" />
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
          <div className="bg-[#141414] rounded-lg border border-white/[0.06] p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 w-12 h-12 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <DollarSign className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-white/90 tracking-tight">
                    Recargas Pendientes
                  </h1>
                  <p className="text-white/40 text-sm mt-0.5">
                    Solicitudes de recarga detectadas automáticamente por el bot.
                  </p>
                </div>
              </div>

              <button 
                onClick={fetchRecargas}
                className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white/90 p-2.5 rounded-lg flex items-center gap-2 transition-colors"
                title="Actualizar"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-semibold sm:hidden">Actualizar</span>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap border ${
                    filter === f.key
                      ? f.color === "yellow" ? "bg-[#FFDE00]/10 text-[#FFDE00] border-[#FFDE00]/20"
                      : f.color === "green" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : f.color === "red" ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-white/[0.08] text-white/90 border-white/[0.15]"
                      : "bg-transparent text-white/40 border-transparent hover:bg-white/[0.04] hover:text-white/80"
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
            <div className="bg-[#141414] border border-white/[0.06] rounded-lg p-10 text-center">
              <DollarSign className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white/40">Sin recargas {filter === "pending" ? "pendientes" : ""}</h3>
              <p className="text-white/20 mt-1 text-xs">Cuando un cliente solicite una recarga por WhatsApp, aparecerá aquí automáticamente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recargas.map(r => (
                <div key={r.id} className="bg-[#141414] border border-white/[0.06] rounded-lg overflow-hidden hover:border-white/[0.1] transition-colors">
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Info del cliente */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        r.is_scammer 
                          ? "bg-red-500/10 border border-red-500/20" 
                          : r.status === "completed" ? "bg-emerald-500/10 border border-emerald-500/20"
                          : r.status === "rejected" ? "bg-red-500/10 border border-red-500/20"
                          : "bg-[#FFDE00]/10 border border-[#FFDE00]/20"
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
                    <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-white/[0.06] sm:border-0">
                      <div className={`text-lg font-bold px-3 py-1 rounded-lg ${
                        r.is_scammer ? "text-red-400 bg-red-500/10 border border-red-500/20" : "text-[#FFDE00] bg-[#FFDE00]/10 border border-[#FFDE00]/20"
                      }`}>
                        ${r.amount?.toFixed(2) || "?"}
                      </div>

                      {r.status === "pending" && !r.is_scammer && (
                        <div className="flex gap-1.5 border-l border-white/[0.06] pl-3 ml-1">
                          <button
                            onClick={() => setConfirmModal(r)}
                            disabled={updatingId === r.id}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-2 rounded-lg transition-colors border border-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                            title="Confirmar recarga realizada"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[10px] font-semibold hidden sm:inline uppercase tracking-widest">Confirmar</span>
                          </button>
                          <button
                            onClick={() => updateStatus(r.id, "rejected")}
                            disabled={updatingId === r.id}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors border border-red-500/20 disabled:opacity-50"
                            title="Rechazar"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => togglePreview(r)}
                        className="bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/80 p-2 rounded-lg transition-colors border border-white/[0.06]"
                        title="Ver conversación"
                      >
                        {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
        <div className="bg-[#141414] border border-white/[0.06] rounded-lg overflow-hidden h-[450px] sm:h-[700px] flex flex-col relative group sticky top-4">
          <EcuabetHeader iframeKey={iframeKey} setIframeKey={setIframeKey} />
          <div className="flex-1 w-full bg-[#0d0d0d] relative" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Loading placeholder underneath iframe */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-0">
               <Loader2 className="w-10 h-10 text-[#FFDE00] animate-spin mb-4" />
               <span className="text-gray-400 font-bold tracking-widest text-sm uppercase">Cargando Plataforma...</span>
            </div>
            {/* The actual iframe */}
            <div className="absolute inset-0 z-10 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <iframe 
                key={iframeKey}
                src="https://caja.ecuabet.com/#!/top/recargarCredito" 
                className="w-full h-full border-none bg-white"
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
        <div className="bg-[#141414] border border-white/[0.06] rounded-lg p-6 sm:p-8 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest">¿Confirmar recarga?</h3>
          </div>
          <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Cliente</span>
              <span className="text-sm font-semibold text-white/90">{confirmModal.client_name || "Cliente"}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Teléfono</span>
              <span className="text-xs font-mono text-white/60">{confirmModal.phone_number?.replace("@c.us", "")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Monto</span>
              <span className="text-lg font-bold text-[#FFDE00]">${confirmModal.amount?.toFixed(2) || "?"}</span>
            </div>
          </div>
          <p className="text-white/40 text-[10px] mb-6 uppercase tracking-wider">
            Al confirmar, pasará a estado completada en la plataforma.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmModal(null)}
              disabled={updatingId === confirmModal.id}
              className="flex-1 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white/60 rounded-lg font-medium text-xs border border-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => updateStatus(confirmModal.id, "completed")}
              disabled={updatingId === confirmModal.id}
              className="flex-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 uppercase tracking-wider"
            >
              {updatingId === confirmModal.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              {updatingId === confirmModal.id ? "Procesando..." : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    )}

    </VipGate>
  );
}
