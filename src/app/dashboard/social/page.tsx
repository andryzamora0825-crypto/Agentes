"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Share2,
  Sparkles,
  Loader2,
  RefreshCw,
  Zap,
  Send,
  Square,
  Smartphone,
  Monitor,
  RectangleHorizontal,
  Globe,
  Camera,
  Settings,
  X,
  AlertTriangle,
  Bot,
} from "lucide-react";
import VipGate from "@/components/VipGate";
import PostCard from "@/components/social/PostCard";
import PostFilters from "@/components/social/PostFilters";
import PostEditor from "@/components/social/PostEditor";
import EmptyState from "@/components/social/EmptyState";
import SocialSettingsPanel from "@/components/social/SocialSettingsPanel";
import type { SocialPost, PostStatus, Platform } from "@/lib/types/social.types";

const FORMAT_OPTIONS = [
  { id: "square", label: "Cuadrado", ratio: "1:1", icon: Square },
  { id: "vertical", label: "Vertical", ratio: "9:16", icon: Smartphone },
  { id: "horizontal", label: "Horizontal", ratio: "16:9", icon: Monitor },
  { id: "portrait", label: "Retrato", ratio: "4:5", icon: RectangleHorizontal },
];

const PLATFORM_OPTIONS: { value: Platform; label: string; icon: React.ElementType }[] = [
  { value: "facebook", label: "Facebook", icon: Globe },
  { value: "instagram", label: "Instagram", icon: Camera },
  { value: "both", label: "Ambas", icon: Share2 },
];

export default function SocialDashboardPage() {
  const { user } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";

  // State
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PostStatus | "all">("all");
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Generate form state
  const [showGenerator, setShowGenerator] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [imageFormat, setImageFormat] = useState("square");
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [brandVoice, setBrandVoice] = useState("profesional y cercano");
  const [scheduledAt, setScheduledAt] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("status", activeFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/social/posts?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setPosts(data.posts);
        setCounts(data.counts || {});
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Auto refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  // Generate new post
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || generating) return;

    setGenerating(true);
    setGenError(null);
    setGenSuccess(null);

    try {
      const res = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          platform,
          imageFormat,
          brandVoice,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setGenSuccess(`¡Post generado con ${data.model || "Nano Banana"}!`);
        setTopic("");
        setScheduledAt("");
        setShowGenerator(false);
        fetchPosts();
      } else {
        setGenError(data.error || "Error generando el post.");
      }
    } catch (err) {
      setGenError("Error de conexión con el servidor.");
    } finally {
      setGenerating(false);
    }
  };

  // Post actions
  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/social/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) fetchPosts();
  };

  const handleReject = async (id: string) => {
    const res = await fetch(`/api/social/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (res.ok) fetchPosts();
  };

  const handleEdit = async (
    id: string,
    data: { caption?: string; platform?: Platform; scheduled_at?: string | null }
  ) => {
    const res = await fetch(`/api/social/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchPosts();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/social/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      fetchPosts();
    }
  };

  const handlePublishNow = async (id: string) => {
    // First set scheduled_at to now so the publish endpoint picks it up
    await fetch(`/api/social/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_at: new Date().toISOString() }),
    });
    // Trigger publish
    await fetch("/api/social/publish", { method: "POST" });
    fetchPosts();
  };

  const handleRetry = async (id: string) => {
    // Reset to approved status for retry
    await fetch(`/api/social/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    fetchPosts();
  };

  return (
    <VipGate>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* ═══ Header ═══ */}
        <div className="relative">
          <div className="absolute top-0 left-0 w-40 h-40 bg-[#FFDE00]/15 rounded-full blur-[80px] -z-10" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
                <div className="bg-[#FFDE00] p-2 rounded-xl shadow-[0_0_15px_rgba(255,222,0,0.4)]">
                  <Share2 className="w-8 h-8 text-black" />
                </div>
                Social Media
              </h1>
              <p className="text-gray-400 mt-2 text-base flex items-center gap-2">
                Genera, aprueba y publica contenido automáticamente con{" "}
                <span className="text-[#FFDE00] font-black flex items-center gap-1"><Bot className="w-4 h-4" /> Nano Banana</span>
              </p>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowSettings(!showSettings); setShowGenerator(false); }}
                  className={`p-3 rounded-xl border transition-all ${
                    showSettings
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/10"
                  }`}
                  title="Configuración de Redes"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fetchPosts()}
                  className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white p-3 rounded-xl border border-white/10 transition-all"
                  title="Recargar"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setShowGenerator(!showGenerator); setShowSettings(false); }}
                  className={`font-black px-6 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 ${
                    showGenerator
                      ? "bg-white/10 text-gray-300 border border-white/10"
                      : "bg-[#FFDE00] text-black hover:bg-[#FFC107] shadow-[0_0_20px_rgba(255,222,0,0.3)] hover:shadow-[0_0_30px_rgba(255,222,0,0.5)]"
                  }`}
                >
                  <Sparkles className={`w-5 h-5 ${showGenerator ? "" : "fill-black"}`} />
                  {showGenerator ? "Cerrar" : "Generar Post"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Success Message ═══ */}
        {genSuccess && (
          <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 font-bold text-sm flex items-center gap-2 animate-in">
            <Zap className="w-4 h-4 shrink-0" /> {genSuccess}
            <button
              onClick={() => setGenSuccess(null)}
              className="ml-auto text-emerald-600 hover:text-emerald-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ═══ Settings Panel ═══ */}
        {showSettings && isAdmin && (
          <SocialSettingsPanel onClose={() => setShowSettings(false)} />
        )}

        {/* ═══ Generator Panel ═══ */}
        {showGenerator && isAdmin && (
          <div className="bg-[#121212] rounded-3xl border border-white/5 p-5 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFDE00]/5 rounded-full blur-[80px] pointer-events-none" />

            {/* Model indicator */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border bg-[#FFDE00]/10 border-[#FFDE00]/20 text-[#FFDE00]">
                <Bot className="w-3.5 h-3.5" />
                Nano Banana 2 — Texto + Imagen
              </div>
            </div>

            {genError && (
              <div className="mb-6 bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20 font-semibold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {genError}
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Topic Input */}
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
                  Tema / Idea del post
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej: Promoción especial de fin de semana para nuevos clientes..."
                  className="w-full bg-[#050505] text-white border border-white/10 rounded-2xl p-5 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/50 focus:border-[#FFDE00]/50 resize-none h-28 transition-all text-base font-medium shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] placeholder-gray-700"
                />
              </div>

              {/* Brand Voice */}
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
                  Tono de voz
                </label>
                <input
                  type="text"
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  className="w-full bg-[#050505] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/50 text-sm"
                  placeholder="profesional y cercano"
                />
              </div>

              {/* Format + Platform Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Image Format */}
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
                    Formato de imagen
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FORMAT_OPTIONS.map((fmt) => {
                      const selected = imageFormat === fmt.id;
                      const Icon = fmt.icon;
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setImageFormat(fmt.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs font-bold ${
                            selected
                              ? "bg-[#FFDE00]/10 border-[#FFDE00]/40 text-[#FFDE00]"
                              : "bg-[#111111] border-white/5 text-gray-500 hover:bg-white/5"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {fmt.label}
                          <span className="text-[9px] font-mono opacity-60">{fmt.ratio}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
                    Plataforma
                  </label>
                  <div className="flex gap-2">
                    {PLATFORM_OPTIONS.map((opt) => {
                      const active = platform === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPlatform(opt.value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs font-bold ${
                            active
                              ? "bg-[#FFDE00]/10 border-[#FFDE00]/40 text-[#FFDE00]"
                              : "bg-[#111111] border-white/5 text-gray-500 hover:bg-white/5"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">
                  Programar publicación (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full sm:w-auto bg-[#050505] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/50 text-sm [color-scheme:dark]"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={generating || !topic.trim()}
                className="w-full bg-[#FFDE00] text-black font-black px-8 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-[#FFC107] transition-all shadow-[0_0_20px_rgba(255,222,0,0.3)] hover:shadow-[0_0_30px_rgba(255,222,0,0.5)] disabled:opacity-30 active:scale-[0.98] text-base"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Nano Banana generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6 fill-black" />
                    Generar Caption + Imagen
                  </>
                )}
              </button>

              {/* Generating animation */}
              {generating && (
                <div className="flex items-center justify-center p-6 border border-white/10 rounded-2xl bg-black/50 overflow-hidden relative">
                  <div className="absolute inset-0 bg-[#FFDE00]/10 animate-pulse" />
                  <div className="flex flex-col items-center text-center space-y-3 z-10">
                    <Loader2 className="w-10 h-10 animate-spin text-[#FFDE00] drop-shadow-[0_0_10px_rgba(255,222,0,0.8)]" />
                    <h3 className="font-bold text-white text-lg">Generando contenido con IA...</h3>
                    <p className="text-sm text-gray-400 max-w-md">
                      Nano Banana está creando el caption y la imagen para tu post. Esto puede tomar
                      15-30 segundos.
                    </p>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {/* ═══ Filters ═══ */}
        <PostFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} counts={counts} />

        {/* ═══ Posts Grid ═══ */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-[#FFDE00]" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            onGenerate={() => setShowGenerator(true)}
            filterActive={activeFilter !== "all"}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={(p) => setEditingPost(p)}
                onDelete={handleDelete}
                onPublishNow={handlePublishNow}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}

        {/* ═══ Post Count Footer ═══ */}
        {!loading && posts.length > 0 && (
          <div className="text-center pt-4 border-t border-white/5">
            <span className="text-xs text-gray-600 font-bold">
              Mostrando{" "}
              <span className="text-[#FFDE00]">{posts.length}</span> posts
              {activeFilter !== "all" && ` con estado "${activeFilter}"`}
            </span>
          </div>
        )}
      </div>

      {/* ═══ Editor Modal ═══ */}
      {editingPost && (
        <PostEditor
          post={editingPost}
          onSave={handleEdit}
          onClose={() => setEditingPost(null)}
        />
      )}
    </VipGate>
  );
}
