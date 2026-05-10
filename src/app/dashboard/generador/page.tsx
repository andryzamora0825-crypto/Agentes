"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Loader2, Download, Image as ImageIcon, X, Plus, Eye, Trash2,
  Monitor, Smartphone, RectangleHorizontal, RectangleVertical, Square,
  Wand2, XCircle, Paperclip
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useUser } from "@clerk/nextjs";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

const FORMAT_OPTIONS = [
  { id: 'auto', label: 'Auto', ratio: '', desc: 'IA decide', icon: 'sparkles' },
  { id: 'square', label: 'Cuadrado', ratio: '1:1', desc: 'Instagram Post', icon: 'square' },
  { id: 'vertical', label: 'Vertical', ratio: '9:16', desc: 'Reels / Stories', icon: 'phone' },
  { id: 'horizontal', label: 'Horizontal', ratio: '16:9', desc: 'YouTube / PC', icon: 'monitor' },
  { id: 'portrait', label: 'Retrato', ratio: '4:5', desc: 'Instagram Retrato', icon: 'rect-v' },
  { id: 'landscape', label: 'Paisaje', ratio: '3:2', desc: 'Publicidad / Web', icon: 'rect-h' },
];

function FormatIcon({ icon, className = "w-3.5 h-3.5" }: { icon: string; className?: string }) {
  switch (icon) {
    case 'square': return <Square className={className} />;
    case 'phone': return <Smartphone className={className} />;
    case 'monitor': return <Monitor className={className} />;
    case 'rect-v': return <RectangleVertical className={className} />;
    case 'rect-h': return <RectangleHorizontal className={className} />;
    case 'sparkles': return <Sparkles className={className} />;
    default: return <Square className={className} />;
  }
}

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg', lastModified: Date.now() }));
          else resolve(file);
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
  });
};

export default function GeneradorLibrePage() {
  const { user, isLoaded } = useUser();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<File[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('auto');
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'flash' | 'pro'>('flash');
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [lastEnhanced, setLastEnhanced] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCancelBtn, setShowCancelBtn] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const refInputRef = useRef<HTMLInputElement>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = isLoaded && user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;
  const currentFormat = FORMAT_OPTIONS.find(f => f.id === selectedFormat) || FORMAT_OPTIONS[0];

  // Close format menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) setShowFormatMenu(false);
    };
    if (showFormatMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFormatMenu]);

  // Elapsed timer
  useEffect(() => {
    if (!generating) { setElapsedSec(0); return; }
    const interval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generating]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/generate-free");
      const data = await res.json();
      if (data.images) setImages(data.images);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Ref image handlers
  const handleRefImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const rawFiles = Array.from(e.target.files);
      const compressed = await Promise.all(rawFiles.map(f => compressImage(f)));
      setRefImages(prev => [...prev, ...compressed].slice(0, 4));
    }
    if (refInputRef.current) refInputRef.current.value = "";
  };

  const removeRefImage = (i: number) => setRefImages(prev => prev.filter((_, idx) => idx !== i));

  // Paste handler
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const compressed = await compressImage(file);
          setRefImages(prev => [...prev, compressed].slice(0, 4));
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Cancel
  const handleCancel = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    setGenerating(false);
    setShowCancelBtn(false);
    if (cancelTimerRef.current) { clearTimeout(cancelTimerRef.current); cancelTimerRef.current = null; }
    setErrorMsg("Generación cancelada.");
  };

  // Generate
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setErrorMsg(null);
    setLastModel(null);
    setLastEnhanced(null);
    setShowCancelBtn(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const clientTimeout = setTimeout(() => abortController.abort(), 135_000);

    cancelTimerRef.current = setTimeout(() => setShowCancelBtn(true), 15_000);

    try {
      // Convert ref images to base64
      const refs = await Promise.all(refImages.map(f => fileToBase64(f)));

      const res = await fetch("/api/ai/generate-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          imageFormat: selectedFormat,
          forceModel: selectedModel,
          referenceImages: refs,
        }),
        signal: abortController.signal,
      });

      const data = await res.json();

      if (res.ok) {
        setLastModel(data.model || null);
        setLastEnhanced(data.enhancedPrompt || null);
        fetchHistory();
        setPrompt("");
        setRefImages([]);
      } else {
        setErrorMsg(data.error || "Error generando la imagen.");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setErrorMsg("Generación cancelada o timeout.");
      } else {
        setErrorMsg(err.message || "Error de conexión.");
      }
    } finally {
      clearTimeout(clientTimeout);
      setGenerating(false);
      setShowCancelBtn(false);
      if (cancelTimerRef.current) { clearTimeout(cancelTimerRef.current); cancelTimerRef.current = null; }
    }
  };

  // Delete image
  const handleDelete = async (imageId: string) => {
    setDeleting(true);
    try {
      // Try to delete from free_images or ai_images
      const res = await fetch("/api/ai/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      if (res.ok) {
        setImages(prev => prev.filter(img => img.id !== imageId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // Access gate
  if (!isLoaded) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <XCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Acceso Restringido</h2>
      <p className="text-sm text-zinc-500">Esta herramienta es exclusiva para administradores.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/20 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Generador Libre</h1>
            <p className="text-xs text-zinc-500">Generación de imágenes sin branding · Solo Admin</p>
          </div>
        </div>

        {/* Model selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedModel('flash')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedModel === 'flash' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-white/[0.06]'}`}
          >
            ⚡ Flash
          </button>
          <button
            onClick={() => setSelectedModel('pro')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedModel === 'pro' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-white/[0.06]'}`}
          >
            ✨ Pro
          </button>
          {selectedModel === 'pro' && (
            <span className="text-[10px] text-amber-500/60 ml-1">Alta fidelidad · Más lento</span>
          )}
          <span className="ml-auto text-xs text-emerald-400/60 font-semibold">🆓 Sin costo</span>
        </div>

        {/* Prompt input */}
        <form onSubmit={handleGenerate} className="space-y-3">
          {/* Ref images */}
          {refImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {refImages.map((file, i) => (
                <div key={i} className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`ref ${i + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeRefImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(e); } }}
              placeholder="Describe lo que quieres generar... GPT lo mejorará automáticamente ✨"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-32 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/30 resize-none min-h-[56px] max-h-[120px]"
              rows={2}
              disabled={generating}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
              {/* Format selector */}
              <div className="relative" ref={formatMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowFormatMenu(!showFormatMenu)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[11px] text-zinc-400 transition-colors"
                >
                  <FormatIcon icon={currentFormat.icon} className="w-3 h-3" />
                  {currentFormat.label}
                </button>
                {showFormatMenu && (
                  <div className="absolute bottom-full mb-1 right-0 bg-[#18181b] border border-white/10 rounded-xl p-1.5 min-w-[180px] z-50 shadow-2xl">
                    {FORMAT_OPTIONS.map(fmt => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => { setSelectedFormat(fmt.id); setShowFormatMenu(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${selectedFormat === fmt.id ? 'bg-purple-500/15 text-purple-300' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}
                      >
                        <FormatIcon icon={fmt.icon} className="w-3.5 h-3.5" />
                        <span className="font-medium">{fmt.label}</span>
                        <span className="ml-auto text-[10px] text-zinc-600">{fmt.ratio || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Attach button */}
              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 transition-colors"
                title="Agregar imagen de referencia"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleRefImageChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Generate button */}
          <button
            type="submit"
            disabled={generating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white active:scale-[0.98] shadow-lg shadow-purple-500/20"
          >
            <Wand2 className="w-4 h-4" />
            {generating ? "Generando..." : "Generar con IA"}
          </button>
        </form>

        {/* Error / Success messages */}
        {errorMsg && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {lastModel && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            Generado con {lastModel}
            {lastEnhanced && (
              <span className="text-zinc-500 ml-2 truncate max-w-[300px]">
                Prompt mejorado: "{lastEnhanced.slice(0, 60)}..."
              </span>
            )}
          </div>
        )}

        {/* Loading state */}
        {generating && (
          <div className="flex items-center justify-center p-8 border border-white/[0.06] rounded-xl bg-[#09090b] overflow-hidden relative animate-scale-in">
            <div className="absolute inset-0 bg-purple-500/[0.03] animate-pulse"></div>
            <div className="flex flex-col items-center text-center space-y-3 z-10">
              <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
              <h3 className="font-semibold text-white text-lg">Generando tu imagen...</h3>
              <p className="text-sm text-zinc-500 max-w-md">
                {selectedModel === 'pro'
                  ? 'GPT mejorando prompt → Gemini Pro generando. 30–60 segundos.'
                  : 'GPT mejorando prompt → Gemini Flash generando. 15–30 segundos.'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></div>
                <span className="text-xs font-mono text-zinc-600">{elapsedSec}s</span>
              </div>
              {showCancelBtn && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-sm font-semibold transition-all active:scale-95"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image gallery */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Historial Libre
            <span className="text-[10px] text-zinc-600 font-normal">({images.length})</span>
          </h2>

          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aún no has generado imágenes libres</p>
              <p className="text-xs mt-1 text-zinc-700">Escribe una idea y deja que la IA haga magia ✨</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((img) => (
                <div key={img.id} className="group bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:border-purple-500/20 transition-all">
                  {/* Image */}
                  <div className="relative aspect-square bg-black/30">
                    <img
                      src={img.image_url}
                      alt={img.prompt}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightboxUrl(img.image_url)}
                    />
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      &ldquo;{(img.prompt || '').replace('🎨 Libre: ', '')}&rdquo;
                    </p>
                    {img.enhanced_prompt && (
                      <p className="text-[10px] text-zinc-600 line-clamp-1 italic">
                        GPT: &ldquo;{img.enhanced_prompt.slice(0, 80)}...&rdquo;
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                      {img.model_used && <span className="px-1.5 py-0.5 rounded bg-white/[0.05]">{img.model_used}</span>}
                      <span>{img.created_at ? formatDistanceToNow(new Date(img.created_at), { addSuffix: true, locale: es }) : ''}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <a
                        href={img.image_url}
                        download
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-medium transition-colors"
                      >
                        <Download className="w-3 h-3" /> Bajar
                      </a>
                      <button
                        onClick={() => setLightboxUrl(img.image_url)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-zinc-400 text-[11px] font-medium transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                      {deleteConfirm === img.id ? (
                        <button
                          onClick={() => handleDelete(img.id)}
                          disabled={deleting}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-[11px] font-medium"
                        >
                          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Confirmar
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(img.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium transition-colors ml-auto"
                        >
                          <Trash2 className="w-3 h-3" /> Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
