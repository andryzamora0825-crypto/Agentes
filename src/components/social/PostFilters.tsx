"use client";

import type { PostStatus } from "@/lib/types/social.types";
import {
  LayoutList,
  Clock,
  CheckCircle,
  Send,
  XCircle,
  ShieldOff,
} from "lucide-react";

interface PostFiltersProps {
  activeFilter: PostStatus | "all";
  onFilterChange: (filter: PostStatus | "all") => void;
  counts: Record<string, number>;
}

const FILTERS: { value: PostStatus | "all"; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "Todos", icon: LayoutList },
  { value: "pending", label: "Pendientes", icon: Clock },
  { value: "approved", label: "Aprobados", icon: CheckCircle },
  { value: "published", label: "Publicados", icon: Send },
  { value: "failed", label: "Fallidos", icon: XCircle },
  { value: "rejected", label: "Rechazados", icon: ShieldOff },
];

export default function PostFilters({ activeFilter, onFilterChange, counts }: PostFiltersProps) {
  const totalAll = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const isActive = activeFilter === f.value;
        const count = f.value === "all" ? totalAll : (counts[f.value] || 0);
        const Icon = f.icon;

        return (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-300 ${
              isActive
                ? "bg-[#FFDE00]/10 border-[#FFDE00]/40 text-[#FFDE00] shadow-[0_0_12px_rgba(255,222,0,0.15)]"
                : "bg-[#111111] border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300 hover:border-white/10"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{f.label}</span>
            {count > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                  isActive
                    ? "bg-[#FFDE00]/20 text-[#FFDE00]"
                    : "bg-white/5 text-gray-600"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
