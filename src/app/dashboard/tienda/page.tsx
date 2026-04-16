"use client";

import { useState, useEffect } from "react";
import { Coins, Zap, ShieldCheck, ChevronRight, Check, PlayCircle, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function TiendaPage() {
  const { user } = useUser();
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [hasWhatsappBot, setHasWhatsappBot] = useState(false);
  const [banksInfo, setBanksInfo] = useState<string>("");

  useEffect(() => {
    fetch("/api/user/sync")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsVip(data.plan === 'VIP');
          setHasWhatsappBot(data.hasWhatsappBot || false);
        }
      })
      .catch(console.error);

    fetch("/api/admin/payment-methods")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.banksInfo) setBanksInfo(data.banksInfo);
      })
      .catch(console.error);
  }, []);

  const packages = [
    {
      id: "basic",
      credits: 1000,
      price: 1,
      name: "Básico",
      features: ["Ideal para probar el generador", "Soporte estándar"],
      cardClass: "bg-[#141414] border border-white/[0.06] hover:border-white/[0.12]",
      textColor: "text-white",
      buttonClass: "bg-white/[0.05] text-white/70 hover:bg-white/[0.08] border border-white/[0.06]",
      iconColor: "text-[#FFDE00]",
      iconBg: "bg-[#050505]",
    },
    {
      id: "standard",
      credits: 4000,
      price: 3,
      name: "Estándar",
      features: ["Mejor rendimiento", "Acceso prioritario"],
      cardClass: "bg-[#141414] border border-white/[0.06] hover:border-[#FFDE00]/20",
      textColor: "text-white",
      buttonClass: "bg-white/[0.06] text-white/70 hover:bg-[#FFDE00] hover:text-black border border-transparent",
      iconColor: "text-[#FFDE00]",
      iconBg: "bg-[#050505] border border-white/[0.07]",
    },
    {
      id: "master",
      credits: 10000,
      price: 6,
      name: "Master",
      features: ["Generación masiva", "Atención inmediata", "Bono extra"],
      cardClass: "bg-[#FFDE00] border-2 border-[#FFDE00] lg:scale-[1.03] z-10",
      textColor: "text-black",
      buttonClass: "bg-black text-[#FFDE00] hover:bg-zinc-900 border border-transparent",
      iconColor: "text-black",
      iconBg: "bg-black/10",
      badge: "Más Vendido",
      popular: true,
    },
    {
      id: "vip_plan",
      price: 10,
      name: "Plan VIP",
      features: ["Acceso a todos los módulos", "Herramientas ilimitadas", "Soporte Prioritario 24/7"],
      isVip: true,
    },
    {
      id: "custom_video_ai",
      priceInCredits: 2000,
      name: "Video IA Personalizado",
      description: "Video hiperrealista según tus lineamientos. Débito de créditos. Entrega en 24h.",
      features: ["Envía tu idea o guion", "Usa tu agencia e imágenes", "Animación máxima calidad", "Entrega < 24 horas"],
      cardClass: "bg-[#141414] border border-white/[0.06] hover:border-[#FFDE00]/20 relative overflow-hidden group",
      textColor: "text-white",
      buttonClass: "bg-[#FFDE00] text-black font-semibold hover:brightness-110 active:scale-[0.98] transition-all",
      iconColor: "text-[#FFDE00]",
      iconBg: "bg-white/[0.04] border border-white/[0.07]",
      badge: "Servicio IA",
      isService: true,
    },
    {
      id: "whatsapp_bot",
      price: 30,
      name: "Bot WhatsApp IA",
      description: "Bot de WhatsApp con IA en tu número para atender clientes 24/7.",
      features: ["Atención 24/7", "Base de conocimientos", "Traspaso a humano", "Sin límite de chats"],
      cardClass: "bg-[#141414] border border-emerald-500/15 hover:border-emerald-500/30 relative overflow-hidden group",
      textColor: "text-white",
      buttonClass: "bg-emerald-500 text-white font-bold hover:bg-emerald-600 active:scale-[0.98] transition-all",
      iconColor: "text-emerald-400",
      iconBg: "bg-white/[0.04] border border-white/[0.07]",
      badge: "Automatización",
      isService: true,
      priceInCredits: 0
    }
  ];

  const handleBuy = async () => {
    if (!selectedPackage || !user) return;
    setProcessing(true);
    
    try {
      let message = "";
      
      if (selectedPackage.isService) {
        if (selectedPackage.priceInCredits > 0) {
            message = `Hola, quiero solicitar el servicio *${selectedPackage.name}* usando mis créditos (${selectedPackage.priceInCredits.toLocaleString()} créditos).`;
        } else {
            message = `Hola, quiero contratar el servicio *${selectedPackage.name}* por *$${selectedPackage.price} USD*. ¿A dónde transfiero?`;
        }
      } else if (selectedPackage.isVip) {
        message = `Hola, confirmo mi intención de comprar el *${selectedPackage.name}* por *$${selectedPackage.price} USD*. ¿A dónde transfiero?`;
      } else {
        message = `Hola, confirmo mi intención de recargar *${selectedPackage.credits.toLocaleString()} Créditos* del Paquete ${selectedPackage.name} por *$${selectedPackage.price} USD*. ¿A dónde transfiero?`;
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
  const servicePackages = packages.filter(p => {
    if (!p.isService) return false;
    if (p.id === 'whatsapp_bot' && hasWhatsappBot) return false;
    return true;
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-10 animate-fade-in">
      
      <div className="text-center space-y-3 pt-6 pb-2">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white/90 tracking-tight">
          La Tienda
        </h1>
        <p className="text-white/30 max-w-xl mx-auto text-sm">
          Elige entre el acceso <span className="text-white/60 font-medium">VIP</span> o adquiere <span className="text-white/60 font-medium">paquetes de créditos</span>.
        </p>
      </div>

      {/* VIP Banner */}
      {!isVip && vipPackage && (
        <div className="relative w-full rounded-lg bg-[#141414] border border-[#FFDE00]/15 hover:border-[#FFDE00]/25 transition-colors overflow-hidden group">
          
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 p-5 lg:p-8 relative z-10">
            
            {/* VIP Icon */}
            <div className="shrink-0 hidden sm:block">
              <div className="bg-[#FFDE00]/10 border border-[#FFDE00]/20 p-6 rounded-2xl">
                <ShieldCheck className="w-12 h-12 sm:w-14 sm:h-14 text-[#FFDE00]" />
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1 text-center lg:text-left w-full">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFDE00]/10 border border-[#FFDE00]/15 text-[#FFDE00] text-[10px] font-semibold uppercase tracking-wider rounded-full mb-3">
                Suscripción Premium
              </div>
              <h2 className="text-2xl lg:text-4xl font-bold text-white tracking-tight mb-2 group-hover:text-[#FFDE00] transition-colors">
                {vipPackage.name}
              </h2>
              <p className="text-zinc-500 text-sm lg:text-base mb-4 max-w-2xl leading-relaxed">
                Sin límites de créditos ni restricciones. Acceso completo a todas las herramientas.
              </p>
              
              <div className="hidden sm:flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mb-4 lg:mb-0">
                {vipPackage.features.map((f, i) => (
                   <div key={i} className="flex items-center gap-2 text-sm bg-white/[0.04] px-3.5 py-2 rounded-lg border border-white/[0.06]">
                      <Check className="w-3.5 h-3.5 text-[#FFDE00]" />
                      <span className="text-zinc-300 font-medium">{f}</span>
                   </div>
                ))}
              </div>
            </div>
            
            {/* Pricing */}
            <div className="shrink-0 w-full lg:w-auto bg-[#0A0A0A] p-4 sm:p-6 rounded-lg border border-white/[0.06] text-center flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-4 lg:gap-0 relative z-10">
              
              <div className="hidden lg:block text-zinc-500 font-medium text-xs mb-2">Mensual</div>
              
              <div className="flex items-start gap-0.5 text-[#FFDE00] lg:mb-6">
                <span className="text-lg lg:text-2xl font-bold mt-1">$</span>
                <span className="text-3xl lg:text-6xl font-bold tracking-tight">{vipPackage.price}</span>
                <span className="text-sm font-medium mt-auto mb-0.5 lg:mb-2 opacity-70 ml-0.5">USD</span>
              </div>
              
              <div className="flex-1 lg:w-full">
                <button 
                  onClick={() => setSelectedPackage(vipPackage)}
                  className="w-full bg-[#FFDE00] text-black font-semibold text-sm lg:text-base py-3 px-4 lg:py-3.5 lg:px-6 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  Obtener VIP <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credits Header */}
      <div className="text-center pt-6 border-t border-white/[0.06]">
        <h2 className="text-base font-semibold text-white/80">Recargas de Créditos</h2>
        <p className="text-white/25 mt-1 text-sm">Los créditos no expiran.</p>
      </div>

      {/* Credit Packages */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-6 items-stretch">
        {creditPackages.map((pkg, idx) => (
          <div 
            key={pkg.id} 
            className={`relative rounded-lg p-4 lg:p-6 transition-colors flex flex-col justify-between ${pkg.cardClass} group`}
          >
            <div>
              {pkg.badge && (
                <div className={`absolute -top-2.5 lg:-top-3.5 inset-x-0 mx-auto w-max px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  pkg.popular 
                    ? 'bg-black text-[#FFDE00] border border-[#FFDE00]/30'
                    : 'bg-[#FFDE00] text-black'
                }`}>
                  {pkg.badge}
                </div>
              )}
              
              <h3 className={`text-lg lg:text-2xl font-bold mb-2 lg:mb-4 mt-1 ${pkg.textColor} tracking-tight`}>{pkg.name}</h3>
              
              <div className={`flex items-start gap-0.5 pb-3 lg:pb-5 mb-3 lg:mb-6 border-b ${pkg.popular ? 'border-black/10' : 'border-white/[0.06]'} ${pkg.textColor}`}>
                <span className="text-lg lg:text-2xl font-bold mt-0.5 opacity-80">$</span>
                <span className={`text-3xl lg:text-5xl font-bold tracking-tight`}>{pkg.price}</span>
                <span className="text-xs lg:text-sm font-medium mt-auto mb-0.5 opacity-60 ml-0.5">USD</span>
              </div>

              <div className={`flex items-center gap-2 lg:gap-3 mb-5 lg:mb-8 ${pkg.iconBg} p-2 lg:p-4 rounded-lg transition-colors`}>
                <Coins className={`w-5 h-5 lg:w-7 lg:h-7 ${pkg.iconColor}`} />
                <div>
                  <div className={`text-[9px] lg:text-xs font-medium opacity-50 uppercase tracking-wider ${pkg.popular ? 'text-black' : 'text-zinc-500'}`}>Recibes</div>
                  <div className={`text-lg lg:text-3xl font-bold ${pkg.popular ? 'text-black' : 'text-white'} tracking-tight leading-none`}>
                    {pkg.credits?.toLocaleString()}
                  </div>
                </div>
              </div>

              <ul className="hidden sm:block space-y-3 mb-8">
                {pkg.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm">
                    <div className={`p-1 rounded-full ${pkg.popular ? 'bg-black/10 text-black' : 'bg-white/[0.06] text-[#FFDE00]'}`}>
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className={`font-medium ${pkg.popular ? 'text-black/80' : 'text-zinc-400'}`}>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button 
              onClick={() => setSelectedPackage(pkg)}
              className={`w-full font-bold text-sm lg:text-base py-2.5 lg:py-3.5 rounded-lg transition-all flex justify-center items-center gap-1.5 ${pkg.buttonClass} active:scale-[0.98]`}
            >
              Seleccionar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Services */}
      {servicePackages.length > 0 && (
        <div className="pt-6 border-t border-white/[0.06]">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 text-[#FFDE00]" />
              Servicios Especiales
            </h2>
            <p className="text-zinc-500 mt-1.5 text-sm">Módulos y expansiones para tu cuenta.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-6 items-stretch max-w-4xl mx-auto">
            {servicePackages.map((pkg) => (
              <div 
                key={pkg.id} 
                className={`relative rounded-xl p-4 lg:p-8 transition-all duration-300 flex flex-col justify-between ${pkg.cardClass}`}
              >
                <div>
                  {pkg.badge && (
                    <div className="absolute -top-2.5 lg:-top-3.5 inset-x-0 mx-auto w-max px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FFDE00] text-black">
                      {pkg.badge}
                    </div>
                  )}
                  
                  <h3 className={`text-lg lg:text-2xl font-bold mb-1.5 lg:mb-3 ${pkg.textColor} tracking-tight`}>{pkg.name}</h3>
                  <p className="text-zinc-500 text-xs lg:text-sm mb-3 lg:mb-5 leading-relaxed hidden sm:block">{pkg.description}</p>
                  
                  <div className={`flex items-start gap-0.5 pb-3 lg:pb-5 mb-3 lg:mb-6 border-b border-white/[0.06] ${pkg.textColor}`}>
                    {pkg.priceInCredits && pkg.priceInCredits > 0 ? (
                      <>
                        <span className="text-xl lg:text-4xl font-bold tracking-tight">{pkg.priceInCredits?.toLocaleString() || 0}</span>
                        <span className="text-xs lg:text-sm font-medium mt-auto mb-0.5 opacity-60 ml-1">Créditos</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg lg:text-2xl font-bold mt-0.5 opacity-80">$</span>
                        <span className="text-2xl lg:text-4xl font-bold tracking-tight">{pkg.price}</span>
                        <span className="text-xs lg:text-sm font-medium mt-auto mb-0.5 opacity-60 ml-1">USD/mes</span>
                      </>
                    )}
                  </div>

                  <ul className="hidden sm:block space-y-3 mb-8">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm">
                        <div className="p-1 rounded-full bg-white/[0.06] text-[#FFDE00]">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-zinc-400">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setSelectedPackage(pkg)}
                    className={`w-full py-2.5 lg:py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${pkg.buttonClass}`}
                  >
                    Solicitar <ChevronRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowVideoModal(true)} className="text-[#FFDE00] font-medium text-[10px] sm:text-xs hover:text-white transition-colors py-1 text-center flex items-center justify-center gap-1">
                     <PlayCircle className="w-3 h-3" /> Ejemplos
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111113] border border-white/[0.08] rounded-xl p-6 lg:p-8 max-w-md w-full animate-scale-in relative">
            
            <div className="w-16 h-16 bg-[#FFDE00]/10 rounded-xl flex items-center justify-center mb-6 mx-auto border border-[#FFDE00]/15">
              {selectedPackage.isVip ? (
                <ShieldCheck className="w-8 h-8 text-[#FFDE00]" />
              ) : (
                <Coins className="w-8 h-8 text-[#FFDE00]" />
              )}
            </div>
            
            <h2 className="text-xl font-bold text-center text-white mb-2">Confirma tu elección</h2>
            <p className="text-center text-zinc-500 mb-6 text-sm">
              Estás solicitando <strong className="text-white">{selectedPackage.name}</strong> por <strong className="text-[#FFDE00]">{selectedPackage.isService ? `${selectedPackage.priceInCredits} Créditos` : `$${selectedPackage.price} USD`}</strong>. 
            </p>
            
            <div className="bg-[#09090b] border border-white/[0.06] p-4 rounded-lg mb-6 flex flex-col items-center justify-center">
               <span className="font-medium text-zinc-500 text-xs mb-2">Recibes</span>
               <div className="flex items-center gap-2 font-bold text-xl text-white">
                 {selectedPackage.isService ? (
                   <>
                     <PlayCircle className="w-6 h-6 text-[#FFDE00]" />
                     Video Personalizado
                   </>
                 ) : selectedPackage.isVip ? (
                   <>
                     <ShieldCheck className="w-6 h-6 text-[#FFDE00]" />
                     Premium VIP (1 Mes)
                   </>
                 ) : (
                   <>
                     <Coins className="w-6 h-6 text-[#FFDE00]" />
                     {selectedPackage.credits?.toLocaleString()} Créditos
                   </>
                 )}
               </div>
            </div>

            {/* Payment Method */}
            <div className="bg-[#09090b] border border-[#FFDE00]/15 p-4 rounded-lg mb-6 flex flex-col items-center justify-center">
              <span className="block text-[10px] text-[#FFDE00] font-semibold uppercase tracking-wider mb-2">Método de Pago</span>
              <div className="text-zinc-400 text-sm text-center font-medium leading-relaxed">
                 Banco Pichincha<br/>
                 Cuenta de ahorro transaccional<br/>
                 Número: <strong>2215379279</strong><br/>
                 A nombre de Andry Zamora
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedPackage(null)}
                className="flex-1 py-3 px-4 rounded-lg font-medium text-zinc-400 hover:text-zinc-200 bg-white/[0.04] hover:bg-white/[0.06] transition-colors text-sm border border-white/[0.06]"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBuy}
                disabled={processing}
                className="flex-1 py-3 px-4 rounded-lg font-bold text-black bg-[#FFDE00] hover:bg-[#ffe94d] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 text-sm"
              >
                {processing ? 'Procesando...' : 'Enviar al Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Examples Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111113] border border-white/[0.08] rounded-xl p-6 max-w-3xl w-full animate-scale-in relative">
            <button onClick={() => setShowVideoModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-white/[0.04] p-2 rounded-lg hover:bg-white/[0.08] transition">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-5">Ejemplos de Videos IA</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="aspect-video bg-[#09090b] rounded-lg flex flex-col items-center justify-center border border-white/[0.06] relative group cursor-pointer hover:border-[#FFDE00]/30 transition-colors overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10 flex flex-col justify-end p-4">
                   <PlayCircle className="w-10 h-10 text-[#FFDE00] mb-1.5 group-hover:scale-110 transition-transform" />
                   <span className="text-white font-semibold text-sm">Avatar Comercial</span>
                </div>
                <img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" alt="Ejemplo" />
              </div>
              <div className="aspect-video bg-[#09090b] rounded-lg flex flex-col items-center justify-center border border-white/[0.06] relative group cursor-pointer hover:border-[#FFDE00]/30 transition-colors overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10 flex flex-col justify-end p-4">
                   <PlayCircle className="w-10 h-10 text-[#FFDE00] mb-1.5 group-hover:scale-110 transition-transform" />
                   <span className="text-white font-semibold text-sm">Video Promocional</span>
                </div>
                <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" alt="Ejemplo 2" />
              </div>
            </div>
            <p className="text-zinc-500 text-center mt-5 text-xs">
              Muestras del acabado final. El resultado depende de tus instrucciones.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
