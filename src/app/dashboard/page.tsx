"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import VipGate from "@/components/VipGate";
import {
  FileText, UploadCloud, Copy, Check, Loader2, ImageIcon, X,
  Hash, KeyRound, Zap, Clipboard, ArrowLeft, RefreshCw
} from "lucide-react";

interface ExtractedData { nota: string | null; clave: string | null; }

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(value); } catch {
      const ta = document.createElement("textarea"); ta.value = value;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${copied ? "text-emerald-400 bg-emerald-400/10" : "text-white/30 hover:text-white/50 bg-white/[0.04] hover:bg-white/[0.06]"}`}>
      {copied ? "Copiado ✓" : "Copiar"}
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
  const [iframeRetirosKey, setIframeRetirosKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f); setFileName(f.name); setResult(null); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith("image/")) handleFile(dropped);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };

  const clearFile = () => {
    setFile(null); setPreview(null); setFileName(null); setResult(null); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) { e.preventDefault(); const f = item.getAsFile(); if (f) handleFile(f); break; }
    }
  }, [handleFile]);

  useEffect(() => { document.addEventListener('paste', handlePaste); return () => document.removeEventListener('paste', handlePaste); }, [handlePaste]);

  const handleSubmit = async () => {
    if (!file) return; setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/nota-retiro", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Error al procesar la imagen.");
      else setResult(data);
    } catch { setError("Error de red. Intenta de nuevo.");
    } finally { setLoading(false); }
  };

  return (
    <VipGate>
    <div className="p-5 sm:p-8 max-w-6xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-white/90 tracking-tight">Notas de Retiro</h1>
        <p className="text-sm text-white/30 mt-1">Sube un comprobante para extraer número y clave con IA.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left: Extractor */}
        <div className="space-y-4">

          {/* Upload */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !preview && inputRef.current?.click()}
            className={`w-full rounded-lg border transition-colors cursor-pointer overflow-hidden ${
              dragging ? "border-[#FFDE00]/40 bg-[#FFDE00]/[0.03]"
              : preview ? "border-white/[0.08] bg-[#141414] cursor-default"
              : "border-dashed border-white/[0.1] bg-[#141414] hover:border-white/[0.15]"
            }`}
          >
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />

            {preview ? (
              <div>
                <img src={preview} alt="Nota" className="w-full max-h-64 object-contain bg-black/30" />
                <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white/70 hover:text-white rounded-md transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-2 text-xs text-white/25">
                  <ImageIcon className="w-3 h-3" />
                  <span className="truncate">{fileName}</span>
                </div>
              </div>
            ) : (
              <div className="py-14 flex flex-col items-center gap-3">
                <UploadCloud className="w-8 h-8 text-white/15" />
                <div className="text-center">
                  <p className="text-sm text-white/50">Arrastra, selecciona o <span className="text-[#FFDE00]/70">pega (Ctrl+V)</span></p>
                  <p className="text-xs text-white/20 mt-1">JPG, PNG, WEBP</p>
                </div>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const clipboardItems = await navigator.clipboard.read();
                      for (const item of clipboardItems) {
                        const imageType = item.types.find(t => t.startsWith('image/'));
                        if (imageType) { const blob = await item.getType(imageType); handleFile(new File([blob], `pasted_${Date.now()}.png`, { type: imageType })); break; }
                      }
                    } catch {}
                  }}
                  className="text-xs text-white/25 hover:text-white/40 transition-colors px-3 py-1.5 border border-white/[0.06] rounded-md"
                >
                  <Clipboard className="w-3 h-3 inline mr-1.5" />Pegar imagen
                </button>
              </div>
            )}
          </div>

          {/* Submit */}
          {file && !loading && !result && (
            <button onClick={handleSubmit} className="w-full py-3 rounded-lg bg-[#FFDE00] text-black font-semibold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" /> Extraer Datos
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="w-full py-8 flex flex-col items-center gap-3 rounded-lg bg-[#141414] border border-white/[0.06]">
              <Loader2 className="w-6 h-6 text-[#FFDE00] animate-spin" />
              <p className="text-sm text-white/30">Analizando...</p>
            </div>
          )}

          {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/15 text-red-400 text-sm text-center">{error}</div>}

          {/* Result */}
          {result && (
            <div className="rounded-lg border border-white/[0.08] overflow-hidden animate-slide-up">
              <div className="px-4 py-3 border-b border-white/[0.06] bg-[#141414]">
                <span className="text-xs font-medium text-emerald-400">✓ Lectura completada</span>
              </div>
              <div className="p-4 space-y-3 bg-[#0F0F0F]">
                {[
                  { label: "Nota de Retiro", value: result.nota, icon: Hash },
                  { label: "Clave / Código", value: result.clave, icon: KeyRound },
                ].map((field, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-lg bg-[#141414] border border-white/[0.06]">
                    <div className="flex items-center gap-3 min-w-0">
                      <field.icon className="w-4 h-4 text-[#FFDE00]/50 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/20 uppercase tracking-wider">{field.label}</p>
                        <p className="text-lg font-semibold text-white/90 font-[family-name:var(--font-mono)] truncate">
                          {field.value ?? <span className="text-white/15 text-sm font-normal">No encontrado</span>}
                        </p>
                      </div>
                    </div>
                    {field.value && <CopyButton value={field.value} />}
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-white/[0.06] bg-[#141414]">
                <button onClick={clearFile} className="w-full py-2.5 rounded-md text-sm text-white/30 hover:text-white/50 border border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                  Cargar Otro Comprobante
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Ecuabet Viewer */}
        <div className="rounded-lg border border-white/[0.08] overflow-hidden h-[450px] sm:h-[650px] flex flex-col bg-[#141414]">
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-subtle" />
              <span className="text-xs text-white/50 font-medium hidden sm:inline">Caja Ecuabet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setIframeRetirosKey(k => k + 1)}
                className="text-[10px] sm:text-[10px] font-semibold text-zinc-400 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors border border-white/10 flex items-center gap-1.5 uppercase tracking-wider"
                title="Retroceder al inicio"
              >
                <ArrowLeft className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Atrás</span>
              </button>
              
              <button 
                onClick={() => setIframeRetirosKey(k => k + 1)}
                className="text-[10px] sm:text-[10px] font-semibold text-zinc-400 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors border border-white/10 flex items-center gap-1.5 uppercase tracking-wider"
                title="Recargar caja"
              >
                <RefreshCw className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Recargar</span>
              </button>

              <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block"></div>

              <a href="https://caja.ecuabet.com/#!/top/pagoNotaRetiro" target="_blank" rel="noreferrer" className="text-[10px] sm:text-[10px] font-semibold text-[#FFDE00] bg-[#FFDE00]/10 hover:bg-[#FFDE00]/20 px-2 py-1 rounded-md transition-colors border border-[#FFDE00]/30 flex items-center gap-1.5 uppercase tracking-wider">
                Abrir ↗
              </a>
            </div>
          </div>
          <div className="flex-1 relative bg-[#0A0A0A]" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="absolute inset-0 flex items-center justify-center z-0">
              <Loader2 className="w-5 h-5 text-white/15 animate-spin" />
            </div>
            <div className="absolute inset-0 z-10 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <iframe key={iframeRetirosKey} src="https://caja.ecuabet.com/#!/top/pagoNotaRetiro" className="w-full h-full border-none bg-white" title="Caja Ecuabet" />
            </div>
          </div>
        </div>
      </div>
    </div>
    </VipGate>
  );
}
