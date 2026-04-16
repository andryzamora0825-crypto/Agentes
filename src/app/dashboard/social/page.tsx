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
  const { user, isLoaded } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";
  const hasSocialAccess = isAdmin || !!(user?.publicMetadata as any)?.socialMediaSettings?.isUnlocked;

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

  // Guard: Solo admin o agentes con acceso pueden ver Social Media
  if (isLoaded && !hasSocialAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <Share2 className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-black text-white">Social Media</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Este módulo no está activado para tu cuenta. Contacta al administrador para solicitar acceso a la herramienta de publicación automática en redes sociales.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-500">
            🔒 Módulo bloqueado — Solo disponible con activación del admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <VipGate>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* ═══ Header ═══ */}
        <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/[0.06] p-2 rounded-lg">
                <Share2 className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-white/90 flex items-center gap-2">
                  Social Media
                </h1>
                <p className="text-white/40 mt-0.5 text-sm flex items-center gap-1.5">
                  Genera, aprueba y publica contenido automáticamente con{" "}
                  <span className="text-white/60 font-medium flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> Nano Banana</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Configuración — visible para TODOS (agentes necesitan enlazar sus páginas) */}
              <button
                onClick={() => { setShowSettings(!showSettings); setShowGenerator(false); }}
                className={`p-2.5 rounded-lg border transition-all ${
                  showSettings
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/90 border-white/[0.06]"
                }`}
                title="Configuración de Redes"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Botones de gestión: Recargar y Generar */}
                  <button
                    onClick={() => fetchPosts()}
                    className="bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white/90 p-2.5 rounded-lg border border-white/[0.06] transition-all"
                    title="Recargar"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setShowGenerator(!showGenerator); setShowSettings(false); }}
                    className={`font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all text-sm ${
                      showGenerator
                        ? "bg-white/[0.08] text-white/80 border border-white/[0.06]"
                        : "bg-[#FFDE00] text-black hover:brightness-110"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    {showGenerator ? "Cancelar" : "Generar Post"}
                  </button>
            </div>
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

        {/* ═══ Settings Panel (visible para todos) ═══ */}
        {showSettings && (
          <SocialSettingsPanel onClose={() => setShowSettings(false)} />
        )}

        {/* ═══ Generator Panel ═══ */}
        {showGenerator && (
          <div className="bg-[#141414] rounded-lg border border-white/[0.06] p-5 sm:p-6 mb-6">

            {/* Model indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center gap-2 px-3 py-1 rounded-[4px] text-[10px] font-medium uppercase tracking-widest bg-[#FFDE00]/10 border border-[#FFDE00]/20 text-[#FFDE00]">
                <Bot className="w-3 h-3" />
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
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-1.5 block">
                  Tema / Idea del post
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej: Promoción especial de fin de semana para nuevos clientes..."
                  className="w-full bg-[#0A0A0A] text-white/90 border border-white/[0.08] rounded-lg px-3 py-2.5 focus:outline-none focus:border-white/20 resize-none h-24 transition-colors text-sm placeholder-white/20"
                />
              </div>

              {/* Brand Voice */}
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-1.5 block">
                  Tono de voz
                </label>
                <input
                  type="text"
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  className="w-full bg-[#0A0A0A] text-white/90 border border-white/[0.08] rounded-lg px-3 py-2.5 focus:outline-none focus:border-white/20 transition-colors text-sm placeholder-white/20"
                  placeholder="profesional y cercano"
                />
              </div>

              {/* Format + Platform Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Image Format */}
                <div>
                  <label className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-1.5 block">
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
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs font-medium ${
                            selected
                              ? "bg-white/[0.08] border-white/[0.15] text-white"
                              : "bg-transparent border-white/[0.06] text-white/40 hover:bg-white/[0.04]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {fmt.label}
                          <span className="text-[9px] font-mono opacity-60 ml-1">{fmt.ratio}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <label className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-1.5 block">
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
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs font-medium ${
                            active
                              ? "bg-white/[0.08] border-white/[0.15] text-white"
                              : "bg-transparent border-white/[0.06] text-white/40 hover:bg-white/[0.04]"
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
              <div className="pt-2 border-t border-white/[0.06]">
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-1.5 block">
                  Programar publicación (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="bg-[#0A0A0A] text-white/90 border border-white/[0.08] rounded-lg px-3 py-2.5 focus:outline-none focus:border-white/20 transition-colors text-sm [color-scheme:dark]"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={generating || !topic.trim()}
                className="w-full bg-[#FFDE00] text-black font-semibold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-colors disabled:opacity-50 text-sm mt-4"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generar Caption + Imagen
                  </>
                )}
              </button>

              {/* Generating animation */}
              {generating && (
                <div className="flex items-center justify-center p-6 border border-white/[0.06] rounded-lg bg-[#0A0A0A] mt-4">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FFDE00]" />
                    <h3 className="font-semibold text-white/90 text-sm">Generando contenido con IA...</h3>
                    <p className="text-xs text-white/40 max-w-sm">
                      Esto puede tomar unos 15-30 segundos.
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
                onSave={handleEdit}
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
