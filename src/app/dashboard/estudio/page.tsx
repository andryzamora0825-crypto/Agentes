"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Loader2, Download, Image as ImageIcon, X, Plus, Zap, Eye, Trash2, Monitor, Smartphone, RectangleHorizontal, RectangleVertical, Square, UserCircle, Clipboard, RefreshCw, Paperclip, Mic } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useUser } from "@clerk/nextjs";
import VipGate from "@/components/VipGate";

const FORMAT_OPTIONS = [
  { id: 'square', label: 'Cuadrado', ratio: '1:1', desc: 'Instagram Post', icon: 'square' },
  { id: 'vertical', label: 'Vertical', ratio: '9:16', desc: 'Reels / Stories', icon: 'phone' },
  { id: 'horizontal', label: 'Horizontal', ratio: '16:9', desc: 'YouTube / PC', icon: 'monitor' },
  { id: 'portrait', label: 'Retrato', ratio: '4:5', desc: 'Instagram Retrato', icon: 'rect-v' },
  { id: 'landscape', label: 'Paisaje', ratio: '3:2', desc: 'Publicidad / Web', icon: 'rect-h' },
  { id: 'whatsapp', label: 'WhatsApp', ratio: '1:1', desc: 'Estado / Perfil', icon: 'square' },
];

export default function EstudioIAPage() {
  const { user, isLoaded } = useUser();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<File[]>([]);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [useAgencyIdentity, setUseAgencyIdentity] = useState(true);
  const [useAgencyCharacter, setUseAgencyCharacter] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const originalPromptRef = useRef("");
  const refInputRef = useRef<HTMLInputElement>(null);

  const baseCost = refImages.length > 0 ? 150 : 100;
  const characterCost = useAgencyCharacter ? 50 : 0;
  const totalCost = baseCost + characterCost;

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/ai/history");
      const data = await res.json();
      if (data.success) setImages(data.images);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (isLoaded && user && user.publicMetadata?.aiSettings) {
      const settings = user.publicMetadata.aiSettings as any;
      if (settings.aiEnabled !== undefined) setUseAgencyIdentity(settings.aiEnabled);
    }
  }, [user, isLoaded]);

  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setRefImages(prev => [...prev, ...newFiles].slice(0, 3));
    }
    if (refInputRef.current) refInputRef.current.value = "";
  };

  const removeRefImage = (i: number) => {
    setRefImages(prev => prev.filter((_, idx) => idx !== i));
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setRefImages(prev => [...prev, file].slice(0, 3));
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!generating) { setElapsedSec(0); return; }
    const interval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generating]);

  const toggleVoiceMode = async () => {
    if (isListening) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        setIsTranscribing(true);

        const formData = new FormData();
        formData.append("audio", audioBlob);

        try {
          const res = await fetch("/api/ai/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.success && data.text) {
            setPrompt(prev => {
              const base = prev ? prev.trim() + " " : "";
              return (base + data.text).replace(/\s+/g, " ");
            });
            setTimeout(() => {
              const textarea = document.getElementById("prompt-input");
              if (textarea) {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
              }
            }, 50);
          } else {
            setErrorMsg(data.error || "No se pudo transcribir el audio.");
          }
        } catch (e) {
          console.error("Transcribe error", e);
          setErrorMsg("Error de conexión al transcribir voz.");
        } finally {
          setIsTranscribing(false);
        }
      };

      originalPromptRef.current = prompt;
      mediaRecorder.start();
      setIsListening(true);
      
    } catch (e) {
      console.error(e);
      alert("No se pudo acceder al micrófono. Asegúrate de dar los permisos a la aplicación o navegador.");
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setErrorMsg(null);
    setLastModel(null);

    const abortController = new AbortController();
    const clientTimeout = setTimeout(() => abortController.abort(), 100_000);

    try {
      const fd = new FormData();
      fd.append("prompt", prompt);
      fd.append("useAgencyIdentity", String(useAgencyIdentity));
      fd.append("useAgencyCharacter", String(useAgencyCharacter));
      refImages.forEach((file, i) => fd.append(`ref_${i}`, file));

      const res = await fetch("/api/ai/generate", { 
        method: "POST", 
        body: fd,
        signal: abortController.signal,
      });
      const data = await res.json();

      if (res.ok) {
        // Se deja intacto el prompt y las refImages (Opción 1)
        setLastModel(data.model || null);
        loadHistory();
      } else {
        if (res.status === 402) {
          setErrorMsg(`No tienes suficientes créditos. Tienes ${data.credits} y necesitas ${data.cost || totalCost}. Recarga en la tienda.`);
        } else {
          setErrorMsg(data.error || "Error en la generación. Intenta de nuevo.");
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setErrorMsg("La generación tardó demasiado (>100s). Intenta con un prompt más corto.");
      } else {
        setErrorMsg("Error interno conectando con el servidor.");
      }
    } finally {
      clearTimeout(clientTimeout);
      setGenerating(false);
    }
  };

  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Fallo en fetch");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const deleteImage = async (imageId: string) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/ai/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      const data = await res.json();
      if (data.success) {
        setImages(prev => prev.filter(img => img.id !== imageId));
        setDeleteConfirm(null);
      } else {
        alert(data.error || "Error eliminando imagen.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al eliminar.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRetry = (img: any) => {
    setPrompt(img.prompt);
    setTimeout(() => {
      const textarea = document.getElementById("prompt-input");
      if (textarea) {
        textarea.scrollIntoView({ behavior: "smooth", block: "center" });
        textarea.focus();
      }
    }, 100);
  };

  return (
    <VipGate>
      <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="animate-slide-down">
          <h1 className="text-lg font-semibold text-white/90 tracking-tight">Estudio IA</h1>
          <p className="text-sm text-white/30 mt-1">Escribe tu idea y la IA la pintará en segundos.</p>
        </div>

        {/* Generation Panel */}
        <div className="bg-[#141414] rounded-lg border border-white/[0.06] p-5 sm:p-6 animate-slide-up">

          {/* Model indicator + cost */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${refImages.length > 0
                ? 'bg-purple-500/10 text-purple-300'
                : 'bg-[#FFDE00]/[0.06] text-[#FFDE00]/70'
              }`}>
              <Sparkles className="w-3 h-3" />
              {refImages.length > 0 ? 'Nano Pro' : 'Nano Banana'}
            </div>
            <div className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${totalCost > 100
                ? 'bg-purple-500/10 border-purple-500/15 text-purple-300'
                : 'bg-white/[0.04] border-white/[0.06] text-zinc-500'
              }`}>
              {totalCost} créditos
              {useAgencyCharacter && <span className="ml-1 text-[10px] opacity-70">(+50)</span>}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-5 bg-red-500/10 text-red-400 p-3.5 rounded-lg border border-red-500/15 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          {lastModel && (
            <div className="mb-5 bg-emerald-500/10 text-emerald-400 p-3 rounded-lg border border-emerald-500/15 text-sm font-medium flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 shrink-0" /> Imagen generada con {lastModel}
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-5">

            {/* Switches */}
            <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg overflow-hidden divide-y divide-white/[0.06]">
              {/* Agency Identity */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors" 
                onClick={() => setUseAgencyIdentity(!useAgencyIdentity)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${useAgencyIdentity ? 'bg-[#FFDE00]/10 text-[#FFDE00]' : 'bg-white/[0.04] text-zinc-600'}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${useAgencyIdentity ? 'text-white' : 'text-zinc-500'}`}>Identidad de Agencia</p>
                    <p className="text-xs text-zinc-600 mt-0.5">Incluye tus estilos y logos.</p>
                  </div>
                </div>
                <div className={`w-10 h-5.5 rounded-full relative transition-colors ${useAgencyIdentity ? 'bg-[#FFDE00]' : 'bg-zinc-800 border border-white/[0.1]'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform shadow-sm ${useAgencyIdentity ? 'translate-x-[18px]' : 'translate-x-0'}`}></div>
                </div>
              </div>

              {/* Character */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors" 
                onClick={() => setUseAgencyCharacter(!useAgencyCharacter)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${useAgencyCharacter ? 'bg-purple-500/10 text-purple-400' : 'bg-white/[0.04] text-zinc-600'}`}>
                    <UserCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm ${useAgencyCharacter ? 'text-white' : 'text-zinc-500'}`}>Personaje Representante</p>
                      {useAgencyCharacter && <span className="bg-purple-500/10 text-purple-400 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-purple-500/15">+50</span>}
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">Incluye a tu representante.</p>
                  </div>
                </div>
                <div className={`w-10 h-5.5 rounded-full relative transition-colors ${useAgencyCharacter ? 'bg-purple-500' : 'bg-zinc-800 border border-white/[0.1]'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform shadow-sm ${useAgencyCharacter ? 'translate-x-[18px]' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </div>


            {/* Consolidated Input Area (Estilo Chat) */}
            <div className="relative bg-[#0A0A0A] border border-white/[0.08] rounded-[28px] focus-within:border-[#FFDE00]/30 transition-colors shadow-inner flex flex-col">
              
              {/* Preview de Imágenes Referencia */}
              {refImages.length > 0 && (
                <div className="flex flex-wrap gap-2.5 p-3 px-5 pb-0">
                  {refImages.map((file, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/[0.08] group/img">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Ref"
                        className="w-full h-full object-cover group-hover/img:opacity-70 transition-opacity"
                      />
                      <button
                        type="button"
                        onClick={() => removeRefImage(i)}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 p-2 relative">
                {/* Attach Menu Wrapper */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 transition-colors ml-1 mt-1"
                  >
                    <Plus className="w-6 h-6" />
                  </button>

                  {/* Dropup Menu */}
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-3 bg-[#1A1A1A] border border-white/[0.08] rounded-2xl shadow-xl w-48 overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-4 duration-200">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false);
                          refInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors"
                      >
                        <Paperclip className="w-4 h-4 text-zinc-400" />
                        Agregar fotos
                      </button>
                    </div>
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  id="prompt-input"
                  value={prompt}
                  onChange={e => {
                    setPrompt(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                  }}
                  onFocus={() => setShowAttachMenu(false)}
                  placeholder="Describe tu imagen aquí"
                  className="w-full bg-transparent text-white/90 focus:outline-none !outline-none !ring-0 focus:!ring-0 !border-0 focus:!border-0 !shadow-none focus:!shadow-none resize-none py-3 min-h-[44px] max-h-[150px] text-[15px] placeholder-zinc-500 custom-scrollbar"
                  style={{ height: '44px' }}
                />

                {/* Actions (Mic ONLY inside the pill) */}
                <div className="flex items-center gap-1 shrink-0 p-1">
                  {isTranscribing ? (
                    <button
                      type="button"
                      className="h-10 px-4 rounded-full bg-blue-500/10 text-blue-400 transition-colors flex items-center gap-2 text-sm font-medium animate-pulse cursor-wait"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Traduciendo</span>
                    </button>
                  ) : isListening ? (
                    <button
                      type="button"
                      onClick={toggleVoiceMode}
                      className="h-10 px-4 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors flex items-center gap-2 text-sm font-medium animate-pulse"
                    >
                      <Mic className="w-4 h-4" />
                      <span className="hidden sm:inline">Parar (Grabando)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleVoiceMode}
                      className="h-10 px-4 rounded-full bg-white/5 text-white/80 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Mic className="w-4 h-4" />
                      <span className="hidden sm:inline">Voz</span>
                    </button>
                  )}
                </div>

                <input
                  ref={refInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    handleRefImageChange(e);
                    setShowAttachMenu(false);
                  }}
                />
              </div>
            </div>

            {/* Generar Button (Debajo del pill) */}
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={generating || !prompt.trim()}
                className={`h-11 px-8 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 text-sm font-semibold
                  ${prompt.trim() && !generating 
                    ? 'bg-[#FFDE00] text-black hover:brightness-110 shadow-[0_0_15px_rgba(255,222,0,0.3)] animate-glow' 
                    : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                  }`}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generar</span>
                  </>
                )}
              </button>
            </div>


            {/* Loading State */}
            {generating && (
              <div className="flex items-center justify-center p-8 border border-white/[0.06] rounded-xl bg-[#09090b] overflow-hidden relative animate-scale-in">
                <div className="absolute inset-0 bg-[#FFDE00]/[0.03] animate-pulse"></div>
                <div className="flex flex-col items-center text-center space-y-3 z-10">
                  <Loader2 className="w-10 h-10 animate-spin text-[#FFDE00]" />
                  <h3 className="font-semibold text-white text-lg">Generando tu imagen...</h3>
                  <p className="text-sm text-zinc-500 max-w-md">
                    {refImages.length > 0
                      ? 'Analizando referencias y generando. 20–40 segundos.'
                      : 'Renderizando. 10–20 segundos.'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFDE00] animate-pulse-subtle"></div>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-zinc-600">{elapsedSec}s</span>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* History Section */}
        <div className="pt-6 border-t border-white/[0.06] animate-fade-in">
          <div>
            <h2 className="text-base font-semibold text-white/80">Historial</h2>
            {!loadingHistory && (
              <span className="text-sm text-zinc-500 mt-0.5">
                {images.length} {images.length === 1 ? 'imagen' : 'imágenes'} generadas
              </span>
            )}
          </div>
        </div>

        {/* Image Gallery */}
        {loadingHistory ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#FFDE00]" /></div>
        ) : images?.length === 0 ? (
          <div className="bg-[#141414] border border-white/[0.06] rounded-lg p-12 flex flex-col items-center justify-center text-center animate-scale-in">
            <ImageIcon className="w-12 h-12 text-zinc-700 mb-3 animate-float" />
            <h3 className="text-base font-semibold text-zinc-500">Sin imágenes aún</h3>
            <p className="text-zinc-600 mt-1 text-sm">Las imágenes que generes aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((img, idx) => (
              <div key={img.id} className={`bg-[#141414] rounded-lg overflow-hidden border border-white/[0.06] group relative flex flex-col hover:border-white/[0.12] transition-all duration-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-1 animate-card-enter stagger-${Math.min(idx + 1, 8)}`}>

                <div className="relative aspect-square w-full bg-[#09090b] flex items-center justify-center overflow-hidden">
                  <img src={img.image_url} alt="IA Art" className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-105" />
                </div>

                <div className="p-4 flex-1 flex flex-col z-10 border-t border-white/[0.06]">
                  <p className="text-xs font-medium text-zinc-400 line-clamp-3 leading-relaxed">
                    &quot;{img.prompt}&quot;
                  </p>

                  <div className="mt-auto">
                    {/* Action buttons 2x2 */}
                    <div className="grid grid-cols-2 gap-1.5 mt-4">
                      <button 
                        onClick={() => forceDownload(img.image_url, `zamtools_ia_${img.id.slice(0,6)}.png`)} 
                        className="bg-[#FFDE00]/10 hover:bg-[#FFDE00]/15 text-[#FFDE00] py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-semibold transition-colors border border-[#FFDE00]/15"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" /> Bajar
                      </button>
                      <button 
                        onClick={() => handleRetry(img)} 
                        className="bg-purple-500/10 hover:bg-purple-500/15 text-purple-400 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-semibold transition-colors border border-purple-500/15"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" /> Repetir
                      </button>
                      <button 
                        onClick={() => setLightboxUrl(img.image_url)} 
                        className="bg-white/[0.04] hover:bg-white/[0.06] text-zinc-400 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-semibold transition-colors border border-white/[0.06]"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" /> Ver
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(img.id)} 
                        className="bg-red-500/10 hover:bg-red-500/15 text-red-400 py-2 rounded-lg flex justify-center items-center gap-1.5 text-[10px] font-semibold border border-red-500/15 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" /> Borrar
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <img src={img.author_avatar_url || "https://ui-avatars.com/api/?name=Agente"} alt="Yo" className="w-6 h-6 rounded-full border border-white/[0.08]" />
                        <span className="text-[10px] font-medium text-zinc-400 truncate max-w-[80px]">{img.author_name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-medium">
                        {formatDistanceToNow(new Date(img.created_at), { locale: es, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors z-50"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Vista completa"
            className="max-w-full max-h-[90vh] object-contain rounded-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111113] border border-white/[0.08] rounded-xl p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/15 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-white">¿Eliminar esta imagen?</h3>
            </div>
            <p className="text-zinc-500 text-sm mb-5">
              Esta acción es permanente y no se puede deshacer.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] text-zinc-400 rounded-lg font-medium text-sm border border-white/[0.06] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteImage(deleteConfirm)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </VipGate>
  );
}
