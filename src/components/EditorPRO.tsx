"use client";

import { useState } from "react";
import {
  X, Loader2, Scissors, ZoomIn, ImageIcon, Palette,
  Eraser, FileCode, Sun, Wand2, Download, Check, ArrowLeft
} from "lucide-react";

interface EditorPROProps {
  image: {
    id: string;
    image_url: string;
    prompt: string;
    author_name?: string;
  };
  onClose: () => void;
  onImageSaved: () => void;
}

interface MagicTool {
  id: string;
  name: string;
  shortName: string;
  icon: React.ReactNode;
  credits: number;
  color: string;
  activeClass: string;
  prompt: string;
}

const MAGIC_TOOLS: MagicTool[] = [
  {
    id: "remove-bg",
    name: "Quitar Fondo",
    shortName: "Fondo",
    icon: <Scissors className="w-4 h-4" />,
    credits: 100,
    color: "text-emerald-400",
    activeClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta y ELIMINA completamente el fondo. Mantén ÚNICAMENTE al sujeto principal (persona, objeto, logo, personaje) con un fondo 100% TRANSPARENTE. La salida DEBE ser un PNG con canal alfa (transparencia). NO modifiques, redibuje ni alteres al sujeto en absoluto — solo remueve su fondo.`
  },
  {
    id: "upscale",
    name: "Upscaler 4K",
    shortName: "4K",
    icon: <ZoomIn className="w-4 h-4" />,
    credits: 150,
    color: "text-blue-400",
    activeClass: "bg-blue-500/15 border-blue-500/30 text-blue-400 shadow-blue-500/5",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta y REGENERA una versión idéntica pero en MÁXIMA RESOLUCIÓN y NITIDEZ posible (mínimo 2048x2048). Mejora todos los detalles: bordes más definidos, texturas más claras, colores más vibrantes. NO cambies la composición, los sujetos ni los colores base — solo mejora la calidad y resolución dramáticamente.`
  },
  {
    id: "replace-bg",
    name: "Nuevo Fondo",
    shortName: "Escena",
    icon: <ImageIcon className="w-4 h-4" />,
    credits: 200,
    color: "text-violet-400",
    activeClass: "bg-violet-500/15 border-violet-500/30 text-violet-400 shadow-violet-500/5",
    prompt: ""
  },
  {
    id: "style-transfer",
    name: "Filtro de Estilo",
    shortName: "Estilo",
    icon: <Palette className="w-4 h-4" />,
    credits: 200,
    color: "text-pink-400",
    activeClass: "bg-pink-500/15 border-pink-500/30 text-pink-400 shadow-pink-500/5",
    prompt: ""
  },
  {
    id: "inpainting",
    name: "Borrador Mágico",
    shortName: "Borrar",
    icon: <Eraser className="w-4 h-4" />,
    credits: 150,
    color: "text-amber-400",
    activeClass: "bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-amber-500/5",
    prompt: ""
  },
  {
    id: "vectorize",
    name: "Vectorizar SVG",
    shortName: "Vector",
    icon: <FileCode className="w-4 h-4" />,
    credits: 100,
    color: "text-cyan-400",
    activeClass: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400 shadow-cyan-500/5",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen y redibújala como una ilustración vectorial limpia y minimalista con bordes definidos, colores sólidos planos, y sin gradientes complejos ni texturas fotográficas. El resultado debe lucir como un logo o ícono vectorial SVG profesional, con contornos suaves y geometría precisa. Mantén los mismos colores principales y composición pero simplifícalos al estilo vector flat.`
  },
  {
    id: "relight",
    name: "Re-iluminar",
    shortName: "Luz",
    icon: <Sun className="w-4 h-4" />,
    credits: 150,
    color: "text-orange-400",
    activeClass: "bg-orange-500/15 border-orange-500/30 text-orange-400 shadow-orange-500/5",
    prompt: ""
  },
];

const STYLE_OPTIONS = [
  { id: "anime", label: "🎌 Anime" },
  { id: "pixar3d", label: "🧸 Pixar 3D" },
  { id: "cyberpunk", label: "🌃 Cyberpunk" },
  { id: "pencil", label: "✏️ Boceto" },
  { id: "watercolor", label: "🎨 Acuarela" },
  { id: "oilpainting", label: "🖼️ Óleo" },
  { id: "retro", label: "📺 Pixel Art" },
  { id: "comic", label: "💥 Cómic" },
];

const LIGHT_OPTIONS = [
  { id: "neon", label: "🌃 Neón" },
  { id: "golden", label: "🌅 Dorada" },
  { id: "studio", label: "📸 Estudio" },
  { id: "dramatic", label: "🎭 Dramática" },
  { id: "moonlight", label: "🌙 Lunar" },
  { id: "underwater", label: "🌊 Submarino" },
];

export default function EditorPRO({ image, onClose, onImageSaved }: EditorPROProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bgPrompt, setBgPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [inpaintDesc, setInpaintDesc] = useState("");
  const [selectedLight, setSelectedLight] = useState("");
  const [magicPhrase, setMagicPhrase] = useState("");

  const MAGIC_PHRASES = [
    "Analizando píxeles mágicos...",
    "Invocando inteligencia artificial...",
    "Aplicando transformación dimensional...",
    "Reconstruyendo la realidad visual...",
    "Finalizando obra maestra...",
  ];

  const getToolById = (id: string) => MAGIC_TOOLS.find(t => t.id === id);

  const buildPrompt = (toolId: string): string | null => {
    const tool = getToolById(toolId);
    if (!tool) return null;

    switch (toolId) {
      case "replace-bg":
        if (!bgPrompt.trim()) { setError("Describe el nuevo fondo."); return null; }
        return `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta. PRESERVA al sujeto principal sin modificarlo. REEMPLAZA ÚNICAMENTE el fondo por: "${bgPrompt}". Iluminación coherente.`;
      case "style-transfer":
        if (!selectedStyle) { setError("Selecciona un estilo."); return null; }
        const style = STYLE_OPTIONS.find(s => s.id === selectedStyle)?.label || selectedStyle;
        return `[INSTRUCCIÓN CRÍTICA]: TRANSFORMA esta imagen al estilo: "${style}". Mantén composición y poses, reinterprétala 100% en esa estética.`;
      case "inpainting":
        if (!inpaintDesc.trim()) { setError("Describe qué quieres borrar."); return null; }
        return `[INSTRUCCIÓN CRÍTICA]: Sin alterar nada más, BORRA/CORRIGE: "${inpaintDesc}". Rellena natural, fusionando con el entorno.`;
      case "relight":
        if (!selectedLight) { setError("Selecciona iluminación."); return null; }
        const light = LIGHT_OPTIONS.find(l => l.id === selectedLight)?.label || selectedLight;
        return `[INSTRUCCIÓN CRÍTICA]: CAMBIA la iluminación a: "${light}". Mismos sujetos y composición, transforma luces, sombras y reflejos. Resultado cinematográfico.`;
      default:
        return tool.prompt;
    }
  };

  const handleExecute = async () => {
    if (!activeTool) return;
    const prompt = buildPrompt(activeTool);
    if (!prompt) return;

    setProcessing(true);
    setError(null);
    setResultUrl(null);

    let phraseIdx = 0;
    setMagicPhrase(MAGIC_PHRASES[0]);
    const phraseInterval = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % MAGIC_PHRASES.length;
      setMagicPhrase(MAGIC_PHRASES[phraseIdx]);
    }, 3000);

    try {
      const res = await fetch("/api/ai/magic-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: activeTool,
          sourceImageUrl: image.image_url,
          prompt,
          credits: getToolById(activeTool)?.credits || 100,
        }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setResultUrl(data.imageUrl);
        onImageSaved();
      } else {
        setError(data.error || "Error al procesar la imagen.");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      clearInterval(phraseInterval);
      setProcessing(false);
    }
  };

  const currentTool = activeTool ? getToolById(activeTool) : null;
  const displayUrl = resultUrl || image.image_url;

  // Check if tool needs extra input
  const needsInput = activeTool === "replace-bg" || activeTool === "style-transfer" || activeTool === "inpainting" || activeTool === "relight";

  return (
    <div className="fixed inset-0 bg-[#09090b] z-50 flex flex-col overflow-hidden animate-fade-in">

      {/* ── Top Bar ── */}
      <div className="h-12 sm:h-14 px-4 sm:px-5 flex items-center justify-between border-b border-white/[0.06] bg-[#0f0f11]/90 backdrop-blur-xl shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-xs sm:text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Volver al Estudio</span>
          <span className="sm:hidden">Volver</span>
        </button>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#FFDE00]/10 to-[#FFB800]/10 border border-[#FFDE00]/15">
          <Wand2 className="w-3 h-3 text-[#FFDE00]" />
          <span className="text-[10px] sm:text-xs font-bold text-[#FFDE00]">Editor PRO</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Main: Image Center + Tools Bottom ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Image Canvas (centrado, ocupa todo el espacio disponible) */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden min-h-0">

          {/* Processing Overlay */}
          {processing && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 animate-fade-in">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#FFDE00]/20 border-t-[#FFDE00] animate-spin" />
                <Wand2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#FFDE00] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-xs sm:text-sm text-[#FFDE00] font-medium animate-pulse">{magicPhrase}</p>
              <p className="text-[10px] text-zinc-600">Esto puede tardar 20–60 segundos</p>
            </div>
          )}

          {/* Result badge */}
          {resultUrl && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 animate-scale-in">
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">Transformación Exitosa</span>
            </div>
          )}

          <img
            src={displayUrl}
            alt="Editor Canvas"
            className="max-w-full max-h-full object-contain rounded-xl border border-white/[0.06] shadow-2xl shadow-black/50"
          />
        </div>

        {/* ── Bottom Panel: Tools + Options ── */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0c0c0e]">

          {/* Tool Selector (horizontal scroll) */}
          <div className="px-3 sm:px-5 py-3 overflow-x-auto">
            <div className="flex gap-1.5 sm:gap-2 min-w-max mx-auto justify-center">
              {MAGIC_TOOLS.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => { setActiveTool(tool.id); setError(null); setResultUrl(null); }}
                  disabled={processing}
                  className={`flex flex-col items-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border transition-all duration-200 min-w-[64px] sm:min-w-[72px] ${
                    activeTool === tool.id
                      ? `${tool.activeClass} shadow-lg`
                      : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                  } disabled:opacity-30`}
                >
                  {tool.icon}
                  <span className="text-[9px] sm:text-[10px] font-semibold leading-none whitespace-nowrap">{tool.shortName}</span>
                  <span className="text-[8px] font-mono opacity-60">{tool.credits}c</span>
                </button>
              ))}
            </div>
          </div>

          {/* Options + Execute (appears when a tool is selected) */}
          {activeTool && (
            <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-white/[0.04]">
              <div className="max-w-xl mx-auto">

                {/* Tool-specific inputs */}
                {activeTool === "replace-bg" && (
                  <div className="mb-3">
                    <input
                      type="text"
                      value={bgPrompt}
                      onChange={e => setBgPrompt(e.target.value)}
                      placeholder='Describe el nuevo fondo: "Casino futurista con luces de neón"'
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-xs text-white/80 placeholder-zinc-700 focus:outline-none focus:border-violet-500/40"
                    />
                  </div>
                )}

                {activeTool === "style-transfer" && (
                  <div className="mb-3">
                    <div className="flex gap-1.5 flex-wrap justify-center">
                      {STYLE_OPTIONS.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStyle(s.id)}
                          className={`text-[10px] sm:text-[11px] py-1.5 px-2.5 rounded-lg border font-medium transition-all ${
                            selectedStyle === s.id
                              ? "bg-pink-500/15 border-pink-500/30 text-pink-300"
                              : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTool === "inpainting" && (
                  <div className="mb-3">
                    <input
                      type="text"
                      value={inpaintDesc}
                      onChange={e => setInpaintDesc(e.target.value)}
                      placeholder='¿Qué borrar? Ej: "La mano con 6 dedos" o "El texto borroso"'
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-xs text-white/80 placeholder-zinc-700 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                )}

                {activeTool === "relight" && (
                  <div className="mb-3">
                    <div className="flex gap-1.5 flex-wrap justify-center">
                      {LIGHT_OPTIONS.map(l => (
                        <button
                          key={l.id}
                          onClick={() => setSelectedLight(l.id)}
                          className={`text-[10px] sm:text-[11px] py-1.5 px-2.5 rounded-lg border font-medium transition-all ${
                            selectedLight === l.id
                              ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                              : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p className="text-[11px] text-red-400 mb-2 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/15 text-center">{error}</p>
                )}

                {/* Action Row */}
                <div className="flex gap-2 items-center">
                  <button
                    onClick={handleExecute}
                    disabled={processing}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#FFDE00] to-[#FFB800] text-black font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FFDE00]/10"
                  >
                    {processing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                    ) : (
                      <><Wand2 className="w-4 h-4" /> Aplicar {currentTool?.name} ({currentTool?.credits}c)</>
                    )}
                  </button>

                  {resultUrl && (
                    <a
                      href={resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="shrink-0 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 transition-colors"
                      title="Descargar resultado"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Hint when no tool selected */}
          {!activeTool && (
            <div className="px-4 pb-4 pt-1 text-center">
              <p className="text-[11px] text-zinc-600">Selecciona una herramienta para transformar tu imagen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
