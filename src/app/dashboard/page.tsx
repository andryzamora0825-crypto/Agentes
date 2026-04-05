"use client";

import { useState, useRef, useCallback } from "react";
import VipGate from "@/components/VipGate";
import {
  FileText,
  UploadCloud,
  Copy,
  Check,
  Loader2,
  ImageIcon,
  X,
  Hash,
  KeyRound,
  Zap,
} from "lucide-react";

interface ExtractedData {
  nota: string | null;
  clave: string | null;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
        copied
          ? "bg-green-500/20 text-green-400 border-green-500/50"
          : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" /> Copiado
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" /> Copiar
        </>
      )}
    </button>
  );
}

export default function DashboardPage() {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setFileName(f.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped && dropped.type.startsWith("image/")) handleFile(dropped);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setFileName(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/nota-retiro", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar la imagen.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <VipGate>
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 relative">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#FFDE00]/20 rounded-full blur-[60px] -z-10"></div>
        <div className="p-3.5 bg-[#FFDE00] border border-[#FFDE00]/50 rounded-2xl shadow-[0_0_15px_rgba(255,222,0,0.3)]">
          <FileText className="w-7 h-7 text-black" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">Notas de Retiro</h1>
          <p className="text-gray-400 mt-0.5">Sube una imagen para extraer rápidamente su número y clave usando Inteligencia Artificial.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: IA Extractor Tool */}
        <div className="space-y-6">
          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !preview && inputRef.current?.click()}
            className={`relative w-full rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
              ${dragging
                ? "border-[#FFDE00] bg-[#FFDE00]/5 scale-[1.01] shadow-[0_0_30px_rgba(255,222,0,0.1)]"
                : preview
                ? "border-white/5 bg-[#121212] cursor-default"
                : "border-white/10 bg-[#121212] hover:border-[#FFDE00]/40 hover:bg-[#18181b] hover:shadow-[0_0_20px_rgba(255,222,0,0.05)]"
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onInputChange}
            />

            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Nota de retiro"
                  className="w-full max-h-72 object-contain bg-black/50"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  className="absolute top-3 right-3 p-1.5 bg-black/80 border border-white/10 hover:bg-red-500/80 hover:border-red-500 text-white rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="px-4 py-3 border-t border-white/5 bg-[#121212] flex items-center gap-2 text-xs text-gray-400">
                  <ImageIcon className="w-3.5 h-3.5 text-[#FFDE00]" />
                  <span className="truncate">{fileName}</span>
                </div>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center gap-4">
                <div className="p-4 bg-[#FFDE00]/10 rounded-2xl border border-[#FFDE00]/20 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,222,0,0.1)]">
                  <UploadCloud className="w-10 h-10 text-[#FFDE00]" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-lg drop-shadow-sm">Arrastra tu comprobante aquí</p>
                  <p className="text-gray-400 text-sm mt-1">o haz clic para seleccionar la foto</p>
                </div>
                <span className="text-xs text-gray-400 font-bold px-3 py-1 bg-black/50 rounded-full border border-white/5 uppercase tracking-wider">
                  JPG, PNG, WEBP
                </span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          {file && !loading && !result && (
            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl bg-[#FFDE00] text-black font-black text-base hover:bg-[#FFC107] hover:shadow-[0_0_20px_rgba(255,222,0,0.4)] transition-all shadow-lg hover:scale-[1.01] uppercase tracking-widest drop-shadow-sm flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" /> Extraer Datos con OpenAI
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="w-full py-8 flex flex-col items-center gap-3 rounded-2xl bg-[#121212] border border-white/5 shadow-2xl">
              <Loader2 className="w-8 h-8 text-[#FFDE00] animate-spin drop-shadow-[0_0_10px_rgba(255,222,0,0.5)]" />
              <p className="text-gray-400 font-medium text-sm">Nuestra IA está analizando la imagen...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/50 text-red-400 text-sm text-center font-bold">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-2xl bg-[#121212] border border-white/5 overflow-hidden shadow-2xl relative animate-in slide-in-from-bottom-4 duration-500">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -z-10"></div>
              <div className="px-6 py-4 border-b border-white/5 bg-black/30 flex items-center gap-2">
                <div className="bg-green-500/20 p-1.5 rounded-full border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-sm font-bold text-gray-300">Lectura Completada</span>
              </div>

              <div className="p-6 space-y-4">
                {/* Nota No */}
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-black/50 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-2.5 bg-[#FFDE00]/10 rounded-lg shrink-0 border border-[#FFDE00]/20">
                      <Hash className="w-5 h-5 text-[#FFDE00]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-1">Nota de Retiro No.</p>
                      <p className="text-2xl font-extrabold text-white tracking-wide font-mono truncate drop-shadow-md">
                        {result.nota ?? <span className="text-gray-600 font-normal text-sm italic">No encontrado</span>}
                      </p>
                    </div>
                  </div>
                  {result.nota && <CopyButton value={result.nota} />}
                </div>

                {/* Clave */}
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-black/50 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-2.5 bg-[#FFDE00]/10 rounded-lg shrink-0 border border-[#FFDE00]/20">
                      <KeyRound className="w-5 h-5 text-[#FFDE00]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-1">Clave / Código</p>
                      <p className="text-2xl font-extrabold text-white tracking-wide font-mono truncate drop-shadow-md">
                        {result.clave ?? <span className="text-gray-600 font-normal text-sm italic">No encontrado</span>}
                      </p>
                    </div>
                  </div>
                  {result.clave && <CopyButton value={result.clave} />}
                </div>
              </div>

              <div className="px-6 pb-6 pt-2">
                <button
                  onClick={clearFile}
                  className="w-full py-3.5 rounded-xl border border-white/10 text-gray-400 font-bold hover:text-white hover:border-[#FFDE00]/50 hover:bg-[#FFDE00]/10 hover:shadow-[0_0_15px_rgba(255,222,0,0.1)] transition-all text-sm uppercase tracking-widest"
                >
                  Cargar Otro Comprobante
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Ecuabet Embedded Viewer */}
        <div className="bg-[#121212] border border-white/10 rounded-3xl overflow-hidden shadow-2xl h-full min-h-[700px] flex flex-col relative group">
          <div className="px-5 py-4 bg-black/80 border-b border-white/10 flex items-center justify-between backdrop-blur-md">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <span className="text-white font-black text-sm tracking-widest uppercase">Sistema Caja Ecuabet</span>
             </div>
             <a href="https://caja.ecuabet.com/#!/top/pagoNotaRetiro" target="_blank" rel="noreferrer" className="text-xs font-bold text-[#FFDE00] bg-[#FFDE00]/10 hover:bg-[#FFDE00]/20 px-3 py-1.5 rounded-full transition-colors border border-[#FFDE00]/30 shadow-[0_0_10px_rgba(255,222,0,0.1)]">
               Abrir Externamente
             </a>
          </div>
          <div className="flex-1 w-full bg-[#0d0d0d] relative overflow-hidden">
            {/* Loading placeholder underneath iframe */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-0">
               <Loader2 className="w-10 h-10 text-[#FFDE00] animate-spin mb-4" />
               <span className="text-gray-400 font-bold tracking-widest text-sm uppercase">Cargando Plataforma...</span>
            </div>
            {/* The actual scaled iframe */}
            <div className="absolute top-0 left-0 z-10 origin-top-left w-[200%] h-[200%] scale-[0.5] sm:w-[150%] sm:h-[150%] sm:scale-[0.66] lg:w-[170%] lg:h-[170%] lg:scale-[0.588] transition-transform">
              <iframe 
                src="https://caja.ecuabet.com/#!/top/pagoNotaRetiro" 
                className="w-full h-full border-none bg-white"
                title="Caja Ecuabet Viewer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </VipGate>
  );
}
