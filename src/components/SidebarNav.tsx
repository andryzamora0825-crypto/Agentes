"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Newspaper, ShieldAlert, Settings, ShoppingCart, Image as ImageIcon, Coins, ShieldCheck, MessageSquare, DollarSign, Share2, Crown, LayoutGrid, Brain } from "lucide-react";
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
  const isOperator = (user?.publicMetadata as any)?.role === "operator";

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
    { name: "Panel Admin",         href: "/dashboard/admin",         exact: true,  icon: ShieldCheck,   adminOnly: true,  vipOnly: false, requiresBot: false },
    { name: "Pronósticos IA",      href: "/dashboard/admin/pronosticos", exact: false, icon: Brain,       adminOnly: true,  vipOnly: false, requiresBot: false },
    { name: "Mi Agencia",           href: "/dashboard/operador",      exact: false, icon: Crown,         adminOnly: false, vipOnly: false, requiresBot: false, operatorOnly: true },
    { name: "Estudio IA",          href: "/dashboard/estudio",       exact: false, icon: ImageIcon,     adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Comunidad IA",        href: "/dashboard/comunidad",     exact: false, icon: LayoutGrid,    adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Social Media",        href: "/dashboard/social",        exact: false, icon: Share2,        adminOnly: false, vipOnly: false, requiresBot: false, requiresSocial: true },
    { name: "Bot WhatsApp",        href: "/dashboard/whatsapp",      exact: false, icon: MessageSquare, adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Recargas",            href: "/dashboard/recargas",      exact: false, icon: DollarSign,    adminOnly: false, vipOnly: true,  requiresBot: true  },
    { name: "Tienda",              href: "/dashboard/tienda",         exact: false, icon: ShoppingCart,  adminOnly: false, vipOnly: false, requiresBot: false },
    { name: "Novedades",           href: "/dashboard/feed",           exact: false, icon: Newspaper,     adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Alertas",             href: "/dashboard/estafadores", exact: false, icon: ShieldAlert,   adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Configuración",       href: "/dashboard/configuracion",  exact: false, icon: Settings,      adminOnly: false, vipOnly: false, requiresBot: false },
  ];

  return (
    <nav className="flex-1 px-4 lg:px-3 py-5 lg:py-3 space-y-1 lg:space-y-0.5 overflow-y-auto">
      {/* Section label — solo visible en móvil */}
      <p className="lg:hidden text-[10px] font-semibold text-white/20 uppercase tracking-[0.15em] px-3 pb-3">
        Menú principal
      </p>

      {navItems.map((item, index) => {
        if (item.adminOnly && !isAdmin) return null;
        if ((item as any).operatorOnly && !isOperator) return null;
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
            className={`
              flex items-center gap-3.5 lg:gap-2.5
              px-4 lg:px-3 py-3.5 lg:py-2
              rounded-2xl lg:rounded-lg
              text-[15px] lg:text-[13px]
              font-medium
              transition-all duration-200
              active:scale-[0.97]
              ${isActive 
                ? "bg-white/[0.08] lg:bg-white/[0.06] text-white shadow-sm shadow-white/[0.02]" 
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }
            `}
          >
            <div className={`
              w-9 h-9 lg:w-auto lg:h-auto lg:p-0
              flex items-center justify-center
              rounded-xl lg:rounded-none
              transition-colors duration-200
              ${isActive 
                ? 'bg-[#FFDE00]/10 lg:bg-transparent text-[#FFDE00]' 
                : 'bg-white/[0.04] lg:bg-transparent text-inherit'
              }
            `}>
              <Icon className="w-[18px] h-[18px] lg:w-4 lg:h-4 shrink-0" />
            </div>
            <span>{item.name}</span>
            {isActive && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FFDE00] lg:hidden" />
            )}
          </Link>
        );
      })}

      {/* Credits Card */}
      {credits !== null && (
        <div className="mt-6 lg:mt-4 mx-1 pt-5 lg:pt-4 border-t border-white/[0.06]">
          {/* Móvil: tarjeta grande premium */}
          <div className="lg:hidden mx-1 p-5 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Créditos</div>
                <div className="text-2xl font-bold text-white mt-1">{credits.toLocaleString()}</div>
              </div>
              {plan === "VIP" ? (
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold text-[#FFDE00] bg-[#FFDE00]/[0.1] px-3 py-1.5 rounded-xl border border-[#FFDE00]/20">
                    ⭐ VIP
                  </span>
                  <span className="text-[10px] text-white/25 mt-1.5">{daysLeft} días restantes</span>
                </div>
              ) : (
                <Link 
                  href="/dashboard/tienda" 
                  className="text-[12px] font-semibold text-black bg-gradient-to-r from-[#FFDE00] to-[#FFB800] px-4 py-2 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#FFDE00]/10"
                >
                  Recargar
                </Link>
              )}
            </div>
          </div>

          {/* Desktop: compacto */}
          <div className="hidden lg:flex items-center justify-between px-2">
            <div>
              <div className="text-[10px] text-white/25 uppercase tracking-wider font-medium">Créditos</div>
              <div className="text-sm font-semibold text-white/80 mt-0.5">{credits.toLocaleString()}</div>
            </div>
            {plan === "VIP" ? (
              <span className="text-[10px] font-semibold text-[#FFDE00]/70 bg-[#FFDE00]/[0.08] px-2 py-0.5 rounded">
                VIP · {daysLeft}d
              </span>
            ) : (
              <Link href="/dashboard/tienda" className="text-[10px] font-medium text-white/30 hover:text-white/50 transition-colors">
                Recargar →
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
