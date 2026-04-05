"use client";

import { useState } from "react";
import { Coins, Zap, ShieldCheck, ChevronRight, Check, PlayCircle, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function TiendaPage() {
  const { user } = useUser();
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const packages = [
    {
      id: "basic",
      credits: 1000,
      price: 1,
      name: "Básico",
      features: ["Ideal para probar el generador", "Soporte estándar por correo"],
      cardClass: "bg-[#0A0A0A] border border-white/5 hover:border-white/15 hover:shadow-2xl hover:-translate-y-2",
      textColor: "text-white",
      buttonClass: "bg-white/5 text-white hover:bg-white/15 border border-white/10",
      iconColor: "text-[#FFDE00] drop-shadow-[0_0_5px_rgba(255,222,0,0.2)]",
      iconBg: "bg-black",
    },
    {
      id: "standard",
      credits: 4000,
      price: 3,
      name: "Estándar",
      features: ["Mejor rendimiento", "Acceso prioritario a servidores"],
      cardClass: "bg-[#111111] border border-white/10 hover:border-[#FFDE00]/40 hover:shadow-[0_0_25px_rgba(255,222,0,0.1)] hover:-translate-y-2 relative overflow-hidden",
      textColor: "text-white",
      buttonClass: "bg-white/10 text-white hover:bg-[#FFDE00] hover:text-black border border-transparent",
      iconColor: "text-[#FFDE00] drop-shadow-[0_0_8px_rgba(255,222,0,0.4)]",
      iconBg: "bg-[#1A1A1A] border border-white/5",
    },
    {
      id: "master",
      credits: 10000,
      price: 6,
      name: "Master (+ Bono)",
      features: ["Generación masiva garantizada", "Atención inmediata", "Bono extra adherido"],
      cardClass: "bg-gradient-to-br from-[#FFDE00] via-[#E5C700] to-[#FFDE00] border-2 border-[#FFC107] shadow-[0_0_40px_rgba(255,222,0,0.3)] ring-4 ring-[#FFDE00]/10 lg:-translate-y-4 lg:scale-105 z-10",
      textColor: "text-black",
      buttonClass: "bg-black text-[#FFDE00] hover:bg-[#121212] hover:shadow-[0_0_25px_rgba(0,0,0,0.5)] border border-transparent",
      iconColor: "text-black drop-shadow-md",
      iconBg: "bg-black/10",
      badge: "🎁 MÁS VENDIDO",
      popular: true,
    },
    {
      id: "vip_plan",
      price: 10,
      name: "Plan VIP",
      features: ["Acceso Inmediato a todos los módulos", "Generador y Herramientas ilimitadas", "Soporte Analítico y Prioritario 24/7"],
      isVip: true,
    },
    {
      id: "custom_video_ai",
      priceInCredits: 2000,
      name: "Video Personalizado con IA",
      description: "Creamos para ti un video hiperrealista según tus lineamientos. Se debitará de tus créditos. El proceso puede tomar hasta 24 horas.",
      features: ["Envíanos tu idea o guion", "Usa tu agencia, imágenes y referencias", "Animación hiperrealista máxima calidad", "Entrega garantizada < 24 horas"],
      cardClass: "bg-[#0b0b0b] border border-white/10 hover:border-[#FFDE00]/50 hover:shadow-[0_0_30px_rgba(255,222,0,0.1)] relative overflow-hidden group hover:-translate-y-2",
      textColor: "text-white",
      buttonClass: "bg-[#FFDE00] text-black font-black hover:bg-white hover:scale-[1.02] active:scale-95 transition-all text-lg",
      iconColor: "text-[#FFDE00] drop-shadow-[0_0_10px_rgba(255,222,0,0.4)]",
      iconBg: "bg-white/5 border border-white/10",
      badge: "🎬 NUEVO SERVICIO IA",
      isService: true,
    }
  ];

  const handleBuy = async () => {
    if (!selectedPackage || !user) return;
    setProcessing(true);
    
    try {
      let message = "";
      
      if (selectedPackage.isService) {
        message = `🎬 ¡Hola equipo! Quiero solicitar la creación de un *${selectedPackage.name}* utilizando mis créditos (${selectedPackage.priceInCredits.toLocaleString()} créditos). Espero indicaciones y envío detalles.`;
      } else if (selectedPackage.isVip) {
        message = `👋 Hola administrador, confirmo mi intención de comprar el *${selectedPackage.name}* por *$${selectedPackage.price} USD*. ¿A dónde transfiero?`;
      } else {
        message = `👋 Hola administrador, confirmo mi intención de recargar *${selectedPackage.credits.toLocaleString()} Créditos* del Paquete ${selectedPackage.name} por *$${selectedPackage.price} USD*. ¿A dónde transfiero?`;
      }
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: message, 
          receiver_email: "andryzamora0825@gmail.com" 
        })
      });

      if (res.ok) {
        router.push("/dashboard/chat");
      } else {
        alert("Ocurrió un error al contactar al soporte.");
      }
    } catch(err) {
      alert("Error de red.");
    } finally {
      setProcessing(false);
    }
  };

  const vipPackage = packages.find(p => p.isVip);
  const creditPackages = packages.filter(p => !p.isVip && !p.isService);
  const servicePackages = packages.filter(p => p.isService);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-12">
      
      {/* Encabezado */}
      <div className="text-center space-y-5 pt-10 pb-4 relative">
        <div className="absolute top-0 inset-x-0 mx-auto w-72 h-72 bg-[#FFDE00]/10 rounded-full blur-[140px] -z-10 animate-pulse duration-1000"></div>
        <h1 className="text-5xl sm:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-500 tracking-tighter drop-shadow-lg">
          La Tienda <span className="text-[#FFDE00]">Premium</span>
        </h1>
        <p className="text-gray-400 max-w-3xl mx-auto text-lg sm:text-2xl font-medium tracking-tight">
          Elige entre el acceso <strong className="text-white">VIP Ilimitado</strong> o adquiere <strong className="text-white">paquetes de créditos</strong> para potenciar tus generaciones con IA de forma inmediata.
        </p>
      </div>

      {/* ─── BANNER VIP (Destacado Principal) ─── */}
      {vipPackage && (
        <div className="relative w-full rounded-[2.5rem] bg-[#0a0a09] border border-[#FFDE00]/30 shadow-[0_0_50px_rgba(255,222,0,0.1)] hover:shadow-[0_0_80px_rgba(255,222,0,0.15)] hover:border-[#FFDE00]/60 transition-all duration-700 overflow-hidden mb-20 group">
          {/* Fondos y Efectos del VIP */}
          <div className="absolute -top-32 -right-32 w-[30rem] h-[30rem] bg-[#FFDE00]/15 blur-[120px] rounded-full group-hover:bg-[#FFDE00]/25 transition-all duration-700 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FFDE00] to-transparent opacity-50"></div>
          
          <div className="flex flex-col lg:flex-row items-center gap-8 p-8 lg:p-14 relative z-10">
            
            {/* Icono VIP Gigante */}
            <div className="shrink-0 relative">
              <div className="absolute inset-0 bg-[#FFDE00]/30 blur-3xl rounded-full animate-pulse duration-1000"></div>
              <div className="bg-[#121212]/80 border border-[#FFDE00]/40 p-8 rounded-full relative backdrop-blur-md shadow-[0_0_30px_rgba(255,222,0,0.2)]">
                <ShieldCheck className="w-16 h-16 sm:w-20 sm:h-20 text-[#FFDE00] drop-shadow-[0_0_15px_rgba(255,222,0,0.8)]" />
              </div>
            </div>
            
            {/* Información VIP */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#FFDE00]/10 border border-[#FFDE00]/30 text-[#FFDE00] text-xs font-black uppercase tracking-widest rounded-full mb-5 shadow-[0_0_10px_rgba(255,222,0,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFDE00] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFDE00]"></span>
                </span>
                Suscripción Premium
              </div>
              <h2 className="text-5xl lg:text-6xl font-black text-white tracking-tighter mb-4 group-hover:text-[#FFDE00] transition-colors drop-shadow-md">
                {vipPackage.name}
              </h2>
              <p className="text-gray-400 text-lg lg:text-xl mb-8 max-w-2xl leading-relaxed">
                Desbloquea el máximo potencial de Zamtools. Sin límites de créditos, sin restricciones, y con atención VIP directa para todos tus proyectos de diseño y escritura.
              </p>
              
              {/* Características en Píldoras */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-6 lg:mb-0">
                {vipPackage.features.map((f, i) => (
                   <div key={i} className="flex items-center gap-2.5 text-sm bg-white/5 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-[#FFDE00]/10 hover:border-[#FFDE00]/30 transition-colors">
                      <Check className="w-4 h-4 text-[#FFDE00]" />
                      <span className="text-gray-200 font-bold">{f}</span>
                   </div>
                ))}
              </div>
            </div>
            
            {/* Pricing Section (Right Side) */}
            <div className="shrink-0 w-full lg:w-auto bg-[#050505]/60 p-8 lg:p-10 rounded-[2rem] border border-white/10 text-center flex flex-col items-center justify-center backdrop-blur-md shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFDE00]/10 blur-[50px] -z-10 rounded-full"></div>
              
              <div className="text-gray-400 font-black uppercase tracking-widest text-xs mb-3">Suscripción Mensual</div>
              <div className="flex items-start gap-1 text-[#FFDE00] mb-8">
                <span className="text-4xl font-bold mt-2 opacity-90">$</span>
                <span className="text-8xl font-black tracking-tighter drop-shadow-[0_0_20px_rgba(255,222,0,0.5)]">{vipPackage.price}</span>
                <span className="text-xl font-bold mt-auto mb-3 opacity-80">USD</span>
              </div>
              <button 
                onClick={() => setSelectedPackage(vipPackage)}
                className="w-full bg-[#FFDE00] text-black font-black text-xl py-5 px-10 rounded-2xl hover:bg-white hover:text-black hover:scale-105 hover:shadow-[0_0_40px_rgba(255,222,0,0.6)] transition-all duration-300 active:scale-95 flex items-center justify-center gap-3"
              >
                Obtener VIP <ChevronRight className="w-6 h-6" />
              </button>
              <div className="text-gray-500 text-xs mt-4 font-medium">Activación inmediata tras confirmación</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SEPARADOR / HEADER RECARGAS ─── */}
      <div className="text-center mb-12 pt-10 border-t border-white/5 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <h2 className="text-4xl font-black text-white tracking-tight">Recargas de <span className="text-gray-400">Créditos</span></h2>
        <p className="text-gray-500 mt-3 text-lg font-medium">Ideales para usuarios que necesitan ráfagas de uso específicas. Los créditos no expiran.</p>
      </div>

      {/* ─── GRID DE 3 COLUMNAS PARA CRÉDITOS ─── */}
      <div className="grid md:grid-cols-3 gap-6 lg:gap-10 items-stretch pb-16">
        {creditPackages.map((pkg, idx) => (
          <div 
            key={pkg.id} 
            className={`relative rounded-[2rem] p-8 lg:p-10 transition-all duration-500 flex flex-col justify-between ${pkg.cardClass} group`}
            style={{ animationDelay: `${idx * 150}ms` }}
          >
            <div>
              {pkg.badge && (
                <div className={`absolute -top-5 inset-x-0 mx-auto w-max px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl ${
                  pkg.popular 
                    ? 'bg-black text-[#FFDE00] border-2 border-[#FFDE00]/40 drop-shadow-[0_0_10px_rgba(255,222,0,0.6)]'
                    : 'bg-[#FFDE00] text-black drop-shadow-[0_0_10px_rgba(255,222,0,0.6)]'
                }`}>
                  {pkg.badge}
                </div>
              )}
              
              <h3 className={`text-3xl font-extrabold mb-6 ${pkg.textColor} tracking-tight`}>{pkg.name}</h3>
              
              <div className={`flex items-start gap-1 pb-6 mb-8 border-b ${pkg.popular ? 'border-black/10' : 'border-white/10'} ${pkg.textColor}`}>
                <span className="text-3xl font-bold mt-1.5 opacity-90">$</span>
                <span className={`text-7xl font-black ${pkg.popular ? 'drop-shadow-sm' : 'text-shadow-sm'} tracking-tighter`}>{pkg.price}</span>
                <span className="text-lg font-bold mt-auto mb-2 opacity-70">USD</span>
              </div>

              <div className={`flex items-center gap-4 mb-10 ${pkg.iconBg} p-5 rounded-2xl transition-colors ${pkg.popular ? 'group-hover:bg-black/20' : 'group-hover:bg-white/5'}`}>
                <Coins className={`w-10 h-10 ${pkg.iconColor}`} />
                <div>
                  <div className={`text-sm font-bold opacity-60 uppercase tracking-wider mb-1 ${pkg.popular ? 'text-black' : 'text-gray-400'}`}>Recibes</div>
                  <div className={`text-4xl font-black ${pkg.popular ? 'text-black drop-shadow-sm' : 'text-white'} tracking-tight leading-none`}>
                    {pkg.credits?.toLocaleString()}
                  </div>
                </div>
              </div>

              <ul className="space-y-4 mb-12">
                {pkg.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm group/item">
                    <div className={`p-1.5 rounded-full transition-transform group-hover/item:scale-110 ${pkg.popular ? 'bg-black/15 text-black' : 'bg-white/10 text-[#FFDE00]'}`}>
                      <Check className="w-4 h-4" />
                    </div>
                    <span className={`font-semibold text-base ${pkg.popular ? 'text-black/90' : 'text-gray-300'}`}>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button 
              onClick={() => setSelectedPackage(pkg)}
              className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 ${pkg.buttonClass}`}
            >
              Seleccionar Paquete <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* ─── SECCIÓN: SERVICIOS CON IA ─── */}
      {servicePackages.length > 0 && (
        <div className="pt-4 mb-20">
          <div className="text-center mb-10 pt-10 border-t border-white/5 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#FFDE00]/30 to-transparent"></div>
            <h2 className="text-4xl font-black text-white tracking-tight">Servicios con <span className="text-[#FFDE00]">IA</span></h2>
            <p className="text-gray-500 mt-3 text-lg font-medium">Contrata servicios personalizados pagando directamente con tus créditos.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8 items-stretch pt-2 max-w-4xl mx-auto">
            {servicePackages.map((pkg, idx) => (
              <div 
                key={pkg.id} 
                className={`relative rounded-[2rem] p-8 lg:p-10 transition-all duration-500 flex flex-col justify-between ${pkg.cardClass} group`}
              >
                <div>
                  {pkg.badge && (
                    <div className="absolute -top-5 inset-x-0 mx-auto w-max px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl bg-[#FFDE00] text-black drop-shadow-[0_0_10px_rgba(255,222,0,0.6)]">
                      {pkg.badge}
                    </div>
                  )}
                  
                  <h3 className={`text-3xl font-extrabold mb-4 ${pkg.textColor} tracking-tight`}>{pkg.name}</h3>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">{pkg.description}</p>
                  
                  <div className={`flex items-start gap-1 pb-6 mb-8 border-b border-white/10 ${pkg.textColor}`}>
                    <span className="text-5xl font-black text-shadow-sm tracking-tighter">{pkg.priceInCredits?.toLocaleString() || 0}</span>
                    <span className="text-lg font-bold mt-auto mb-1 opacity-70">Créditos</span>
                  </div>

                  <ul className="space-y-4 mb-10">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm group/item">
                        <div className="p-1.5 rounded-full transition-transform group-hover/item:scale-110 bg-white/10 text-[#FFDE00]">
                          <Check className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-base text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => setSelectedPackage(pkg)}
                    className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 ${pkg.buttonClass}`}
                  >
                    Solicitar Servicio <ChevronRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowVideoModal(true)} className="text-[#FFDE00] font-semibold underline text-sm hover:text-white transition-colors py-2 text-center flex items-center justify-center gap-2">
                     <PlayCircle className="w-4 h-4" /> Ver Ejemplos de Videos
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal / Confirmación */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#0b0b0b] border border-white/10 rounded-[2.5rem] p-8 lg:p-10 max-w-lg w-full shadow-[0_0_80px_rgba(0,0,0,0.9)] relative animate-in fade-in zoom-in duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFDE00]/5 blur-[80px] rounded-full pointer-events-none"></div>
            
            <div className="w-20 h-20 bg-[#FFDE00]/10 rounded-full flex items-center justify-center mb-8 mx-auto border border-[#FFDE00]/30 shadow-[0_0_30px_rgba(255,222,0,0.2)]">
              {selectedPackage.isVip ? (
                <ShieldCheck className="w-10 h-10 text-[#FFDE00]" />
              ) : (
                <Coins className="w-10 h-10 text-[#FFDE00]" />
              )}
            </div>
            
            <h2 className="text-3xl font-black text-center text-white mb-3 tracking-tight">Confirma tu elección</h2>
            <p className="text-center text-gray-400 mb-8 max-w-sm mx-auto text-lg leading-relaxed">
              Estás a punto de solicitar <strong className="text-white bg-white/10 px-2 py-0.5 rounded-md">{selectedPackage.name}</strong> por <strong className="text-[#FFDE00]">{selectedPackage.isService ? `${selectedPackage.priceInCredits} Créditos` : `$${selectedPackage.price} USD`}</strong>. 
            </p>
            
            <div className="bg-black/60 border border-white/5 p-6 rounded-2xl mb-10 flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#FFDE00]/50 to-transparent"></div>
               <span className="font-bold text-gray-500 uppercase tracking-widest text-xs mb-3">Vas a recibir</span>
               <div className="flex items-center gap-2 font-black text-3xl text-white">
                 {selectedPackage.isService ? (
                   <>
                     <PlayCircle className="w-8 h-8 text-[#FFDE00]" />
                     Video Personalizado
                   </>
                 ) : selectedPackage.isVip ? (
                   <>
                     <ShieldCheck className="w-8 h-8 text-[#FFDE00]" />
                     Premium VIP (1 Mes)
                   </>
                 ) : (
                   <>
                     <Coins className="w-8 h-8 text-[#FFDE00]" />
                     {selectedPackage.credits?.toLocaleString()} Créditos
                   </>
                 )}
               </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <button 
                onClick={() => setSelectedPackage(null)}
                className="flex-1 py-4 px-4 rounded-xl font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBuy}
                disabled={processing}
                className="flex-1 py-4 px-4 rounded-xl font-black text-black bg-[#FFDE00] hover:bg-white hover:shadow-[0_0_25px_rgba(255,222,0,0.5)] disabled:opacity-50 disabled:hover:bg-[#FFDE00] transition-all flex items-center justify-center gap-2 text-lg"
              >
                {processing ? 'Procesando...' : 'Proceder al Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Examples Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#0b0b0b] border border-white/10 rounded-[2.5rem] p-8 max-w-4xl w-full shadow-[0_0_80px_rgba(0,0,0,0.9)] relative animate-in zoom-in duration-300">
            <button onClick={() => setShowVideoModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white bg-white/5 p-2 rounded-full hover:bg-white/10 transition">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-3xl font-black text-white mb-6">Ejemplos de Videos IA</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="aspect-video bg-[#1a1a1a] rounded-2xl flex flex-col items-center justify-center border border-white/5 relative group cursor-pointer hover:border-[#FFDE00]/50 transition-colors overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 flex flex-col justify-end p-6">
                   <PlayCircle className="w-12 h-12 text-[#FFDE00] mb-2 drop-shadow-lg group-hover:scale-110 transition-transform" />
                   <span className="text-white font-bold text-lg">Avatar Comercial (Estilo Realista)</span>
                </div>
                <img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt="Placeholder Ej" />
              </div>
              <div className="aspect-video bg-[#1a1a1a] rounded-2xl flex flex-col items-center justify-center border border-white/5 relative group cursor-pointer hover:border-[#FFDE00]/50 transition-colors overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 flex flex-col justify-end p-6">
                   <PlayCircle className="w-12 h-12 text-[#FFDE00] mb-2 drop-shadow-lg group-hover:scale-110 transition-transform" />
                   <span className="text-white font-bold text-lg">Video Promocional Agencia</span>
                </div>
                <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt="Placeholder Ej 2" />
              </div>
            </div>
            <p className="text-gray-400 text-center mt-8 text-sm">
              Estos videos son muestras visuales del acabado final hiperrealista. El resultado de tu video dependerá enteramente de tus instrucciones y referencias. ¡Trabajamos con máxima fidelidad!
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
