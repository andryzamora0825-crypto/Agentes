"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, Search, Coins, Plus, Minus, MessageSquare, Send, Zap, Ticket, X, Share2, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const VipCountdown = ({ expiresAt }: { expiresAt: number }) => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeft("VENCIDO");
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;
  const isExpired = timeLeft === "VENCIDO";

  return (
    <div className={`flex items-center px-2 py-1 rounded text-[10px] font-mono border ${!isExpired ? 'bg-[#FFDE00]/5 text-[#FFDE00]/70 border-[#FFDE00]/10' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
      {timeLeft === "VENCIDO" ? "VENCIDO" : <>{timeLeft} Left</>}
    </div>
  );
};

export default function AdminPanelPage() {
  const { user } = useUser();
  const router = useRouter();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Estados de Campaña de Estados Nano Banana
  const [promptsText, setPromptsText] = useState("");
  const [deployingStatus, setDeployingStatus] = useState(false);
  const [deployProgress, setDeployProgress] = useState({ total: 0, current: 0, logs: [] as string[] });

  // Estados del Centro de Difusión (Broadcast Meta)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTopic, setBroadcastTopic] = useState("");
  const [broadcastPlatform, setBroadcastPlatform] = useState<"facebook" | "instagram" | "both">("both");
  const [broadcastImageFormat, setBroadcastImageFormat] = useState<"square" | "landscape" | "portrait">("square");
  const [broadcastSelectedUsers, setBroadcastSelectedUsers] = useState<string[]>([]);
  const [broadcastSearch, setBroadcastSearch] = useState("");
  const [broadcastDeploying, setBroadcastDeploying] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ total: 0, current: 0, logs: [] as string[] });

  // Estados del modal de WhatsApp
  const [editingWa, setEditingWa] = useState<any | null>(null);
  const [waForm, setWaForm] = useState({ isUnlocked: false, apiUrl: "", idInstance: "", apiTokenInstance: "" });

  // Estados del modal de Social Media
  const [editingSocial, setEditingSocial] = useState<any | null>(null);
  const [socialForm, setSocialForm] = useState({ isUnlocked: false, meta_page_id: "", meta_page_access_token: "", meta_ig_user_id: "", auto_generate: false });

  // Estados del modal Galería Secreta (Admin-only)
  const [galleryUser, setGalleryUser] = useState<any | null>(null);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [lightboxAdminUrl, setLightboxAdminUrl] = useState<string | null>(null);

  // Estado para subida de logos globales (Multiplataforma)
  const [uploadingPlatform, setUploadingPlatform] = useState<string | null>(null);
  const [imageTokens, setImageTokens] = useState<Record<string, number>>({});

  // Estados para Modal de Activity Logs y Entradas Dinámicas de Economía
  const [customCreditInput, setCustomCreditInput] = useState<Record<string, string>>({});
  const [modalViewingLogs, setModalViewingLogs] = useState<any | null>(null);

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

  useEffect(() => {
    if (editingSocial) {
      setSocialForm({
        isUnlocked: editingSocial.socialMediaSettings?.isUnlocked || false,
        meta_page_id: editingSocial.socialMediaSettings?.meta_page_id || "",
        meta_page_access_token: editingSocial.socialMediaSettings?.meta_page_access_token || "",
        meta_ig_user_id: editingSocial.socialMediaSettings?.meta_ig_user_id || "",
        auto_generate: editingSocial.socialMediaSettings?.auto_generate || false,
      });
    }
  }, [editingSocial]);

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

  const saveSocialSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSocial) return;
    
    setProcessingId(editingSocial.id);
    try {
      const res = await fetch("/api/admin/social-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: editingSocial.id,
          isUnlocked: socialForm.isUnlocked,
          meta_page_id: socialForm.meta_page_id,
          meta_page_access_token: socialForm.meta_page_access_token,
          meta_ig_user_id: socialForm.meta_ig_user_id,
          auto_generate: socialForm.auto_generate
        })
      });

      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === editingSocial.id ? { 
          ...u, 
          socialMediaSettings: { 
            isUnlocked: socialForm.isUnlocked, 
            meta_page_id: socialForm.meta_page_id,
            meta_page_access_token: socialForm.meta_page_access_token,
            meta_ig_user_id: socialForm.meta_ig_user_id,
            auto_generate: socialForm.auto_generate
          } 
        } : u));
        setEditingSocial(null); // Cerrar modal
      } else {
        alert("Error guardando config de Social Media");
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

  const handleUploadGlobalLogo = async (e: any, platform: string) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm(`¿Estás seguro de sobrescribir el logo oficial de ${platform.toUpperCase()} para todos los agentes?`)) return;

    setUploadingPlatform(platform);
    try {
      const fileName = `agency-assets/default_${platform}.png`;
      const { error } = await supabase.storage
        .from('ai-generations')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
        
      if (error) throw error;
      setImageTokens(prev => ({ ...prev, [platform]: Date.now() }));
      alert(`Logo global de ${platform.toUpperCase()} actualizado exitosamente en el sistema.`);
    } catch (err: any) {
      console.error(err);
      alert("Error subiendo la imagen: " + err.message);
    } finally {
      setUploadingPlatform(null);
    }
  };

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

  const openGallery = async (targetUser: any) => {
    setGalleryUser(targetUser);
    setLoadingGallery(true);
    try {
      const res = await fetch(`/api/admin/history?targetEmail=${encodeURIComponent(targetUser.email)}`);
      const data = await res.json();
      if (data.success) {
        setGalleryImages(data.images);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Error de conexión con la galería");
    } finally {
      setLoadingGallery(false);
    }
  };

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
         setCustomCreditInput(prev => ({ ...prev, [targetId]: "" })); // Limpiar Input
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
         setUsers(prev => prev.map(u => u.id === targetId ? { 
           ...u, 
           plan: newPlan, 
           vipExpiresAt: newPlan === 'VIP' ? Date.now() + 30 * 24 * 60 * 60 * 1000 : null 
         } : u));
       } else {
         alert("Error modificando el plan.");
       }
    } catch (e) {
      alert("Error en la conexión.");
    } finally {
      setProcessingId(null);
    }
  };

  const renewVip = async (targetId: string, currentExpiry: number | undefined | null) => {
    if (!confirm(`¿Estás seguro de agregar 30 DÍAS a su tiempo VIP?`)) return;
    setProcessingId(targetId);
    try {
       const res = await fetch("/api/admin/users/update", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ targetUserId: targetId, action: "renew_vip" })
       });

       if (res.ok) {
         const now = Date.now();
         const newExpiry = (currentExpiry && currentExpiry > now) 
           ? currentExpiry + (30 * 24 * 60 * 60 * 1000)
           : now + (30 * 24 * 60 * 60 * 1000);
         
         setUsers(prev => prev.map(u => u.id === targetId ? { 
           ...u, 
           plan: "VIP", 
           vipExpiresAt: newExpiry
         } : u));
       } else {
         alert("Error renovando el plan VIP.");
       }
    } catch (e) {
      alert("Error en la conexión.");
    } finally {
      setProcessingId(null);
    }
  };

  const deployStatusCampaign = async () => {
    const rawPrompts = promptsText.split('\n').filter(p => p.trim() !== "");
    if (rawPrompts.length === 0) {
      alert("Por favor ingresa al menos un prompt.");
      return;
    }

    if (!confirm("¿Deseas desplegar esta campaña de estados? Esto generará imágenes IA para todos los agentes activos y las subirá a sus WhatsApp de forma inmediata.")) return;

    setDeployingStatus(true);
    setDeployProgress({ total: 0, current: 0, logs: ["Obteniendo lista de agentes activos..."] });

    try {
      const res = await fetch("/api/admin/active-agents");
      const data = await res.json();
      
      if (!data.success || !data.agents) {
        throw new Error("No se pudo obtener la lista de agentes");
      }

      const agents = data.agents;
      
      if (agents.length === 0) {
        setDeployProgress(p => ({ ...p, logs: [...p.logs, "❌ No hay agentes con WhatsApp activo configurado."] }));
        setDeployingStatus(false);
        return;
      }

      setDeployProgress(p => ({ ...p, total: agents.length, logs: [...p.logs, `✅ ${agents.length} agentes encontrados. Iniciando despliegue secuencial...`] }));

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        
        setDeployProgress(p => ({ 
          ...p, 
          current: i + 1, 
          logs: [...p.logs, `⏳ Procesando a ${agent.name}...`] 
        }));

        try {
          const randomPrompt = rawPrompts[Math.floor(Math.random() * rawPrompts.length)];
          
          const deployRes = await fetch("/api/admin/deploy-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent, basePrompt: randomPrompt })
          });

          const textResponse = await deployRes.text();
          let deployData;
          try {
            deployData = JSON.parse(textResponse);
          } catch (e) {
            throw new Error(`Parse error o timeout: ${textResponse.substring(0, 50)}...`);
          }
          
          if (deployRes.ok && deployData.success) {
            const gApiInfo = deployData.gApiResponse ? ` [GreenAPI: ${deployData.gApiResponse.substring(0, 80)}]` : '';
            setDeployProgress(p => ({ 
              ...p, 
              logs: [...p.logs, `✅ ${agent.name}: OK (HTTP ${deployData.gApiStatus})${gApiInfo}`] 
            }));
          } else {
             setDeployProgress(p => ({ 
              ...p, 
              logs: [...p.logs, `❌ ${agent.name}: Error - ${deployData.error || 'Desconocido'}`] 
            }));
          }
        } catch (err: any) {
          setDeployProgress(p => ({ 
             ...p, 
             logs: [...p.logs, `❌ ${agent.name}: Falló conexión - ${err.message}`] 
          }));
        }
      }

      setDeployProgress(p => ({ ...p, logs: [...p.logs, "🎉 ¡Despliegue finalizado!"] }));

    } catch (err: any) {
      setDeployProgress(p => ({ ...p, logs: [...p.logs, `❌ Error crítico: ${err.message}`] }));
    } finally {
      setDeployingStatus(false);
    }
  };

  const deployBroadcast = async () => {
    if (broadcastSelectedUsers.length === 0) {
      alert("Selecciona al menos un agente.");
      return;
    }
    if (!broadcastTopic.trim()) {
      alert("Por favor ingresa el tema/prompt.");
      return;
    }
    if (!confirm(`¿Desplegar publicación a ${broadcastSelectedUsers.length} agentes? Esto tomará su tiempo ya que genera IA iterativamente.`)) return;

    setBroadcastDeploying(true);
    setBroadcastProgress({ total: broadcastSelectedUsers.length, current: 0, logs: ["Iniciando Centro de Difusión Global de Redes Sociales..."] });

    for (let i = 0; i < broadcastSelectedUsers.length; i++) {
      const targetUserId = broadcastSelectedUsers[i];
      const u = users.find(x => x.id === targetUserId);
      const name = u ? u.name : targetUserId;

      setBroadcastProgress(p => ({ 
        ...p, 
        current: i + 1, 
        logs: [...p.logs, `⏳ [${i+1}/${broadcastSelectedUsers.length}] Generando IA para ${name}...`] 
      }));

      try {
        const res = await fetch("/api/admin/broadcast/single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            targetUserId: targetUserId, 
            topic: broadcastTopic, 
            platform: broadcastPlatform, 
            imageFormat: broadcastImageFormat 
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setBroadcastProgress(p => ({ 
            ...p, 
            logs: [...p.logs, `✅ ${name}: Publicado en Meta (${data.postUrl || 'OK'})`] 
          }));
        } else {
          setBroadcastProgress(p => ({ 
            ...p, 
            logs: [...p.logs, `❌ ${name}: Error - ${data.error}`] 
          }));
        }
      } catch (err: any) {
        setBroadcastProgress(p => ({ 
           ...p, 
           logs: [...p.logs, `❌ ${name}: Falló conexión HTTP - ${err.message}`] 
        }));
      }
    }

    setBroadcastProgress(p => ({ ...p, logs: [...p.logs, "🎉 ¡Difusión finalizada!"] }));
    setBroadcastDeploying(false);
  };


  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "ALL" ? true : u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  if (!isAdmin) return null;

  const totalAgents = users.length;
  const totalVips = users.filter(u => u.plan === 'VIP').length;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141414] border border-white/[0.06] p-6 sm:p-8 rounded-lg text-white">
         <div className="z-10 relative">
           <h1 className="text-xl font-semibold tracking-tight flex items-center gap-3">
             <ShieldCheck className="w-6 h-6 text-[#FFDE00]" />
             Panel de Administración
           </h1>
           <p className="text-white/30 mt-1 text-sm max-w-md">Supervisa y controla los balances económicos y rangos de los agentes en tiempo real.</p>
           
           <button 
             onClick={() => router.push('/dashboard/admin/codigos')}
             className="mt-6 bg-[#FFDE00] text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition-all flex items-center gap-2 text-sm max-w-max"
           >
             <Ticket className="w-4 h-4" />
             Generar Códigos Promo
           </button>
         </div>

         {/* Stats Rápidas */}
         <div className="flex items-center gap-4 z-10 relative">
            <div className="bg-[#0A0A0A] border border-white/[0.06] p-4 rounded-lg text-center min-w-[120px]">
               <div className="text-2xl font-bold">{totalAgents}</div>
               <div className="text-[10px] text-white/30 uppercase tracking-widest font-medium mt-1">Agentes</div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/[0.06] p-4 rounded-lg text-center min-w-[120px]">
               <div className="text-2xl font-bold text-[#FFDE00]">{totalVips}</div>
               <div className="text-[10px] text-[#FFDE00]/30 uppercase tracking-widest font-medium mt-1">VIPs</div>
            </div>
         </div>
      </div>

      {/* Campaña de Estados Masiva */}
      <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg relative overflow-hidden mt-6">
         <div className="flex items-start gap-4 z-10 relative">
            <div className="bg-purple-500/10 p-2 rounded-lg hidden sm:block">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white/90 mb-1 flex items-center gap-2">
                <span className="sm:hidden"><Zap className="w-4 h-4 text-purple-400" /></span>
                Desplegar Estados Nano Banana (Campañas IA)
              </h2>
              <p className="text-white/30 text-sm mb-6 max-w-2xl">
                Ingresa uno o múltiples *prompts* base. Nano Banana se encargará de adaptar el prompt usando la Identidad de Agencia de cada usuario activo.
              </p>

              <div className="space-y-4">
                <textarea 
                  value={promptsText}
                  onChange={e => setPromptsText(e.target.value)}
                  placeholder="Escribe tus prompts aquí (uno por línea)..."
                  className="w-full bg-[#0A0A0A] text-white/90 border border-white/[0.08] rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-y min-h-[120px] text-sm"
                  disabled={deployingStatus}
                />
                
                <button 
                  onClick={deployStatusCampaign}
                  disabled={deployingStatus || !promptsText.trim()}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 text-sm"
                  title="Esto NO consumirá créditos de los usuarios"
                >
                  {deployingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {deployingStatus ? "Procesando Campaña..." : "Iniciar Campaña"}
                </button>
              </div>

              {/* Logs de Despliegue */}
              {deployProgress.logs.length > 0 && (
                <div className="mt-6 bg-[#0A0A0A] border border-white/5 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Progreso del Despliegue</span>
                    {deployProgress.total > 0 && (
                      <span className="text-xs font-bold text-purple-400">{deployProgress.current} / {deployProgress.total} Agentes</span>
                    )}
                  </div>
                  
                  {deployProgress.total > 0 && (
                    <div className="w-full bg-white/5 h-2 rounded-full mb-4 overflow-hidden">
                      <div 
                        className="bg-purple-500 h-full transition-all duration-500" 
                        style={{ width: `${(deployProgress.current / deployProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto space-y-2 text-xs font-mono pr-2 custom-scrollbar">
                    {deployProgress.logs.map((log, idx) => (
                      <div key={idx} className={log.includes('✅') ? 'text-green-400' : log.includes('❌') ? 'text-red-400' : 'text-gray-400'}>
                        {log}
                      </div>
                    ))}
                  </div>
                  
                  {!deployingStatus && deployProgress.logs.some(l => l.includes('finalizado')) && (
                     <button onClick={() => { setDeployingStatus(false); setDeployProgress({total:0, current:0, logs:[]}); }} className="mt-4 text-xs font-bold text-gray-500 hover:text-white underline">
                       Cerrar y Limpiar
                     </button>
                  )}
                </div>
              )}
            </div>
         </div>
      </div>

      {/* Campaña de Difusión Global Meta (Redes Sociales) */}
      <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg relative overflow-hidden mt-6">
         <div className="flex items-start gap-4 z-10 relative">
            <div className="bg-fuchsia-500/10 p-2 rounded-lg hidden sm:block">
              <Share2 className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white/90 mb-1 flex items-center gap-2">
                <span className="sm:hidden"><Share2 className="w-4 h-4 text-fuchsia-400" /></span>
                Centro de Difusión Global (Meta)
              </h2>
              <p className="text-white/30 text-sm mb-6 max-w-2xl">
                Alimenta este módulo con un caso base y el sistema distribuirá gráficas y textos a cada uno de los clientes en FB/IG.
              </p>

              <div className="space-y-4 max-w-3xl">
                <div>
                  <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2 block">Tema Central / Prompt (Requerido)</label>
                  <textarea 
                    value={broadcastTopic}
                    onChange={e => setBroadcastTopic(e.target.value)}
                    placeholder="Ej: Hoy es el día..."
                    className="w-full bg-[#0A0A0A] text-white/90 border border-white/[0.08] rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50 resize-y min-h-[100px] text-sm"
                    disabled={broadcastDeploying}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Plataforma Objetivo</label>
                    <select 
                      value={broadcastPlatform}
                      onChange={(e) => setBroadcastPlatform(e.target.value as any)}
                      className="w-full bg-[#0A0A0A] text-white py-3 px-4 rounded-xl border border-white/10 focus:outline-none focus:border-fuchsia-500 text-sm appearance-none outline-none"
                      disabled={broadcastDeploying}
                    >
                      <option value="both">Ambas (Facebook e Instagram)</option>
                      <option value="facebook">Solo Facebook (Feed)</option>
                      <option value="instagram">Solo Instagram (Feed)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Formato de Imagen</label>
                    <select 
                      value={broadcastImageFormat}
                      onChange={(e) => setBroadcastImageFormat(e.target.value as any)}
                      className="w-full bg-[#0A0A0A] text-white py-3 px-4 rounded-xl border border-white/10 focus:outline-none focus:border-fuchsia-500 text-sm appearance-none outline-none"
                      disabled={broadcastDeploying}
                    >
                      <option value="square">Cuadrado (1:1)</option>
                      <option value="portrait">Vertical (4:5)</option>
                      <option value="landscape">Horizontal (16:9)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                    <span>Seleccionar Destinos (Agentes con Social Media Desbloqueado)</span>
                    <button 
                      onClick={() => {
                        const valid = users.filter(u => u.socialMediaSettings?.isUnlocked).map(u => u.id);
                        if (broadcastSelectedUsers.length === valid.length) setBroadcastSelectedUsers([]);
                        else setBroadcastSelectedUsers(valid);
                      }}
                      className="text-fuchsia-400 hover:text-white transition-colors"
                      disabled={broadcastDeploying}
                    >
                      {broadcastSelectedUsers.length === users.filter(u => u.socialMediaSettings?.isUnlocked).length ? "Desmarcar Todos" : "Marcar Todos"}
                    </button>
                  </label>

                  <div className="mb-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input 
                        type="text"
                        placeholder="Buscar por nombre o correo en est listado..."
                        value={broadcastSearch}
                        onChange={(e) => setBroadcastSearch(e.target.value)}
                        className="w-full bg-[#0A0A0A] text-white/90 py-2 pl-9 pr-4 rounded-lg border border-white/[0.08] focus:outline-none focus:border-white/20 text-xs"
                        disabled={broadcastDeploying}
                      />
                    </div>
                  </div>

                  <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl max-h-48 overflow-y-auto p-2 custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {users.filter(u => u.socialMediaSettings?.isUnlocked).length === 0 ? (
                      <div className="col-span-full p-4 text-center text-gray-500 text-xs">No hay clientes con el módulo Social Media activo.</div>
                    ) : (
                       users.filter(u => u.socialMediaSettings?.isUnlocked)
                         .filter(u => u.name?.toLowerCase().includes(broadcastSearch.toLowerCase()) || u.email?.toLowerCase().includes(broadcastSearch.toLowerCase()))
                         .map(u => (
                         <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-white/5">
                           <input 
                             type="checkbox"
                             checked={broadcastSelectedUsers.includes(u.id)}
                             onChange={(e) => {
                               if (e.target.checked) setBroadcastSelectedUsers(prev => [...prev, u.id]);
                               else setBroadcastSelectedUsers(prev => prev.filter(id => id !== u.id));
                             }}
                             disabled={broadcastDeploying}
                             className="rounded border-none outline-none bg-black/50 w-4 h-4 checked:bg-fuchsia-500 appearance-none flex items-center justify-center after:content-['✓'] after:text-white after:text-[10px] after:opacity-0 checked:after:opacity-100 shrink-0"
                           />
                           <div className="flex flex-col overflow-hidden min-w-0">
                             <span className="text-xs text-white truncate max-w-full">{u.name}</span>
                             <span className="text-[10px] text-gray-500 truncate max-w-full">{u.email}</span>
                           </div>
                         </label>
                       ))
                    )}
                  </div>
                </div>

                  <button 
                    onClick={deployBroadcast}
                    disabled={broadcastDeploying || !broadcastTopic.trim() || broadcastSelectedUsers.length === 0}
                    className="mt-4 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 w-full sm:w-auto text-sm"
                  >
                    {broadcastDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                    {broadcastDeploying ? "Transmitiendo al Mundo..." : `Difundir a ${broadcastSelectedUsers.length} Agentes`}
                  </button>
              </div>

              {/* Logs de Despliegue Broadcast */}
              {broadcastProgress.logs.length > 0 && (
                <div className="mt-6 bg-[#0A0A0A] border border-white/5 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Panel de Emisión</span>
                    {broadcastProgress.total > 0 && (
                      <span className="text-xs font-bold text-fuchsia-400">{broadcastProgress.current} / {broadcastProgress.total} Destinos</span>
                    )}
                  </div>
                  
                  {broadcastProgress.total > 0 && (
                    <div className="w-full bg-white/5 h-2 rounded-full mb-4 overflow-hidden">
                      <div 
                        className="bg-fuchsia-500 h-full transition-all duration-500" 
                        style={{ width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto space-y-2 text-xs font-mono pr-2 custom-scrollbar">
                    {broadcastProgress.logs.map((log, idx) => (
                      <div key={idx} className={log.includes('✅') ? 'text-green-400' : log.includes('❌') ? 'text-red-400' : 'text-gray-400'}>
                        {log}
                      </div>
                    ))}
                  </div>
                  
                  {!broadcastDeploying && broadcastProgress.logs.some(l => l.includes('finalizada')) && (
                     <button onClick={() => { setBroadcastDeploying(false); setBroadcastProgress({total:0, current:0, logs:[]}); }} className="mt-4 text-xs font-bold text-gray-500 hover:text-white underline">
                       Cerrar y Limpiar
                     </button>
                  )}
                </div>
              )}
            </div>
         </div>
      </div>

      {/* Control de Logos Multiplataforma Globales */}
      <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg relative mt-6">
        <h2 className="text-lg font-semibold text-white/90 mb-1 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-400" />
          Logos de Plataformas (Globales)
        </h2>
        <p className="text-white/30 text-sm mb-6 max-w-2xl">
          Sube aquí los logos base sin fondo (.PNG) de altísima calidad. Estos logotipos serán inyectados mágicamente en el cerebro de la IA para cualquier agente que utilice estas plataformas. Al subirlos, sobrescribirán a los anteriores inmediatamente.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: "ecuabet", name: "Ecuabet", color: "text-[#FFDE00]" },
            { id: "doradobet", name: "DoradoBet", color: "text-[#F5A623]" },
            { id: "masparley", name: "MasParley", color: "text-[#e82f2f]" },
            { id: "databet", name: "DataBet", color: "text-[#1d4ed8]" },
            { id: "astrobet", name: "AstroBet", color: "text-[#4A8FE7]" },
          ].map((plat) => (
            <div key={plat.id} className="bg-[#0A0A0A] overflow-hidden border border-white/[0.05] p-3 rounded-xl flex items-center gap-4 hover:border-white/[0.1] transition-all group">
              
              {/* Miniatura del Logo */}
              <div className="relative w-16 h-16 shrink-0 bg-[#141414] border border-white/5 rounded-lg flex items-center justify-center p-2 shadow-inner">
                <img 
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-generations/agency-assets/default_${plat.id}.png?t=${imageTokens[plat.id] || 1}`} 
                  alt={plat.name}
                  className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity drop-shadow-md"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.1'; }}
                  onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                />
              </div>

              {/* Info y Botón Subir */}
              <div className="flex-1 min-w-0 pr-2">
                <span className={`block font-black ${plat.color} text-sm tracking-wide truncate mb-2`}>{plat.name}</span>
                
                <label className="cursor-pointer inline-flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/[0.08] rounded-md px-3 py-1.5 w-auto">
                  {uploadingPlatform === plat.id ? (
                    <Loader2 className="w-3 h-3 animate-spin text-white/50" />
                  ) : (
                    <>
                      <Upload className="w-3 h-3 text-white/40" />
                      <span className="text-[10px] text-white/60 font-black uppercase tracking-widest">Subir PNG</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/png, image/jpeg" 
                    onChange={(e) => handleUploadGlobalLogo(e, plat.id)}
                    disabled={uploadingPlatform !== null}
                  />
                </label>
              </div>

            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 pt-4 border-t border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white/90 whitespace-nowrap">
          Directorio
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto">
          {/* Selector de Plan */}
          <div className="flex bg-[#141414] border border-white/[0.06] p-1 rounded-lg w-full sm:w-auto overflow-x-auto min-w-max">
            {['ALL', 'VIP', 'FREE'].map((plan) => (
              <button
                key={plan}
                onClick={() => setPlanFilter(plan)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  planFilter === plan 
                    ? plan === 'VIP' ? 'bg-[#FFDE00] text-black shadow-[0_0_10px_rgba(255,222,0,0.3)]' : 'bg-white/20 text-white'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {plan === 'ALL' ? 'TODOS' : plan}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar oficial..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#141414] border border-white/[0.06] text-white/90 rounded-lg focus:outline-none focus:border-white/20 text-sm placeholder-white/20"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#FFDE00]" /></div>
      ) : (
        <div className="w-full space-y-3 pb-20">
          {filteredUsers.length === 0 && (
            <div className="text-center py-16 bg-[#141414] border border-white/[0.06] rounded-lg text-white/40 font-medium text-sm">
              No coinciden agentes con tu búsqueda.
            </div>
          )}
          
          {filteredUsers.map(u => (
            <div key={u.id} className="w-full relative bg-[#141414] border border-white/[0.06] rounded-xl overflow-hidden transition-all hover:border-white/20">
              
              {/* Cabecera (Clickable) */}
              <button 
                onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                className="w-full p-4 flex items-center justify-between text-left focus:outline-none"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                    <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name || 'U'}&background=random`} alt="A" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 pr-4">
                    <div className="font-bold text-white text-base truncate flex items-center gap-2">
                      {u.name}
                      {u.plan === 'VIP' && (
                        <span className="shrink-0 text-[9px] font-black tracking-widest bg-[#FFDE00]/10 text-[#FFDE00] px-2 py-0.5 rounded border border-[#FFDE00]/20">VIP</span>
                      )}
                      {u.plan === 'FREE' && (
                        <span className="shrink-0 text-[9px] font-bold bg-white/[0.06] text-white/40 px-2 py-0.5 rounded">FREE</span>
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate mt-1">{u.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 pointer-events-none">
                  {/* Estadísticas Visibles en Colapsado */}
                  {expandedUserId !== u.id && (u.generationCount || 0) > 0 && (
                    <div className="hidden sm:block text-[11px] font-bold text-purple-400">
                      🎨 {u.generationCount}
                    </div>
                  )}
                  
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:text-white transition-colors">
                    {expandedUserId === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Contenido Expandible */}
              {expandedUserId === u.id && (
                <div className="p-5 border-t border-white/[0.06] bg-[#0A0A0A] space-y-6">
                  
                  {/* Fila Múltiple: Info Extra y Opciones */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Generaciones & Tiempo VIP */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                      <div className="text-[11px] text-white/40 font-medium bg-white/[0.04] px-3 py-1.5 rounded-md whitespace-nowrap">
                        🖼️ {u.generationCount || 0} obras generadas
                      </div>
                      {(u.generationCount || 0) > 0 && (
                        <button
                          onClick={() => openGallery(u)}
                          className="bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold transition-colors border border-purple-500/20 whitespace-nowrap"
                        >
                          Ver Obras
                        </button>
                      )}
                      
                      <button
                        onClick={() => setModalViewingLogs(u)}
                        className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold transition-colors border border-cyan-500/20 whitespace-nowrap flex items-center gap-1.5"
                      >
                        Ver Movimientos
                      </button>
                      
                      {u.plan === 'VIP' && u.vipExpiresAt && (
                        <div className="bg-[#FFDE00]/5 border border-[#FFDE00]/10 px-3 py-1.5 rounded-md flex flex-wrap items-center gap-2">
                           <span className="text-[10px] text-[#FFDE00]/60 uppercase tracking-widest font-bold">RESTAN:</span>
                           <div className="scale-90 origin-left -my-1">
                             <VipCountdown expiresAt={u.vipExpiresAt} />
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Cambiar Rol */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                       <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium whitespace-nowrap">Gestionar Plan:</span>
                       <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         {u.plan === 'VIP' && (
                           <button 
                             onClick={() => renewVip(u.id, u.vipExpiresAt)}
                             disabled={processingId === u.id}
                             className="w-full sm:w-auto px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white"
                           >
                             {processingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'RENOVAR VIP (+30 DÍAS)'}
                           </button>
                         )}
                         <button 
                           onClick={() => togglePlan(u.id, u.plan)}
                           disabled={processingId === u.id}
                           className={`w-full sm:w-auto px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 min-w-[120px] ${u.plan === 'VIP' ? 'bg-[#FFDE00]/10 text-[#FFDE00] border border-[#FFDE00]/20 hover:bg-[#FFDE00]/20' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}
                         >
                           {processingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (u.plan === 'VIP' ? 'REVOCAR A FREE' : 'ASCENDER A VIP')}
                         </button>
                       </div>
                    </div>
                  </div>

                  {/* Economía de Créditos */}
                  <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <div className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-2">Billetera de Créditos</div>
                      <div className="flex items-center gap-3">
                         <Coins className="w-6 h-6 text-[#FFDE00]" />
                         {u.credits === undefined ? (
                           <span className="text-sm font-semibold text-white/30 italic drop-shadow-md">Aún sin Billetera</span>
                         ) : (
                           <span className="text-2xl font-black text-white tracking-tight">{u.credits.toLocaleString()}</span>
                         )}
                      </div>
                    </div>

                    <div className="flex items-center bg-[#0A0A0A] rounded-xl border border-white/[0.06] overflow-hidden focus-within:border-[#FFDE00]/30 transition-colors max-w-full sm:max-w-xs w-full">
                       <input 
                         type="number"
                         value={customCreditInput[u.id] || ''}
                         onChange={(e) => setCustomCreditInput(prev => ({ ...prev, [u.id]: e.target.value }))}
                         placeholder="Ej: 500 o -200"
                         className="flex-1 min-w-0 bg-transparent text-white/90 placeholder-white/30 px-4 py-3 text-sm focus:outline-none"
                       />
                       <button 
                         onClick={() => {
                           const amount = Number(customCreditInput[u.id]);
                           if(!isNaN(amount) && amount !== 0) modifyCredits(u.id, u.credits, amount);
                         }}
                         disabled={processingId === u.id || !customCreditInput[u.id] || isNaN(Number(customCreditInput[u.id])) || Number(customCreditInput[u.id]) === 0}
                         className="px-4 py-3 bg-white/[0.04] text-[#FFDE00] text-[11px] font-black uppercase hover:bg-[#FFDE00]/10 transition-all disabled:opacity-50 border-l border-white/[0.06] flex items-center justify-center shrink-0"
                       >
                         {processingId === u.id ? <Loader2 className="w-4 h-4 animate-spin text-[#FFDE00]" /> : 'APLICAR'}
                       </button>
                    </div>
                  </div>

                  {/* Módulos Extra (WhatsApp & Social) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* WhatsApp Bot */}
                    <div className="flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-[#0A0A0A] border border-[#25D366]/20 p-5 rounded-xl shadow-inner relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-[#25D366]/10 blur-3xl -mr-10 -mt-10 rounded-full blur-2xl"></div>
                       <div className="z-10 text-[12px] text-white/80 font-black uppercase tracking-widest flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-[#25D366]" /> MÓDULO WHATSAPP
                       </div>
                       <button
                         onClick={() => setEditingWa(u)}
                         className={`z-10 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${u.whatsappSettings?.isUnlocked ? 'bg-[#25D366] text-black shadow-[0_0_15px_rgba(37,211,102,0.4)]' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10 hover:border-white/20'}`}
                       >
                         {u.whatsappSettings?.isUnlocked ? '⚙️ GESTIONAR' : 'VENDER ACCESO'}
                       </button>
                    </div>

                    {/* Social Media */}
                    <div className="flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-[#0A0A0A] border border-blue-500/20 p-5 rounded-xl shadow-inner relative overflow-hidden">
                       <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-10 -mb-10 rounded-full blur-2xl"></div>
                       <div className="z-10 text-[12px] text-white/80 font-black uppercase tracking-widest flex items-center gap-2">
                          <Share2 className="w-5 h-5 text-blue-400" /> SOCIAL MEDIA
                       </div>
                       <button
                         onClick={() => setEditingSocial(u)}
                         className={`z-10 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${u.socialMediaSettings?.isUnlocked ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10 hover:border-white/20'}`}
                       >
                         {u.socialMediaSettings?.isUnlocked ? '⚙️ GESTIONAR' : 'VENDER ACCESO'}
                       </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          ))}
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

      {/* MODAL GALERÍA SECRETA VISUALIZADOR */}
      {galleryUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setGalleryUser(null)}>
           <div className="bg-[#111111] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-5xl w-full relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <button onClick={() => setGalleryUser(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors z-50">
                <Minus className="w-5 h-5 rotate-45" />
              </button>
              
              <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                 <img src={galleryUser.avatar || "https://ui-avatars.com/api/?name=U"} alt="A" className="w-10 h-10 rounded-full" />
                 <div>
                   <h3 className="text-lg font-black text-white">Galería de {galleryUser.name}</h3>
                   <p className="text-xs text-gray-500">{galleryUser.email}</p>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                {loadingGallery ? (
                  <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>
                ) : galleryImages.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 font-medium border border-white/5 bg-[#1A1A1A] rounded-2xl mx-auto w-1/2">
                     Este agente no ha generado imágenes.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {galleryImages.map(img => (
                      <div key={img.id} className="bg-black border border-white/5 rounded-xl overflow-hidden group">
                        <img 
                           src={img.image_url} 
                           onClick={() => setLightboxAdminUrl(img.image_url)}
                           className="w-full h-auto aspect-square object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                           alt="Gen" 
                        />
                        <div className="p-3 text-[10px] text-gray-400 italic line-clamp-3 leading-tight border-t border-white/5">
                           "{img.prompt}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* MODAL LIGHTBOX (PANTALLA COMPLETA ADMIN) */}
      {lightboxAdminUrl && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxAdminUrl(null)}
        >
          <button
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors z-[70]"
            onClick={() => setLightboxAdminUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxAdminUrl}
            alt="Vista completa"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* MODAL CONFIGURACIÓN SOCIAL MEDIA */}
      {editingSocial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
           <div className="bg-[#111111] border border-white/10 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full relative my-8">
              <button onClick={() => setEditingSocial(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
              
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg mb-4">
                 <Share2 className="w-6 h-6 text-white" />
              </div>
              
              <h3 className="text-xl font-black text-white mb-2">Social IA para {editingSocial.name}</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Tú eres administrador supremo. Ingresa aquí los tokens de la página de Facebook de tu cliente. Este flujo ignora completamente la burocracia de verificación de Meta.
              </p>

              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl mb-6">
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-bold text-blue-400 hover:text-blue-300 underline">
                  ✨ Abrir Arreglador (Graph API Explorer)
                </a>
              </div>

              <form onSubmit={saveSocialSettings} className="space-y-4">
                 <label className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-blue-500"
                      checked={socialForm.isUnlocked}
                      onChange={e => setSocialForm({ ...socialForm, isUnlocked: e.target.checked })}
                    />
                    <span className={`text-sm font-bold ${socialForm.isUnlocked ? 'text-blue-400' : 'text-gray-400'}`}>
                      {socialForm.isUnlocked ? 'MÓDULO DESBLOQUEADO ✓' : 'DESBLOQUEAR ESTE MÓDULO AL CLIENTE'}
                    </span>
                 </label>

                 {socialForm.isUnlocked && (
                   <div className="space-y-4 bg-[#0A0A0A] p-4 rounded-xl border border-blue-500/20">
                     
                     <div>
                       <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Page ID</label>
                       <input 
                         type="text"
                         className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                         placeholder="Ej: 1234567890123"
                         value={socialForm.meta_page_id}
                         onChange={e => setSocialForm({ ...socialForm, meta_page_id: e.target.value })}
                       />
                     </div>

                     <div>
                       <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Page Access Token</label>
                       <input 
                         type="password"
                         className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                         placeholder="EAAxxxxxx..."
                         value={socialForm.meta_page_access_token}
                         onChange={e => setSocialForm({ ...socialForm, meta_page_access_token: e.target.value })}
                       />
                     </div>
                     
                     <div>
                       <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Instagram User ID (Opcional)</label>
                       <input 
                         type="text"
                         className="w-full bg-[#1A1A1A] text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                         placeholder="Ej: 17841400000000000"
                         value={socialForm.meta_ig_user_id}
                         onChange={e => setSocialForm({ ...socialForm, meta_ig_user_id: e.target.value })}
                       />
                     </div>

                     <div className="pt-4 border-t border-blue-500/20 mt-2">
                       <label className="flex items-center gap-3 bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 accent-blue-400"
                            checked={socialForm.auto_generate}
                            onChange={e => setSocialForm({ ...socialForm, auto_generate: e.target.checked })}
                          />
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${socialForm.auto_generate ? 'text-blue-400' : 'text-gray-400'}`}>
                              {socialForm.auto_generate ? 'BOT PILOTO AUTOMÁTICO (ACTIVADO)' : 'ACTIVAR BOT PILOTO AUTOMÁTICO'}
                            </span>
                            <span className="text-[10px] text-gray-500 max-w-xs leading-tight mt-1">Generará máx. 3 posts al día en horarios aleatorios. Usa las plantillas de la config del cliente.</span>
                          </div>
                       </label>
                     </div>

                   </div>
                 )}

                 <button 
                   type="submit"
                   disabled={processingId === editingSocial.id}
                   className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                 >
                   {processingId === editingSocial.id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'GUARDAR CONFIGURACIÓN META'}
                 </button>
              </form>
           </div>
        </div>
      )}
      {/* MODAL: Activity Logs (Movimientos del Usuario) */}
      {modalViewingLogs && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0A0A0A] z-10 shrink-0">
              <div>
                <h3 className="font-black text-white text-lg flex items-center gap-2">
                  <span className="text-cyan-400">📋</span> Registro de Movimientos
                </h3>
                <p className="text-xs text-white/40 mt-0.5">Actividad administrativa de {modalViewingLogs.name}</p>
              </div>
              <button 
                onClick={() => setModalViewingLogs(null)}
                className="text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {(!modalViewingLogs.activityLogs || modalViewingLogs.activityLogs.length === 0) ? (
                <div className="text-center text-white/30 text-sm py-10 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  Aún no hay movimientos registrados para este usuario.
                </div>
              ) : (
                modalViewingLogs.activityLogs.map((log: any, idx: number) => (
                  <div key={idx} className="bg-[#141414] border border-white/[0.04] p-3 rounded-xl flex items-start gap-3">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center text-[14px] ${
                      log.type === 'CREDITS' ? 'bg-[#FFDE00]/10 text-[#FFDE00] border border-[#FFDE00]/20' : 
                      log.type === 'VIP' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {log.type === 'CREDITS' ? '🪙' : log.type === 'VIP' ? '💎' : '⭐'}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-semibold text-white/90 leading-snug">{log.details}</p>
                       <span className="text-[10px] text-white/30 uppercase tracking-widest font-medium block mt-1">
                         {new Date(log.timestamp).toLocaleString('es-ES', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                       </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
