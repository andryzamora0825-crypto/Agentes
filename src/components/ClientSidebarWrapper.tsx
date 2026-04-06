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

  // Cerrar el menú automáticamente si se navega a otra ruta en celular
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Polling de mensajes no leídos
  useEffect(() => {
    const fetchUnread = () => {
      fetch(`/api/chat?action=unread_count&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUnreadCount(data.count);
          }
        })
        .catch(() => {});
    };

    fetchUnread(); // Primera vez
    const interval = setInterval(fetchUnread, 15000); // Cada 15 segundos
    return () => clearInterval(interval);
  }, [pathname]);

  return (
    <div className="flex h-[100dvh] bg-black overflow-hidden relative">
      
      {/* Botón flotante para Menú (Solo Celulares) */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-16 bg-[#0A0A0A] border-b border-white/5 flex items-center justify-between px-4 z-40 shadow-2xl">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded bg-[#FFDE00] flex items-center justify-center font-bold text-[#23274A] text-sm">
             E
           </div>
           <span className="text-lg font-bold tracking-tight text-white">Zamtools</span>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 text-white hover:bg-white/10 rounded-xl"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Overlay oscuro para fondo (Solo si abierto) */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Fijo Desktop o Desplegable Celular */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 lg:w-64 bg-[#0A0A0A] text-white flex flex-col z-50 transform transition-transform duration-300 ease-in-out border-r border-white/5 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Encabezado Logo Sidebar */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between lg:justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#FFDE00] flex items-center justify-center font-bold text-[#23274A]">
              E
            </div>
            <span className="text-xl font-bold tracking-tight">Zamtools</span>
          </div>
          
          <button 
            className="lg:hidden p-1 bg-white/5 rounded-lg text-gray-300 hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Componente del Menú Navegación inyectado del Servidor */}
        {sidebarNav}

        {/* Footer del Menú */}
        <div className="p-4 border-t border-white/5 bg-black flex items-center gap-3">
          {userButton}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white group-hover:text-[#FFDE00] transition-colors">Sesión Activa</span>
            <span className="text-[10px] text-[#FFDE00] uppercase font-black tracking-widest drop-shadow-[0_0_5px_#FFDE00] animate-pulse">Agente VDL</span>
          </div>
        </div>
      </aside>

      {/* ZONA PRINCIPAL DE CONTENIDO */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0 h-[100dvh]">
        {children}
      </main>

      {/* Botón Flotante Soporte Chat - Oculto en la página de chat para no tapar el botón de enviar */}
      {pathname !== "/dashboard/chat" && (
        <Link 
          href="/dashboard/chat"
          className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 bg-[#FFDE00] text-black w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,222,0,0.4)] hover:bg-[#FFC107] hover:scale-110 transition-all z-50 group"
          title="Soporte Técnico"
        >
          <MessageSquare className="w-6 h-6 fill-black" />
          {/* Badge de notificaciones (Solo punto rojo sin número) */}
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 w-3.5 h-3.5 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          )}
          <span className="absolute -top-10 right-0 bg-[#1A1A1A] text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
            Soporte Chat
          </span>
        </Link>
      )}
    </div>
  );
}
