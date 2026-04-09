"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Newspaper, ShieldAlert, LayoutDashboard, Settings, ShoppingCart, Image as ImageIcon, Coins, ShieldCheck, MessageSquare, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>('FREE');
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [hasWhatsappBot, setHasWhatsappBot] = useState(false);
  
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";

  // Sincronizar créditos con Clerk
  useEffect(() => {
    fetch("/api/user/sync")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCredits(data.credits);
          setPlan(data.plan);
          setDaysLeft(data.daysLeft);
          setHasWhatsappBot(data.hasWhatsappBot || false);
        }
      })
      .catch(console.error);
  }, []);

  const isVip = isAdmin || plan === 'VIP';

  const navItems = [
    { name: "Notas de Retiro",     href: "/dashboard",              exact: true,  icon: FileText,      adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Panel Admin",         href: "/dashboard/admin",         exact: false, icon: ShieldCheck,   adminOnly: true,  vipOnly: false, requiresBot: false },
    { name: "Estudio IA",          href: "/dashboard/estudio",       exact: false, icon: ImageIcon,     adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Bot WhatsApp AI",     href: "/dashboard/whatsapp",      exact: false, icon: MessageSquare, adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Recargas",            href: "/dashboard/recargas",      exact: false, icon: DollarSign,    adminOnly: false, vipOnly: true,  requiresBot: true  },
    { name: "Tienda",              href: "/dashboard/tienda",         exact: false, icon: ShoppingCart,  adminOnly: false, vipOnly: false, requiresBot: false },
    { name: "Novedades (Muro)",    href: "/dashboard/feed",           exact: false, icon: Newspaper,     adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Alertas / Estafadores", href: "/dashboard/estafadores", exact: false, icon: ShieldAlert,   adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Configuración",       href: "/dashboard/configuracion",  exact: false, icon: Settings,      adminOnly: false, vipOnly: false, requiresBot: false },
  ];

  return (
    <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {navItems.map((item) => {
        if (item.adminOnly && !isAdmin) return null;
        if (item.vipOnly && !isVip) return null;
        if (item.requiresBot && !hasWhatsappBot && !isAdmin) return null;

        const Icon = item.icon;
        const isActive = item.exact 
          ? pathname === item.href 
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${
              isActive 
                ? "bg-[#FFDE00] text-black shadow-[0_0_20px_rgba(255,222,0,0.3)] transform scale-105" 
                : "text-gray-400 hover:text-[#FFDE00] hover:bg-[#FFDE00]/10 hover:shadow-[0_0_15px_rgba(255,222,0,0.1)]"
            }`}
          >
            <Icon className="w-5 h-5" />
            {item.name}
          </Link>
        );
      })}

      {/* Widget de Créditos e Identidad */}
      {credits !== null && (
        <div className="mt-8 px-4 pb-4">
          <div className="bg-gradient-to-br from-[#151515] to-[#0A0A0A] rounded-2xl p-5 flex flex-col items-center border border-white/10 relative shadow-2xl overflow-hidden group hover:border-[#FFDE00]/30 transition-all duration-500">
            
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFDE00]/5 blur-[40px] rounded-full pointer-events-none group-hover:bg-[#FFDE00]/10 transition-colors duration-500"></div>

            {/* Etiqueta de Plan VIP/FREE */}
            {plan === "VIP" ? (
              <div className="w-full text-center px-3 py-1.5 bg-[#FFDE00]/10 border border-[#FFDE00]/20 text-[#FFDE00] font-black text-[10px] rounded-lg shadow-inner flex justify-center items-center gap-2 mb-5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFDE00] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-full w-full bg-[#FFDE00]"></span>
                </span>
                VIP ACTIVO ({daysLeft} {daysLeft === 1 ? 'DÍA' : 'DÍAS'})
              </div>
            ) : (
              <Link href="/dashboard/tienda" className="w-full text-center px-3 py-1.5 bg-white/5 border border-white/10 text-gray-300 font-extrabold text-[10px] rounded-lg hover:bg-white/10 hover:text-white transition-colors uppercase tracking-[0.15em] mb-5 font-sans">
                Renueva tu VIP Aquí
              </Link>
            )}

            {/* Saldo Grid */}
            <div className="flex items-center gap-4 w-full mb-5 relative z-10">
              <div className="bg-black/80 p-3 rounded-xl border border-white/5 shadow-inner">
                <Coins className="w-6 h-6 text-[#FFDE00]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest font-sans mb-0.5">Tu Saldo</span>
                <span className="text-3xl font-black text-white tracking-tighter leading-none font-sans">{credits.toLocaleString()}</span>
              </div>
            </div>

            <Link 
              href="/dashboard/tienda" 
              className="relative z-10 w-full bg-[#FFDE00] text-black text-center py-3 rounded-xl text-sm font-black hover:bg-white hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_0_20px_rgba(255,222,0,0.15)] flex justify-center items-center gap-2"
            >
              Comprar Créditos
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
