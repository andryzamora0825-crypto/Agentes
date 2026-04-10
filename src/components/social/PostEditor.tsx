"use client";

import { useState } from "react";
import type { SocialPost, Platform } from "@/lib/types/social.types";
import { X, Save, Loader2, Globe, Camera, Calendar, Sparkles } from "lucide-react";

interface PostEditorProps {
  post: SocialPost;
  onSave: (id: string, data: { caption?: string; platform?: Platform; scheduled_at?: string | null }) => Promise<void>;
  onClose: () => void;
}

export default function PostEditor({ post, onSave, onClose }: PostEditorProps) {
  const [caption, setCaption] = useState(post.caption);
  const [platform, setPlatform] = useState<Platform>(post.platform);
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  const handleGenerateCaption = async () => {
    if (!post.image_url) return;
    setGeneratingCaption(true);
    try {
      const res = await fetch("/api/social/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: post.image_url, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando caption");
      
      setCaption(data.caption);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Ocurrió un error al analizar la imagen.");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(post.id, {
        caption: caption.trim(),
        platform,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const platformOptions: { value: Platform; label: string; icon: React.ElementType }[] = [
    { value: "facebook", label: "Facebook", icon: Globe },
    { value: "instagram", label: "Instagram", icon: Camera },
    { value: "both", label: "Ambas", icon: Globe },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className="bg-[#1A1A1A] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-extrabold text-white tracking-tight">Editar Post</h2>
          <button
            onClick={onClose}
            className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Image Preview */}
          {post.image_url && (
            <div className="rounded-2xl overflow-hidden border border-white/10 max-h-64">
              <img
                src={post.image_url}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Caption Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                Caption
                <span className={`${caption.length > 500 ? "text-red-400" : "text-gray-600"}`}>
                  ({caption.length} caracteres)
                </span>
              </label>

              {post.image_url && (
                <button
                  onClick={handleGenerateCaption}
                  disabled={generatingCaption}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFDE00]/10 hover:bg-[#FFDE00]/20 text-[#FFDE00] rounded-lg text-xs font-bold border border-[#FFDE00]/20 transition-colors disabled:opacity-50"
                  title="Analizar imagen y crear caption con ChatGPT"
                >
                  {generatingCaption ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {generatingCaption ? "Analizando imagen..." : "Generar con IA (ChatGPT)"}
                </button>
              )}
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-[#0b0b0b] text-white border border-white/10 rounded-2xl p-4 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/50 focus:border-[#FFDE00]/50 resize-none h-40 text-sm leading-relaxed shadow-inner"
              placeholder="Escribe el caption del post..."
            />
          </div>

          {/* Platform Selector */}
          <div>
            <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
              Plataforma
            </label>
            <div className="flex gap-2">
              {platformOptions.map((opt) => {
                const isActive = platform === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPlatform(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-bold ${
                      isActive
                        ? "bg-[#FFDE00]/10 border-[#FFDE00]/40 text-[#FFDE00]"
                        : "bg-[#111111] border-white/5 text-gray-500 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule Picker */}
          <div>
            <label className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
              <Calendar className="w-3.5 h-3.5" />
              Programar publicación (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="flex-1 bg-[#0b0b0b] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/50 text-sm [color-scheme:dark]"
              />
              {scheduledAt && (
                <button
                  onClick={() => setScheduledAt("")}
                  className="bg-white/5 hover:bg-white/10 text-gray-400 px-3 rounded-xl border border-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold text-sm border border-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !caption.trim()}
            className="flex-1 px-4 py-3.5 bg-[#FFDE00] hover:bg-[#FFC107] text-black rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(255,222,0,0.3)] disabled:opacity-40 active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
