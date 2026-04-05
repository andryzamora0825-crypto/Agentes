"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  // Cerrar el menú automáticamente si se navega a otra ruta en celular
  useEffect(() => {
    setIsOpen(false);
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
    </div>
  );
}
