"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, Search, Coins, Plus, Minus, MessageSquare } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function AdminPanelPage() {
  const { user } = useUser();
  const router = useRouter();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Estados del modal de WhatsApp
  const [editingWa, setEditingWa] = useState<any | null>(null);
  const [waForm, setWaForm] = useState({ isUnlocked: false, apiUrl: "", idInstance: "", apiTokenInstance: "" });

  // Sincronizar el formulario cuando abrimos el modal
  useEffect(() => {
    if (editingWa) {
      setWaForm({
        isUnlocked: editingWa.whatsappSettings?.isUnlocked || false,
        apiUrl: editingWa.whatsappSettings?.providerConfig?.apiUrl || "",
        idInstance: editingWa.whatsappSettings?.providerConfig?.idInstance || "",
        apiTokenInstance: editingWa.whatsappSettings?.providerConfig?.apiTokenInstance || ""
      });
    }
  }, [editingWa]);

  const saveWaSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWa) return;
    
    setProcessingId(editingWa.id);
    try {
      const res = await fetch("/api/admin/whatsapp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: editingWa.id,
          isUnlocked: waForm.isUnlocked,
          providerConfig: {
            apiUrl: waForm.apiUrl,
            idInstance: waForm.idInstance,
            apiTokenInstance: waForm.apiTokenInstance
          }
        })
      });

      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === editingWa.id ? { 
          ...u, 
          whatsappSettings: { 
            isUnlocked: waForm.isUnlocked, 
            providerConfig: { apiUrl: waForm.apiUrl, idInstance: waForm.idInstance, apiTokenInstance: waForm.apiTokenInstance } 
          } 
        } : u));
        setEditingWa(null); // Cerrar modal
      } else {
        alert("Error guardando config de telefonía");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red");
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    // Si la página carga y no es admin, échalo
    if (user && !isAdmin) {
      router.push("/dashboard");
    }
  }, [user, isAdmin, router]);

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const modifyCredits = async (targetId: string, currentCredits: number | undefined, amount: number) => {
    if (!confirm(`Estás a punto de ${amount > 0 ? 'AÑADIR' : 'RESTAR'} ${Math.abs(amount)} créditos al usuario. ¿Continuar?`)) return;
    
    setProcessingId(targetId);
    try {
       // Si es undefined, lo tomamos como 0 y se inyectará forzosamente la suma (aunque normalmente al entrar se les dan 10k)
       const base = currentCredits === undefined ? 0 : currentCredits;
       let newBalance = base + amount;
       if (newBalance < 0) newBalance = 0; // Prevenir créditos negativos

       const res = await fetch("/api/admin/users/update", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ targetUserId: targetId, newCredits: newBalance })
       });

       if (res.ok) {
         // UI optimista temporal
         setUsers(prev => prev.map(u => u.id === targetId ? { ...u, credits: newBalance } : u));
       } else {
         alert("Error inyectando economía. Revisa la consola.");
       }
     } catch (e) {
      alert("Error en la conexión con Clerk.");
    } finally {
      setProcessingId(null);
    }
  };

  const togglePlan = async (targetId: string, currentPlan: string) => {
    const newPlan = currentPlan === "VIP" ? "FREE" : "VIP";
    if (!confirm(`¿Estás seguro de cambiar el plan a ${newPlan}?`)) return;
    
    setProcessingId(targetId);
    try {
       const res = await fetch("/api/admin/users/update", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ targetUserId: targetId, newPlan })
       });

       if (res.ok) {
         setUsers(prev => prev.map(u => u.id === targetId ? { ...u, plan: newPlan } : u));
       } else {
         alert("Error modificando el plan.");
       }
    } catch (e) {
      alert("Error en la conexión.");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) return null;

  const totalAgents = users.length;
  const totalVips = users.filter(u => u.plan === 'VIP').length;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121212] border border-white/5 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFDE00]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
         <div className="z-10 relative">
           <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
             <ShieldCheck className="w-8 h-8 text-[#FFDE00]" />
             Panel de Administración
           </h1>
           <p className="text-gray-400 mt-2 text-sm max-w-md">Supervisa y controla los balances económicos y rangos de los agentes en tiempo real.</p>
         </div>

         {/* Stats Rápidas */}
         <div className="flex items-center gap-4 z-10 relative">
            <div className="bg-white/10 border border-white/5 p-4 rounded-2xl text-center min-w-[120px]">
               <div className="text-3xl font-black">{totalAgents}</div>
               <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">Agentes</div>
            </div>
            <div className="bg-white/10 border border-white/5 p-4 rounded-2xl text-center min-w-[120px]">
               <div className="text-3xl font-black text-[#FFDE00]">{totalVips}</div>
               <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">VIPs</div>
            </div>
         </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          Directorio de Oficiales
        </h2>
        
        <div className="relative w-full sm:w-80">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-white/5 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FFDE00] shadow-sm text-sm font-medium placeholder-gray-600 transition-shadow"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#FFDE00]" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-[#121212] border border-white/5 rounded-3xl text-gray-500 font-medium text-lg shadow-xl">
              No coinciden agentes con tu búsqueda.
            </div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="bg-[#121212] border border-white/5 rounded-3xl p-6 shadow-xl hover:shadow-[0_0_20px_rgba(255,222,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-auto group cursor-default">
                
                {/* Sección 1: Identidad y Rango */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <img src={u.avatar || "https://ui-avatars.com/api/?name=U"} alt="A" className="w-12 h-12 rounded-full border-2 border-white/10" />
                    <div>
                      <div className="font-bold text-white truncate max-w-[150px] group-hover:text-[#FFDE00] transition-colors">{u.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[150px]">{u.email}</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => togglePlan(u.id, u.plan)}
                    disabled={processingId === u.id}
                    title="Clic para cambiar de rol"
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 disabled:opacity-50 flex items-center justify-center shrink-0 min-w-[60px] ${u.plan === 'VIP' ? 'bg-[#FFDE00] text-black shadow-[0_0_10px_rgba(255,222,0,0.5)] hover:bg-[#FFC107]' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                  >
                    {processingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : u.plan}
                  </button>
                </div>

                <div className="w-full bg-white/5 h-px mb-6"></div>

                {/* Sección 2: Economía */}
                <div>
                  <div className="text-[11px] text-gray-500 uppercase font-black tracking-widest mb-2">Billetera de Créditos</div>
                  <div className="flex items-end justify-between gap-4">
                    
                    {/* Visualizador de Saldo */}
                    <div className="flex items-center gap-2">
                       <Coins className="w-8 h-8 text-[#FFDE00] drop-shadow-[0_0_5px_rgba(255,222,0,0.5)]" />
                       <div className="flex flex-col">
                         {u.credits === undefined ? (
                           <span className="text-sm font-medium text-gray-600 italic">Sin Activar</span>
                         ) : (
                           <span className="text-2xl font-black text-white leading-none text-shadow-sm">{u.credits.toLocaleString()}</span>
                         )}
                       </div>
                    </div>

                    {/* Botones de Inyección In-Line */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-black/50 p-1.5 rounded-xl border border-white/5">
                       <button 
                         onClick={() => modifyCredits(u.id, u.credits, -1000)}
                         disabled={processingId === u.id || (u.credits !== undefined && u.credits <= 0)}
                         className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 shadow-sm border border-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-all disabled:opacity-50"
                         title="Restar 1,000"
                       >
                         <Minus className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => modifyCredits(u.id, u.credits, 1000)}
                         disabled={processingId === u.id}
                         className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 shadow-sm border border-white/5 flex items-center justify-center hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/50 transition-all disabled:opacity-50"
                         title="Añadir 1,000"
                       >
                         <Plus className="w-4 h-4" />
                       </button>
                       <div className="w-px h-6 bg-white/10 mx-1"></div>
                       <button 
                         onClick={() => modifyCredits(u.id, u.credits, 10000)}
                         disabled={processingId === u.id}
                         className="px-2 h-8 rounded-lg text-[11px] font-black bg-[#FFDE00] text-black shadow-[0_0_10px_rgba(255,222,0,0.3)] hover:bg-[#FFC107] hover:shadow-[0_0_15px_rgba(255,222,0,0.5)] transition-all disabled:opacity-50 flex items-center justify-center hover:scale-105"
                         title="Inyectar Paquete Master"
                       >
                         +10K
                       </button>
                    </div>

                  </div>
                </div>

                {/* Sección 3: Opciones del Admin (WhatsApp) */}
                <div className="mt-4 flex justify-between items-center border-t border-white/5 pt-4">
                   <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Módulo WhatsApp (IA)
                   </div>
                   <button
                     onClick={() => setEditingWa(u)}
                     className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${u.whatsappSettings?.isUnlocked ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/30' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                   >
                     {u.whatsappSettings?.isUnlocked ? 'ACTIVO (Gestionar)' : 'VENDER / ACTIVAR'}
                   </button>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL CONFIGURACIÓN WHATSAPP */}
      {editingWa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-[#111111] border border-white/10 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full relative">
              <button onClick={() => setEditingWa(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                <Minus className="w-6 h-6 rotate-45" />
              </button>
              
              <div className="w-12 h-12 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-xl flex items-center justify-center shadow-lg mb-4">
                 <MessageSquare className="w-6 h-6 text-white" />
              </div>
              
              <h3 className="text-xl font-black text-white mb-2">WhatsApp IA para {editingWa.name}</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Aquí conectas el servicio de telefonía. El usuario te pagó los $25 mensuales. Tú configuras su línea técnica de Green-API aquí, y a él mágicamente se le habilitará la interfaz para "Entrenar" al bot.
              </p>

              <div className="bg-[#FFDE00]/10 border border-[#FFDE00]/20 p-3 rounded-xl mb-6">
                <span className="block text-[10px] font-black uppercase text-[#FFDE00] mb-1">Copia este Webhook en Green-API:</span>
                <code className="block w-full bg-black/50 p-2 rounded text-xs text-white font-mono break-all select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}` : 'https://zamtools.vercel.app'}/api/whatsapp/webhook?uid={editingWa.id}
                </code>
              </div>

              <form onSubmit={saveWaSettings} className="space-y-4">
                 <label className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-[#25D366]"
                      checked={waForm.isUnlocked}
                      onChange={e => setWaForm({ ...waForm, isUnlocked: e.target.checked })}
                    />
                    <span className={`text-sm font-bold ${waForm.isUnlocked ? 'text-[#25D366]' : 'text-gray-400'}`}>
                      {waForm.isUnlocked ? 'MÓDULO DESBLOQUEADO' : 'DESBLOQUEAR ESTE MÓDULO AL CLIENTE'}
                    </span>
                 </label>

                 {waForm.isUnlocked && (
                   <div className="space-y-3 bg-[#0A0A0A] p-4 rounded-xl border border-[#25D366]/20">
                     <div>
                       <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">API URL (Green API)</label>
                       <input 
                         type="text" 
                         value={waForm.apiUrl}
                         onChange={e => setWaForm({ ...waForm, apiUrl: e.target.value })}
                         placeholder="Ej: https://7103.api.greenapi.com"
                         className="w-full bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-lg border border-white/5 focus:border-[#25D366] outline-none font-mono"
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">ID INSTANCE</label>
                       <input 
                         type="text" 
                         value={waForm.idInstance}
                         onChange={e => setWaForm({ ...waForm, idInstance: e.target.value })}
                         placeholder="Ej: 7103123456"
                         className="w-full bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-lg border border-white/5 focus:border-[#25D366] outline-none font-mono"
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">API TOKEN SECRETO</label>
                       <input 
                         type="text" 
                         value={waForm.apiTokenInstance}
                         onChange={e => setWaForm({ ...waForm, apiTokenInstance: e.target.value })}
                         placeholder="Token alfanumérico largo..."
                         className="w-full bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-lg border border-white/5 focus:border-[#25D366] outline-none font-mono"
                       />
                     </div>
                   </div>
                 )}

                 <button 
                   type="submit"
                   disabled={processingId === editingWa.id}
                   className="w-full bg-[#25D366] hover:bg-[#1DA851] text-black font-black uppercase tracking-widest py-3 rounded-xl mt-4 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                 >
                   {processingId === editingWa.id ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Guardar y Desplegar'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
