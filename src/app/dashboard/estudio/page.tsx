"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Loader2, Download, Image as ImageIcon, History, X, Plus, Zap, Eye, Trash2, Monitor, Smartphone, RectangleHorizontal, RectangleVertical, Square, UserCircle, Clipboard } from "lucide-react";
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
  const [useAgencyCharacter, setUseAgencyCharacter] = useState(true);
  const [imageFormat, setImageFormat] = useState('square');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Calcular costo dinámico
  const baseCost = refImages.length > 0 ? 150 : 100;
  const characterCost = useAgencyCharacter ? 50 : 0;
  const totalCost = baseCost + characterCost;

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/ai/history");
      const data = await res.json();
      if (data.success) {
        setImages(data.images);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Leer estado por defecto si el usuario lo guardó en la Configuración
  useEffect(() => {
    if (isLoaded && user && user.publicMetadata?.aiSettings) {
      const settings = user.publicMetadata.aiSettings as any;
      if (settings.aiEnabled !== undefined) {
        setUseAgencyIdentity(settings.aiEnabled);
      }
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

  // Paste image handler
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setRefImages(prev => [...prev, file].slice(0, 3));
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setErrorMsg(null);
    setLastModel(null);
    try {
      const fd = new FormData();
      fd.append("prompt", prompt);
      fd.append("useAgencyIdentity", String(useAgencyIdentity));
      fd.append("useAgencyCharacter", String(useAgencyCharacter));
      fd.append("imageFormat", imageFormat);
      refImages.forEach((file, i) => fd.append(`ref_${i}`, file));

      const res = await fetch("/api/ai/generate", { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok) {
        setPrompt("");
        setRefImages([]);
        setLastModel(data.model || null);
        loadHistory();
      } else {
        if (res.status === 402) {
          setErrorMsg(
            `No tienes suficientes créditos. Tienes ${data.credits} y necesitas ${data.cost || totalCost}. Recarga en la tienda.`
          );
        } else {
          setErrorMsg(data.error || "Nano Banana no respondió. Intenta de nuevo.");
        }
      }
    } catch (err) {
      setErrorMsg("Error interno conectando con el servidor.");
    } finally {
      setGenerating(false);
    }
  };

  // Descarga forzada sorteando CORS (Optimizado para Safari)
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
    } catch (err) {
      // Fallback nativo
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

  return (
    <VipGate>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-10">

        {/* Encabezado Principal */}
        <div className="relative">
          <div className="absolute top-0 left-0 w-32 h-32 bg-[#FFDE00]/20 rounded-full blur-[60px] -z-10"></div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
            <div className="bg-[#FFDE00] p-2 rounded-xl shadow-[0_0_15px_rgba(255,222,0,0.4)]">
              <Sparkles className="w-8 h-8 text-black" />
            </div>
            Estudio IA
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Escribe tu idea creativa y la IA la pintará en segundos — ahora con <span className="text-[#FFDE00] font-black">Nano Banana 🍌</span>.</p>
        </div>

        {/* Panel de Generación */}
        <div className="bg-[#121212] rounded-3xl border border-white/5 p-5 sm:p-8 shadow-2xl">
          {/* Indicador de Modelo Activo */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${refImages.length > 0
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                : 'bg-[#FFDE00]/10 border-[#FFDE00]/20 text-[#FFDE00]'
              }`}>
              <span>🍌</span>
              {refImages.length > 0 ? 'Nano Banana Pro — Con Referencia' : 'Nano Banana 2 — Texto a Imagen'}
            </div>
            <div className={`ml-auto text-xs font-black px-3 py-1.5 rounded-full border transition-all ${totalCost > 100
                ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                : 'bg-white/5 border-white/10 text-gray-400'
              }`}>
              Costo: {totalCost} créditos
              {useAgencyCharacter && <span className="ml-1 text-[10px] opacity-70">(+50 personaje)</span>}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-6 bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20 font-semibold text-sm">
              ⚠️ {errorMsg}
            </div>
          )}

          {lastModel && (
            <div className="mb-6 bg-green-500/10 text-green-400 p-3 rounded-xl border border-green-500/20 font-bold text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 shrink-0" /> ¡Imagen generada con {lastModel}!
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-4">

            {/* Switch de Identidad de Agencia */}
            <div className="flex items-center justify-between bg-black/40 border border-[#FFDE00]/10 rounded-2xl p-4 cursor-pointer hover:bg-black/60 transition-colors" onClick={() => setUseAgencyIdentity(!useAgencyIdentity)}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${useAgencyIdentity ? 'bg-[#FFDE00]/20 text-[#FFDE00]' : 'bg-white/5 text-gray-500'}`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className={`font-bold text-sm ${useAgencyIdentity ? 'text-white' : 'text-gray-400'}`}>Usar Identidad de mi Agencia</p>
                  <p className="text-xs text-gray-500">Inyecta tus logos, colores y datos al prompt automáticamente.</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full relative transition-colors ${useAgencyIdentity ? 'bg-[#FFDE00]' : 'bg-gray-700'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-black rounded-full transition-transform ${useAgencyIdentity ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </div>

            {/* Switch de Personaje de Agencia */}
            <div className="flex items-center justify-between bg-black/40 border border-purple-500/10 rounded-2xl p-4 cursor-pointer hover:bg-black/60 transition-colors" onClick={() => setUseAgencyCharacter(!useAgencyCharacter)}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${useAgencyCharacter ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-gray-500'}`}>
                  <UserCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className={`font-bold text-sm ${useAgencyCharacter ? 'text-white' : 'text-gray-400'}`}>Usar Personaje de Agencia</p>
                  <p className="text-xs text-gray-500">Incluye al representante/personaje de tu agencia en la imagen generada.</p>
                  <p className={`text-[10px] font-black mt-0.5 ${useAgencyCharacter ? 'text-purple-400' : 'text-gray-600'}`}>+50 créditos extra</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full relative transition-colors ${useAgencyCharacter ? 'bg-purple-500' : 'bg-gray-700'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-black rounded-full transition-transform ${useAgencyCharacter ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </div>

            {/* Selector de Formato de Imagen */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500 font-black uppercase tracking-widest">Formato de imagen</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {FORMAT_OPTIONS.map((fmt) => {
                  const selected = imageFormat === fmt.id;
                  const IconEl = fmt.icon === 'monitor' ? Monitor : fmt.icon === 'phone' ? Smartphone : fmt.icon === 'rect-h' ? RectangleHorizontal : fmt.icon === 'rect-v' ? RectangleVertical : Square;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setImageFormat(fmt.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${selected
                          ? 'bg-[#FFDE00]/10 border-[#FFDE00]/40 text-[#FFDE00] shadow-[0_0_12px_rgba(255,222,0,0.15)]'
                          : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
                        }`}
                    >
                      <IconEl className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase tracking-wider leading-tight">{fmt.label}</span>
                      <span className={`text-[9px] font-mono ${selected ? 'text-[#FFDE00]/70' : 'text-gray-600'}`}>{fmt.ratio}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-600 mt-2 ml-1">
                {FORMAT_OPTIONS.find(f => f.id === imageFormat)?.desc}
              </p>
            </div>

            {/* Prompt Textarea */}
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Ejemplo: Un león dorado con textura neon, arte digital hiperrealista, render 3D..."
                className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-2xl p-5 pr-40 focus:outline-none focus:ring-2 focus:ring-[#FFDE00] focus:border-transparent resize-none h-40 transition-all text-lg placeholder-gray-600 shadow-inner"
              />
              <button
                type="submit"
                disabled={generating || !prompt.trim()}
                className={`absolute bottom-5 right-5 font-black px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-300 disabled:opacity-50 active:scale-95 ${generating ? 'bg-white/10 text-gray-400' : 'bg-[#FFDE00] text-black hover:bg-[#FFC107] shadow-[0_0_20px_rgba(255,222,0,0.3)] hover:shadow-[0_0_30px_rgba(255,222,0,0.5)] hover:-translate-y-1'}`}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 fill-black" />
                    Crear
                  </>
                )}
              </button>
            </div>

            {/* Zona de Imágenes de Referencia (Opcional) */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500 font-black uppercase tracking-widest">Imágenes de referencia (opcional, máx. 3)</span>
                {refImages.length < 3 && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const clipboardItems = await navigator.clipboard.read();
                          for (const item of clipboardItems) {
                            const imageType = item.types.find(t => t.startsWith('image/'));
                            if (imageType) {
                              const blob = await item.getType(imageType);
                              const file = new File([blob], `pasted_${Date.now()}.png`, { type: imageType });
                              setRefImages(prev => [...prev, file].slice(0, 3));
                              break;
                            }
                          }
                        } catch {
                          // Fallback: el usuario puede usar Ctrl+V
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-purple-400 transition-colors px-3 py-1.5 bg-white/5 hover:bg-purple-500/10 border border-white/10 hover:border-purple-500/30 rounded-lg"
                    >
                      <Clipboard className="w-3.5 h-3.5" /> Pegar
                    </button>
                    <button
                      type="button"
                      onClick={() => refInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-[#FFDE00] transition-colors px-3 py-1.5 bg-white/5 hover:bg-[#FFDE00]/10 border border-white/10 hover:border-[#FFDE00]/30 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Subir
                    </button>
                  </div>
                )}
                <input
                  ref={refInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  onChange={handleRefImageChange}
                />
              </div>

              {refImages.length === 0 ? (
                <button
                  type="button"
                  onClick={() => refInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/10 hover:border-[#FFDE00]/30 rounded-xl p-5 text-center transition-all group hover:bg-[#FFDE00]/5"
                >
                  <ImageIcon className="w-7 h-7 text-gray-600 group-hover:text-[#FFDE00] mx-auto mb-2 transition-colors" />
                  <p className="text-xs text-gray-600 group-hover:text-gray-400 font-semibold transition-colors">
                    Sube o pega (Ctrl+V) una imagen para que Nano Banana Pro la use como referencia
                  </p>
                  <p className="text-[10px] text-gray-700 mt-1 uppercase tracking-widest">JPG · PNG · WEBP · O PEGA DESDE EL PORTAPAPELES</p>
                </button>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {refImages.map((file, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 group/img">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Ref"
                        className="w-full h-full object-cover group-hover/img:opacity-70 transition-opacity"
                      />
                      <button
                        type="button"
                        onClick={() => removeRefImage(i)}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] font-bold text-center text-gray-300 py-0.5 uppercase tracking-wider">
                        Ref {i + 1}
                      </div>
                    </div>
                  ))}
                  {refImages.length < 3 && (
                    <button
                      type="button"
                      onClick={() => refInputRef.current?.click()}
                      className="w-24 h-24 rounded-xl border-2 border-dashed border-white/10 hover:border-[#FFDE00]/40 flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-[#FFDE00] transition-colors"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px] font-bold">Añadir</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Loader Detallado UI */}
            {generating && (
              <div className="flex items-center justify-center p-8 border border-white/10 rounded-2xl bg-black/50 overflow-hidden relative">
                <div className="absolute inset-0 bg-[#FFDE00]/10 animate-pulse"></div>
                <div className="flex flex-col items-center text-center space-y-3 z-10">
                  <Loader2 className="w-12 h-12 animate-spin text-[#FFDE00] drop-shadow-[0_0_10px_rgba(255,222,0,0.8)]" />
                  <h3 className="font-bold text-white text-xl drop-shadow-md">Nano Banana 🍌 pintando tu idea...</h3>
                  <p className="text-sm text-gray-400 max-w-md">
                    {refImages.length > 0
                      ? 'Nano Banana Pro está analizando tus imágenes de referencia y generando. Puede tomar 20–40 segundos.'
                      : 'Nano Banana 2 está renderizando los píxeles. Esto suele tomar de 10 a 20 segundos.'}
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Título Base de Datos (Row) */}
        <div className="flex items-center gap-3 pt-6 border-t border-white/10">
          <History className="w-6 h-6 text-[#FFDE00]" />
          <h2 className="text-2xl font-bold text-white tracking-tight">Registro de Imágenes Creadas</h2>
        </div>

        {/* Grid de Galería de Historial */}
        {loadingHistory ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#FFDE00]" /></div>
        ) : images?.length === 0 ? (
          <div className="bg-[#121212] border border-white/5 rounded-3xl p-16 flex flex-col items-center justify-center text-center shadow-xl">
            <ImageIcon className="w-16 h-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-500 tracking-tight">Aún no has generado ninguna carta visual.</h3>
            <p className="text-gray-600 mt-2 text-sm">Las imágenes que generes aparecerán aquí con su respectivo código fuente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map((img) => (
              <div key={img.id} className="bg-[#121212] rounded-3xl overflow-hidden shadow-2xl border border-white/5 group relative flex flex-col hover:border-[#FFDE00]/30 transition-colors">

                <div className="relative aspect-square w-full bg-black flex items-center justify-center">
                  <img src={img.image_url} alt="IA Art" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
                </div>

                <div className="p-5 bg-[#121212] flex-1 flex flex-col justify-between z-10 border-t border-white/5">
                  <p className="text-sm font-medium text-gray-300 line-clamp-3 italic leading-relaxed">
                    &quot;{img.prompt}&quot;
                  </p>

                  {/* Botones de acción siempre visibles (Fix para Safari / iOS) */}
                  <div className="flex items-center gap-2 mt-4">
                    <button 
                      onClick={() => setLightboxUrl(img.image_url)} 
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white p-2 rounded-xl flex justify-center items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors border border-white/10"
                    >
                      <Eye className="w-4 h-4" /> Ver
                    </button>
                    <button 
                      onClick={() => forceDownload(img.image_url, `ecuabet_ia_${img.id.slice(0,6)}.png`)} 
                      className="flex-1 bg-[#FFDE00]/10 hover:bg-[#FFDE00]/20 text-[#FFDE00] p-2 rounded-xl flex justify-center items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors border border-[#FFDE00]/20"
                    >
                      <Download className="w-4 h-4" /> Bajar
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm(img.id)} 
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl border border-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-5 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2">
                      <img src={img.author_avatar_url || "https://ui-avatars.com/api/?name=Agente"} alt="Yo" className="w-7 h-7 rounded-full border border-white/10" />
                      <span className="text-xs font-black text-white tracking-wide truncate max-w-[100px]">{img.author_name}</span>
                    </div>
                    <span className="text-[10px] text-[#FFDE00] shadow-[0_0_5px_rgba(255,222,0,0.1)] uppercase font-black tracking-widest bg-yellow-500/10 px-2 py-1 rounded">
                      {formatDistanceToNow(new Date(img.created_at), { locale: es, addSuffix: true })}
                    </span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* MODAL: Lightbox (Ver Imagen Completa) */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors z-50"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Vista completa"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* MODAL: Confirmación de Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/20 p-2.5 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-black text-white">¿Eliminar esta imagen?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Esta acción es permanente. La imagen será eliminada del servidor y no se podrá recuperar.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold text-sm border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteImage(deleteConfirm)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </VipGate>
  );
}
