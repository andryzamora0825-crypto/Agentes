"use client";

import { useState } from "react";
import type { SocialPost } from "@/lib/types/social.types";
import StatusBadge from "./StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle,
  Edit3,
  Trash2,
  Send,
  Eye,
  X,
  Globe,
  Camera,
  Calendar,
  RotateCcw,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

interface PostCardProps {
  post: SocialPost;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onEdit: (post: SocialPost) => void;
  onSave: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPublishNow: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
}

export default function PostCard({
  post,
  onApprove,
  onReject,
  onEdit,
  onSave,
  onDelete,
  onPublishNow,
  onRetry,
}: PostCardProps) {
  const [lightbox, setLightbox] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setLoading(action);
    try {
      await fn();
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateCaption = async () => {
    if (!post.image_url) return;
    setLoading("generate_caption");
    try {
      const res = await fetch("/api/social/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: post.image_url, platform: post.platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando caption");
      
      await onSave(post.id, { caption: data.caption });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error al analizar imagen.");
    } finally {
      setLoading(null);
    }
  };

  const PlatformIcon = post.platform === "instagram" ? Camera : Globe;
  const platformLabel =
    post.platform === "both" ? "FB + IG" : post.platform === "instagram" ? "Instagram" : "Facebook";

  return (
    <>
      <div className="bg-[#141414] rounded-lg overflow-hidden border border-white/[0.06] group relative flex flex-col hover:border-white/[0.1] transition-colors">
        {/* Image Preview */}
        <div className="relative aspect-square w-full bg-black/50 flex items-center justify-center overflow-hidden">
          {post.image_url ? (
            <>
              <img
                src={post.image_url}
                alt="Post"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <button
                onClick={() => setLightbox(true)}
                className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                <Eye className="w-8 h-8 text-white drop-shadow-lg" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <ImageIcon className="w-12 h-12" />
              <span className="text-xs font-bold">Sin imagen</span>
            </div>
          )}

          {/* Status badge overlay */}
          <div className="absolute top-3 left-3">
            <StatusBadge status={post.status} />
          </div>

          {/* Platform badge */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/10">
            <PlatformIcon className="w-3 h-3 text-gray-300" />
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-wider">
              {platformLabel}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col justify-between border-t border-white/5">
          {/* Caption */}
          <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed mb-3">
            {post.caption}
          </p>

          {/* Schedule info */}
          {post.scheduled_at && (
            <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold text-gray-500">
              <Calendar className="w-3 h-3" />
              <span>
                Programado:{" "}
                {new Date(post.scheduled_at).toLocaleString("es-EC", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {/* Error message */}
          {post.last_error && (
            <div className={`bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-3 ${post.status === "failed" ? "opacity-100" : "opacity-80"}`}>
              <p className="text-[10px] text-red-400 font-bold line-clamp-2">
                <AlertTriangle className="w-3 h-3 shrink-0 inline mr-1" />
                {post.last_error}
              </p>
              {post.retry_count > 0 && post.status !== "published" && (
                <p className="text-[9px] text-red-500/60 mt-1">
                  Intentos de publicación: {post.retry_count}/3
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-white/5">
            {/* Approve (only for pending) */}
            {post.status === "pending" && (
              <button
                onClick={() => handleAction("approve", () => onApprove(post.id))}
                disabled={loading !== null}
                className="flex-1 min-w-[70px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-emerald-500/20 disabled:opacity-40"
              >
                {loading === "approve" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Aprobar
              </button>
            )}

            {/* Reject (only for pending) */}
            {post.status === "pending" && (
              <button
                onClick={() => handleAction("reject", () => onReject(post.id))}
                disabled={loading !== null}
                className="bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 px-2 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-gray-500/20 disabled:opacity-40"
              >
                {loading === "reject" ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            )}

            {/* Edit (pending or approved) */}
            {(post.status === "pending" || post.status === "approved") && (
              <button
                onClick={() => onEdit(post)}
                className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-2 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}

            {/* AI Caption (only for approved) */}
            {post.status === "approved" && (
              <button
                onClick={handleGenerateCaption}
                disabled={loading !== null || !post.image_url}
                className="flex-1 bg-[#FFDE00]/10 hover:bg-[#FFDE00]/20 text-[#FFDE00] px-2 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-[#FFDE00]/20 disabled:opacity-40"
                title="Generar título y descripción con IA analizando esta imagen"
              >
                {loading === "generate_caption" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Crear Descripción
              </button>
            )}

            {/* Publish Now (only for approved) */}
            {post.status === "approved" && (
              <button
                onClick={() => handleAction("publish", () => onPublishNow(post.id))}
                disabled={loading !== null}
                className="flex-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-2 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-cyan-500/20 disabled:opacity-40"
              >
                {loading === "publish" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Publicar
              </button>
            )}

            {/* Retry (only for failed) */}
            {post.status === "failed" && (
              <button
                onClick={() => handleAction("retry", () => onRetry(post.id))}
                disabled={loading !== null}
                className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-2 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-amber-500/20 disabled:opacity-40"
              >
                {loading === "retry" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Reintentar
              </button>
            )}

            {/* Delete (not for published) */}
            {post.status !== "published" && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 py-2 rounded-lg flex justify-center items-center transition-all border border-red-500/20"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}

            {/* Ver Link (only for published) */}
            {post.status === "published" && post.meta_post_id && (
              <a
                href={post.meta_post_id.startsWith("http") ? post.meta_post_id : `https://facebook.com/${post.meta_post_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 px-2 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-fuchsia-500/20"
              >
                <Eye className="w-3 h-3" />
                Ver Link
              </a>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
            <span className="text-[10px] text-[#FFDE00] uppercase font-black tracking-widest bg-[#FFDE00]/5 px-2 py-0.5 rounded">
              {formatDistanceToNow(new Date(post.created_at), {
                locale: es,
                addSuffix: true,
              })}
            </span>
            {post.published_at && (
              <span className="text-[9px] text-cyan-400/60 font-bold">
                Pub: {new Date(post.published_at).toLocaleDateString("es-EC")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightbox && post.image_url && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors z-50"
            onClick={() => setLightbox(false)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={post.image_url}
            alt="Vista completa"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div
            className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/20 p-2.5 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-black text-white">¿Eliminar este post?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Esta acción es permanente. El post y su imagen serán eliminados del servidor.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={loading !== null}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold text-sm border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  handleAction("delete", async () => {
                    await onDelete(post.id);
                    setConfirmDelete(false);
                  })
                }
                disabled={loading !== null}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading === "delete" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {loading === "delete" ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
