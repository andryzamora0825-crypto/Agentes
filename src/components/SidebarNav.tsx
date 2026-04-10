"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Newspaper, ShieldAlert, LayoutDashboard, Settings, ShoppingCart, Image as ImageIcon, Coins, ShieldCheck, MessageSquare, DollarSign, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>('FREE');
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [hasWhatsappBot, setHasWhatsappBot] = useState(false);
  const [hasSocialMedia, setHasSocialMedia] = useState(false);
  
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
          setHasSocialMedia(data.hasSocialMedia || false);
        }
      })
      .catch(console.error);
  }, []);

  const isVip = isAdmin || plan === 'VIP';

  const navItems = [
    { name: "Notas de Retiro",     href: "/dashboard",              exact: true,  icon: FileText,      adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Panel Admin",         href: "/dashboard/admin",         exact: false, icon: ShieldCheck,   adminOnly: true,  vipOnly: false, requiresBot: false },
    { name: "Estudio IA",          href: "/dashboard/estudio",       exact: false, icon: ImageIcon,     adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Social Media",        href: "/dashboard/social",        exact: false, icon: Share2,        adminOnly: false, vipOnly: false, requiresBot: false, requiresSocial: true },
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
        if ((item as any).requiresSocial && !hasSocialMedia && !isAdmin) return null;

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

      {/* Widget de Créditos e Identidad Minimalista */}
      {credits !== null && (
        <div className="mt-8 px-4 pb-4">
          <div className="bg-[#0f0f0f] rounded-xl p-3 border border-white/5 flex flex-col gap-2.5 hover:border-[#FFDE00]/20 transition-colors">
             
             {/* Fila de balance */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="bg-[#FFDE00]/10 p-1.5 rounded-lg">
                     <Coins className="w-4 h-4 text-[#FFDE00]" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-sans leading-none mb-0.5">Saldo</span>
                      <span className="text-base font-black text-white font-sans leading-none">{credits.toLocaleString()}</span>
                   </div>
                </div>

                <Link 
                  href="/dashboard/tienda" 
                  className="bg-[#FFDE00] text-black w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-md shrink-0"
                  title="Comprar Créditos"
                >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                </Link>
             </div>

             {/* Fila VIP/Renovar */}
             {plan === "VIP" ? (
               <div className="w-full py-1.5 bg-[#FFDE00]/5 text-[#FFDE00] font-bold text-[10px] rounded-lg flex justify-center items-center gap-1.5">
                 <ShieldCheck className="w-3 h-3" /> VIP ({daysLeft} d)
               </div>
             ) : (
               <Link href="/dashboard/tienda" className="w-full text-center py-1.5 bg-white/5 text-gray-400 font-bold text-[10px] rounded-lg hover:bg-white/10 hover:text-white transition-colors tracking-wide font-sans">
                 Renovar VIP
               </Link>
             )}
          </div>
        </div>
      )}
    </nav>
  );
}
