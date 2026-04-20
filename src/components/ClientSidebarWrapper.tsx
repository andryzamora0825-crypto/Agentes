"use client";

import { useState, useEffect } from "react";
import { Menu, X, MessageSquare, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";

export default function ClientSidebarWrapper({ 
  userButton, 
  sidebarNav, 
  children 
}: { 
  userButton: React.ReactNode;
  sidebarNav: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { signOut } = useClerk();

  useEffect(() => { setIsOpen(false); }, [pathname]);

  const { user, isLoaded } = useUser();
  useEffect(() => {
    // 🛡️ REVISOR GLOBAL DE CADUCIDAD VIP
    // Si la persona sigue marcada como VIP pero su tiempo expiró, disparamos la revocación
    if (isLoaded && user && typeof user.publicMetadata === 'object') {
      const { plan, vipExpiresAt } = user.publicMetadata as any;
      if (plan === 'VIP' && vipExpiresAt) {
        if (Date.now() > Number(vipExpiresAt)) {
          console.warn("⚠️ Tiempo VIP expirado detectado en el cliente. Bajando a FREE...");
          fetch('/api/user/sync')
            .then(res => res.json())
            .then(() => {
              window.location.reload(); // Recarga para que toda la UI se limpie y tome el nuevo token
            })
            .catch(err => console.error("Error al revocar VIP:", err));
        }
      }
    }
  }, [user, isLoaded]);

  useEffect(() => {
    const fetchUnread = () => {
      fetch(`/api/chat?action=unread_count&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      })
        .then(res => res.json())
        .then(data => { if (data.success) setUnreadCount(data.count); })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Bloquear scroll del body cuando el sidebar está abierto en móvil
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <div className="flex h-[100dvh] bg-[#0A0A0A] overflow-hidden">
      
      {/* Mobile Top Bar — minimal */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-5 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFDE00] to-[#FFB800] flex items-center justify-center">
            <span className="text-black font-black text-xs">Z</span>
          </div>
          <span className="text-[15px] font-bold text-white/90 tracking-tight">Zamtools</span>
        </div>
        <button 
          onClick={() => setIsOpen(true)} 
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all active:scale-90"
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Mobile Fullscreen Overlay */}
      <div 
        className={`lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`} 
        onClick={() => setIsOpen(false)} 
      />

      {/* Sidebar — Fullscreen en móvil, panel fijo en desktop */}
      <aside 
        className={`
          fixed lg:static inset-0 lg:inset-auto
          lg:w-[260px] w-full
          bg-[#0A0A0A] lg:bg-[#0F0F0F]
          text-white flex flex-col z-50
          transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          lg:border-r border-white/[0.06]
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 lg:h-14 px-6 lg:px-5 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 lg:w-7 lg:h-7 rounded-xl lg:rounded-lg bg-gradient-to-br from-[#FFDE00] to-[#FFB800] flex items-center justify-center shadow-lg shadow-[#FFDE00]/10">
              <span className="text-black font-black text-sm lg:text-xs">Z</span>
            </div>
            <div>
              <span className="text-base lg:text-sm font-bold text-white/90 tracking-tight block">Zamtools</span>
              <span className="text-[10px] text-white/25 font-medium tracking-wider uppercase hidden lg:block">Dashboard</span>
            </div>
          </div>
          <button 
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all active:scale-90" 
            onClick={() => setIsOpen(false)}
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Nav Items — área scrollable */}
        <div className="flex-1 overflow-y-auto">
          {sidebarNav}
        </div>

        {/* User Account Footer */}
        <div className="shrink-0 p-4 lg:p-4 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            {userButton}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-white/50 truncate">Mi Cuenta</span>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-red-500/15 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-all active:scale-90"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 h-[100dvh]">
        {children}
      </main>

      {/* Chat FAB */}
      {pathname !== "/dashboard/chat" && (
        <Link 
          href="/dashboard/chat"
          className="fixed bottom-5 right-5 lg:bottom-6 lg:right-6 bg-gradient-to-br from-[#FFDE00] to-[#FFB800] text-black w-12 h-12 lg:w-11 lg:h-11 rounded-2xl lg:rounded-full flex items-center justify-center hover:brightness-110 active:scale-90 transition-all z-30 shadow-lg shadow-[#FFDE00]/15"
        >
          <MessageSquare className="w-5 h-5 lg:w-[18px] lg:h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 w-3 h-3 lg:w-2.5 lg:h-2.5 rounded-full border-2 border-[#0A0A0A] animate-pulse" />
          )}
        </Link>
      )}
    </div>
  );
}
