"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Clipboard, Check, Sparkles, Heart, LayoutGrid, Search, X, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import VipGate from "@/components/VipGate";

interface GalleryItem {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  reference_urls: string[] | null;
  likes_count: number;
  created_at: string;
}

export default function ComunidadPage() {
  const router = useRouter();
  const { user } = useUser();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    fetchGallery();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchGallery = async () => {
    try {
      const res = await fetch("/api/comunidad?limit=60");
      const data = await res.json();
      if (data.success) setItems(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = async (item: GalleryItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt_used);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleRecreate = (item: GalleryItem) => {
    // Navegar al estudio con el prompt pre-cargado
    const encodedPrompt = encodeURIComponent(item.prompt_used);
    router.push(`/dashboard/estudio?prompt=${encodedPrompt}`);
  };

  const toggleLike = (id: string) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}sem`;
  };

  // Filter items by search
  const filteredItems = searchQuery.trim()
    ? items.filter(it =>
        it.prompt_used.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.author_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  // Distribute items into columns for Masonry layout
  const getColumns = (count: number) => {
    const cols: GalleryItem[][] = Array.from({ length: count }, () => []);
    filteredItems.forEach((item, i) => {
      cols[i % count].push(item);
    });
    return cols;
  };

  return (
    <VipGate>
      <div className="min-h-screen">

        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Title */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/10">
                  <LayoutGrid className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white/90 tracking-tight leading-none">Comunidad IA</h1>
                  <p className="text-[11px] text-white/25 mt-0.5">
                    {filteredItems.length} {filteredItems.length === 1 ? "obra" : "obras"} publicadas
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-md ml-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar prompts o artistas..."
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-full pl-9 pr-9 py-2 text-sm text-white/80 placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-sm text-zinc-500">Cargando galería...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <LayoutGrid className="w-8 h-8 text-zinc-700" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-500">
                {searchQuery ? "Sin resultados" : "La galería está vacía"}
              </h2>
              <p className="text-sm text-zinc-600 max-w-sm text-center">
                {searchQuery
                  ? `No se encontraron obras para "${searchQuery}".`
                  : "Sé el primero en publicar. Ve al Estudio IA, genera una imagen y presiona \"Hacer Público\"."}
              </p>
            </div>
          ) : (
            <>
              {/* Masonry Grid - Responsive columns */}
              {/* Mobile: 2 cols, Tablet: 3 cols, Desktop: 4 cols */}
              <div className="sm:hidden">
                <MasonryGrid columns={getColumns(2)} onCopy={copyPrompt} onRecreate={handleRecreate} onLike={toggleLike} onLightbox={setLightbox} copiedId={copiedId} likedIds={likedIds} timeAgo={timeAgo} />
              </div>
              <div className="hidden sm:block lg:hidden">
                <MasonryGrid columns={getColumns(3)} onCopy={copyPrompt} onRecreate={handleRecreate} onLike={toggleLike} onLightbox={setLightbox} copiedId={copiedId} likedIds={likedIds} timeAgo={timeAgo} />
              </div>
              <div className="hidden lg:block">
                <MasonryGrid columns={getColumns(4)} onCopy={copyPrompt} onRecreate={handleRecreate} onLike={toggleLike} onLightbox={setLightbox} copiedId={copiedId} likedIds={likedIds} timeAgo={timeAgo} />
              </div>
            </>
          )}
        </div>

        {/* Scroll to top */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-all shadow-xl backdrop-blur-md animate-fade-in"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}

        {/* Lightbox */}
        {lightbox && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl transition-colors z-50"
              onClick={() => setLightbox(null)}
            >
              <X className="w-5 h-5" />
            </button>

            <div
              className="max-w-3xl w-full max-h-[90dvh] overflow-y-auto custom-scrollbar flex flex-col lg:flex-row gap-5 animate-scale-in"
              onClick={e => e.stopPropagation()}
            >
              {/* Image */}
              <div className="flex-1 flex items-center justify-center shrink-0">
                <img
                  src={lightbox.image_url}
                  alt="Arte comunitario"
                  className="max-w-full max-h-[55vh] lg:max-h-[85vh] object-contain rounded-xl"
                />
              </div>

              {/* Info Panel */}
              <div className="lg:w-72 shrink-0 bg-[#111113] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-4">
                {/* Author */}
                <div className="flex items-center gap-2.5">
                  <img
                    src={lightbox.author_avatar || `https://ui-avatars.com/api/?name=${lightbox.author_name}&background=1a1a2e&color=fff&size=40`}
                    alt={lightbox.author_name}
                    className="w-9 h-9 rounded-full border border-white/[0.08]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white/80">{lightbox.author_name}</p>
                    <p className="text-[10px] text-zinc-600">{timeAgo(lightbox.created_at)}</p>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Prompt</p>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.04]">
                    {lightbox.prompt_used}
                  </p>
                </div>

                {/* Model */}
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <Sparkles className="w-3 h-3" />
                  {lightbox.model_used || "Nano IA"}
                </div>

                {/* Reference Images */}
                {lightbox.reference_urls && lightbox.reference_urls.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Imágenes de Referencia</p>
                    <div className="flex gap-1.5">
                      {lightbox.reference_urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Ref ${i + 1}`}
                          className="w-14 h-14 rounded-lg object-cover border border-white/[0.06] hover:border-white/[0.15] transition-colors cursor-pointer"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const encodedPrompt = encodeURIComponent(lightbox.prompt_used);
                      router.push(`/dashboard/estudio?prompt=${encodedPrompt}`);
                    }}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FFDE00] to-[#FFB800] text-black font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.97]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Recrear en mi Estudio
                  </button>
                  <button
                    onClick={() => copyPrompt(lightbox)}
                    className="w-full py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    {copiedId === lightbox.id ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-400" /> ¡Copiado!</>
                    ) : (
                      <><Clipboard className="w-3.5 h-3.5" /> Copiar Prompt</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </VipGate>
  );
}


/* ─────────────────────────────────────────────
   Masonry Grid Component
   ───────────────────────────────────────────── */

interface MasonryProps {
  columns: GalleryItem[][];
  onCopy: (item: GalleryItem) => void;
  onRecreate: (item: GalleryItem) => void;
  onLike: (id: string) => void;
  onLightbox: (item: GalleryItem) => void;
  copiedId: string | null;
  likedIds: Set<string>;
  timeAgo: (d: string) => string;
}

function MasonryGrid({ columns, onCopy, onRecreate, onLike, onLightbox, copiedId, likedIds, timeAgo }: MasonryProps) {
  return (
    <div className="flex gap-3.5">
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex-1 flex flex-col gap-3.5">
          {col.map((item, itemIdx) => (
            <MasonryCard
              key={item.id}
              item={item}
              index={colIdx * 10 + itemIdx}
              onCopy={onCopy}
              onRecreate={onRecreate}
              onLike={onLike}
              onLightbox={onLightbox}
              copiedId={copiedId}
              isLiked={likedIds.has(item.id)}
              timeAgo={timeAgo}
            />
          ))}
        </div>
      ))}
    </div>
  );
}


/* ─────────────────────────────────────────────
   Individual Masonry Card
   ───────────────────────────────────────────── */

interface CardProps {
  item: GalleryItem;
  index: number;
  onCopy: (item: GalleryItem) => void;
  onRecreate: (item: GalleryItem) => void;
  onLike: (id: string) => void;
  onLightbox: (item: GalleryItem) => void;
  copiedId: string | null;
  isLiked: boolean;
  timeAgo: (d: string) => string;
}

function MasonryCard({ item, index, onCopy, onRecreate, onLike, onLightbox, copiedId, isLiked, timeAgo }: CardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-[#111113] border border-white/[0.04] hover:border-white/[0.10] transition-all duration-300 cursor-pointer"
      style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
    >
      {/* Image */}
      <div className="relative w-full" onClick={() => onLightbox(item)}>
        {!imgLoaded && (
          <div className="w-full aspect-square bg-zinc-900 animate-pulse rounded-xl" />
        )}
        <img
          src={item.image_url}
          alt="Arte IA"
          className={`w-full block transition-all duration-700 ${imgLoaded ? "opacity-100" : "opacity-0 absolute top-0 left-0"}`}
          onLoad={() => setImgLoaded(true)}
          loading="lazy"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          {/* Prompt excerpt */}
          <p className="text-[11px] text-white/80 line-clamp-3 leading-relaxed mb-3 font-medium">
            &quot;{item.prompt_used}&quot;
          </p>

          {/* Action Row */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onRecreate(item); }}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#FFDE00] to-[#FFB800] text-black font-bold text-[10px] flex items-center justify-center gap-1.5 hover:brightness-110 transition-all active:scale-[0.95] shadow-lg shadow-[#FFDE00]/10"
            >
              <Sparkles className="w-3 h-3" />
              Recrear
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(item); }}
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors backdrop-blur-sm"
              title="Copiar prompt"
            >
              {copiedId === item.id
                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                : <Clipboard className="w-3.5 h-3.5 text-white/80" />
              }
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLike(item.id); }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all backdrop-blur-sm ${
                isLiked
                  ? "bg-red-500/25 text-red-400 scale-110"
                  : "bg-white/15 hover:bg-white/25 text-white/70"
              }`}
              title="Like"
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Footer: Author + Reference indicators */}
      <div className="px-3 py-2.5 border-t border-white/[0.04]">
        {item.reference_urls && item.reference_urls.length > 0 && (
          <div className="flex gap-1 mb-2">
            {item.reference_urls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Ref ${i + 1}`}
                className="w-6 h-6 rounded object-cover border border-white/[0.08] opacity-60"
              />
            ))}
            <span className="text-[9px] text-zinc-600 self-center ml-1">refs</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <img
            src={item.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author_name)}&background=1a1a2e&color=fff&size=28`}
            alt=""
            className="w-5 h-5 rounded-full border border-white/[0.08]"
          />
          <span className="text-[10px] font-medium text-zinc-400 truncate flex-1">{item.author_name}</span>
          <span className="text-[9px] text-zinc-600 shrink-0">{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
