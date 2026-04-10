"use client";

import type { PostStatus } from "@/lib/types/social.types";
import { Clock, CheckCircle, Send, AlertTriangle, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<PostStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
}> = {
  pending: {
    label: "Pendiente",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: Clock,
  },
  approved: {
    label: "Aprobado",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: CheckCircle,
  },
  published: {
    label: "Publicado",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    icon: Send,
  },
  failed: {
    label: "Fallido",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
  },
  rejected: {
    label: "Rechazado",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/20",
    icon: XCircle,
  },
};

export default function StatusBadge({ status }: { status: PostStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${config.color} ${config.bgColor} ${config.borderColor}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
