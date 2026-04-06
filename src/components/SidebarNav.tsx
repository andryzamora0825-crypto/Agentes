"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Newspaper, ShieldAlert, LayoutDashboard, Settings, ShoppingCart, Image as ImageIcon, Coins, ShieldCheck, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export default function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>('FREE');
  const [daysLeft, setDaysLeft] = useState<number>(0);
  
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
        }
      })
      .catch(console.error);
  }, []);

  const isVip = isAdmin || plan === 'VIP';

  const navItems = [
    { name: "Notas de Retiro",     href: "/dashboard",              exact: true,  icon: FileText,      adminOnly: false, vipOnly: true  },
    { name: "Panel Admin",         href: "/dashboard/admin",         exact: false, icon: ShieldCheck,   adminOnly: true,  vipOnly: false },
    { name: "Estudio IA",          href: "/dashboard/estudio",       exact: false, icon: ImageIcon,     adminOnly: false, vipOnly: true  },
    { name: "Bot WhatsApp AI",     href: "/dashboard/whatsapp",      exact: false, icon: MessageSquare, adminOnly: false, vipOnly: true  },
    { name: "Tienda",              href: "/dashboard/tienda",         exact: false, icon: ShoppingCart,  adminOnly: false, vipOnly: false },
    { name: "Novedades (Muro)",    href: "/dashboard/feed",           exact: false, icon: Newspaper,     adminOnly: false, vipOnly: true  },
    { name: "Alertas / Estafadores", href: "/dashboard/estafadores", exact: false, icon: ShieldAlert,   adminOnly: false, vipOnly: true  },
    { name: "Configuración",       href: "/dashboard/configuracion",  exact: false, icon: Settings,      adminOnly: false, vipOnly: false },
  ];

  return (
    <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {navItems.map((item) => {
        if (item.adminOnly && !isAdmin) return null;
        if (item.vipOnly && !isVip) return null;

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
        <div className="mt-8 pt-4 border-t border-white/5 px-4 relative">
          <div className="absolute inset-0 bg-[#FFDE00]/5 blur-3xl rounded-full"></div>
          <div className="bg-[#121212] rounded-xl p-4 flex flex-col items-center border border-white/5 relative z-10 hover:shadow-[0_0_25px_rgba(255,222,0,0.15)] transition-all duration-500">
            
            {/* Etiqueta de Plan VIP/FREE */}
            {plan === "VIP" ? (
              <div className="absolute -top-3 inset-x-0 mx-auto w-max px-3 py-0.5 bg-[#FFDE00] text-[#23274A] font-black text-[10px] rounded-full shadow-sm z-10 flex items-center gap-1">
                ⭐ VIP ACTIVADO ({daysLeft} {daysLeft === 1 ? 'DÍA' : 'DÍAS'})
              </div>
            ) : (
              <Link href="/dashboard/chat" className="absolute -top-3 inset-x-0 mx-auto w-max px-3 py-0.5 bg-gray-600 text-white font-black text-[10px] rounded-full shadow-sm z-10 hover:bg-gray-500 transition-colors uppercase tracking-widest">
                RENUEVA TU VIP AQUÍ
              </Link>
            )}

            <Coins className="w-8 h-8 text-[#FFDE00] mb-2 mt-2" />
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Tu Saldo</span>
            <span className="text-2xl font-black text-white text-shadow-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">{credits.toLocaleString()}</span>
            <Link 
              href="/dashboard/tienda" 
              className="mt-4 bg-[#FFDE00] text-black w-full text-center py-2.5 rounded-xl text-sm font-black shadow-[0_0_15px_rgba(255,222,0,0.4)] hover:bg-[#FFC107] hover:shadow-[0_0_25px_rgba(255,222,0,0.6)] hover:scale-105 transition-all duration-300"
            >
              Comprar Créditos
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
