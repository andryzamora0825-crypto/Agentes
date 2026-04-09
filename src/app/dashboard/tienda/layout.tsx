"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Target, Ticket } from "lucide-react";

const tabs = [
  { name: "Tienda", href: "/dashboard/tienda", icon: ShoppingCart, exact: true },
  { name: "Canjear Código", href: "/dashboard/tienda/canjear", icon: Ticket, exact: false },
];

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Tabs de navegación */}
      <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <nav className="flex gap-1 py-3 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                    isActive
                      ? "bg-[#FFDE00] text-black shadow-[0_0_20px_rgba(255,222,0,0.3)] scale-105"
                      : "text-gray-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Contenido de la tab seleccionada */}
      {children}
    </div>
  );
}
