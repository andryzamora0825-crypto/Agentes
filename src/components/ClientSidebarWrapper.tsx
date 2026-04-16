"use client";

import { useState, useEffect } from "react";
import { Menu, X, MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

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

  useEffect(() => { setIsOpen(false); }, [pathname]);

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

  return (
    <div className="flex h-[100dvh] bg-[#0A0A0A] overflow-hidden">
      
      {/* Mobile Bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-[#0A0A0A] border-b border-white/[0.08] flex items-center justify-between px-4 z-40">
        <span className="text-sm font-semibold text-white/90 tracking-tight">Zamtools</span>
        <button onClick={() => setIsOpen(true)} className="p-2 text-white/40 hover:text-white/70 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40 animate-fade-in" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-[260px] bg-[#0F0F0F] text-white flex flex-col z-50 transform transition-transform duration-200 ease-out border-r border-white/[0.06] ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        <div className="h-14 px-5 flex items-center justify-between border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white/90 tracking-tight">Zamtools</span>
          <button className="lg:hidden p-1 text-white/30 hover:text-white/60 transition-colors" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {sidebarNav}

        <div className="mt-auto p-4 border-t border-white/[0.06] flex items-center gap-3">
          {userButton}
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-white/50 truncate">Mi Cuenta</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 h-[100dvh]">
        {children}
      </main>

      {/* Chat FAB */}
      {pathname !== "/dashboard/chat" && (
        <Link 
          href="/dashboard/chat"
          className="fixed bottom-5 right-5 lg:bottom-6 lg:right-6 bg-[#FFDE00] text-black w-11 h-11 rounded-full flex items-center justify-center hover:brightness-110 active:scale-95 transition-all z-50"
        >
          <MessageSquare className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 w-2.5 h-2.5 rounded-full border-2 border-[#0A0A0A]" />
          )}
        </Link>
      )}
    </div>
  );
}
