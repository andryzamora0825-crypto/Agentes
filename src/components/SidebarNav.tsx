"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Newspaper, ShieldAlert, Settings, ShoppingCart, Image as ImageIcon, Coins, ShieldCheck, MessageSquare, DollarSign, Share2 } from "lucide-react";
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
    { name: "Bot WhatsApp",        href: "/dashboard/whatsapp",      exact: false, icon: MessageSquare, adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Recargas",            href: "/dashboard/recargas",      exact: false, icon: DollarSign,    adminOnly: false, vipOnly: true,  requiresBot: true  },
    { name: "Tienda",              href: "/dashboard/tienda",         exact: false, icon: ShoppingCart,  adminOnly: false, vipOnly: false, requiresBot: false },
    { name: "Novedades",           href: "/dashboard/feed",           exact: false, icon: Newspaper,     adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Alertas",             href: "/dashboard/estafadores", exact: false, icon: ShieldAlert,   adminOnly: false, vipOnly: true,  requiresBot: false },
    { name: "Configuración",       href: "/dashboard/configuracion",  exact: false, icon: Settings,      adminOnly: false, vipOnly: false, requiresBot: false },
  ];

  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
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
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
              isActive 
                ? "bg-white/[0.06] text-white font-medium" 
                : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.name}
          </Link>
        );
      })}

      {/* Credits */}
      {credits !== null && (
        <div className="mt-4 mx-1 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center justify-between px-2">
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
