"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Download, Image as ImageIcon, History, X, Plus, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import VipGate from "@/components/VipGate";

export default function EstudioIAPage() {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<File[]>([]);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setErrorMsg(null);
    setLastModel(null);
    try {
      // Usar FormData para enviar imágenes de referencia opcionales
      const fd = new FormData();
      fd.append("prompt", prompt);
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
            `No tienes suficientes créditos. Tienes ${data.credits} y necesitas ${data.cost || (refImages.length > 0 ? 150 : 100)}. Recarga en la tienda.`
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

  // Descarga forzada sorteando CORS
  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
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

      {/* Máquina Generadora */}
      <div className="bg-[#121212] rounded-3xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden">
         <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#FFDE00]/5 rounded-full blur-[100px] -z-10 translate-x-1/3 translate-y-1/3"></div>

         {/* Model Badge */}
         <div className="flex items-center gap-2 mb-5">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${
             refImages.length > 0
               ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
               : 'bg-[#FFDE00]/10 border-[#FFDE00]/20 text-[#FFDE00]'
           }`}>
             <span>🍌</span>
             {refImages.length > 0 ? 'Nano Banana Pro — Con Referencia' : 'Nano Banana 2 — Texto a Imagen'}
           </div>
           <div className={`ml-auto text-xs font-black px-3 py-1.5 rounded-full border transition-all ${
             refImages.length > 0
               ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
               : 'bg-white/5 border-white/10 text-gray-400'
           }`}>
             Costo: {refImages.length > 0 ? '150' : '100'} créditos
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
             <div className="flex items-center gap-2 mb-3">
               <ImageIcon className="w-4 h-4 text-gray-500" />
               <span className="text-xs text-gray-500 font-black uppercase tracking-widest">Imágenes de referencia (opcional, máx. 3)</span>
               {refImages.length < 3 && (
                 <button
                   type="button"
                   onClick={() => refInputRef.current?.click()}
                   className="ml-auto flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-[#FFDE00] transition-colors px-3 py-1.5 bg-white/5 hover:bg-[#FFDE00]/10 border border-white/10 hover:border-[#FFDE00]/30 rounded-lg"
                 >
                   <Plus className="w-3.5 h-3.5" /> Agregar
                 </button>
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
                   Sube una imagen para que Nano Banana Pro la use como referencia de estilo o personaje
                 </p>
                 <p className="text-[10px] text-gray-700 mt-1 uppercase tracking-widest">JPG · PNG · WEBP</p>
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
                <img src={img.image_url} alt="IA Art" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 group-hover:opacity-60" />
                
                {/* Botón Flotante para Descargar */}
                <button 
                  onClick={() => forceDownload(img.image_url, `ecuabet_ia_${img.id.slice(0,6)}.png`)}
                  className="absolute inset-x-0 bottom-6 mx-auto w-max bg-[#FFDE00] text-black font-black uppercase tracking-widest text-xs px-6 py-3 rounded-full flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-[#FFC107] hover:scale-105 cursor-pointer shadow-[0_0_20px_rgba(255,222,0,0.4)] z-20 translate-y-4 group-hover:translate-y-0"
                >
                  <Download className="w-4 h-4" /> Guardar HD
                </button>
              </div>

              <div className="p-5 bg-[#121212] flex-1 flex flex-col justify-between z-10 border-t border-white/5">
                <p className="text-sm font-medium text-gray-300 line-clamp-3 italic leading-relaxed">
                  "{img.prompt}"
                </p>
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
    </VipGate>
  );
}
