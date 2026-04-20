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
  onImageSaved: () => void; // refresh history after saving
}

interface MagicTool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  credits: number;
  color: string;
  bgColor: string;
  borderColor: string;
  prompt: string; // IA instruction
}

const MAGIC_TOOLS: MagicTool[] = [
  {
    id: "remove-bg",
    name: "Quitar Fondo",
    description: "Elimina el fondo y entrega un PNG transparente",
    icon: <Scissors className="w-4 h-4" />,
    credits: 100,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
    borderColor: "border-emerald-500/15",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta y ELIMINA completamente el fondo. Mantén ÚNICAMENTE al sujeto principal (persona, objeto, logo, personaje) con un fondo 100% TRANSPARENTE. La salida DEBE ser un PNG con canal alfa (transparencia). NO modifiques, redibuje ni alteres al sujeto en absoluto — solo remueve su fondo.`
  },
  {
    id: "upscale",
    name: "Upscaler 4K",
    description: "Triplica la resolución sin perder nitidez",
    icon: <ZoomIn className="w-4 h-4" />,
    credits: 150,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    borderColor: "border-blue-500/15",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta y REGENERA una versión idéntica pero en MÁXIMA RESOLUCIÓN y NITIDEZ posible (mínimo 2048x2048). Mejora todos los detalles: bordes más definidos, texturas más claras, colores más vibrantes. NO cambies la composición, los sujetos ni los colores base — solo mejora la calidad y resolución dramáticamente.`
  },
  {
    id: "replace-bg",
    name: "Nuevo Fondo",
    description: "Cambia el escenario sin tocar al sujeto",
    icon: <ImageIcon className="w-4 h-4" />,
    credits: 200,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 hover:bg-violet-500/20",
    borderColor: "border-violet-500/15",
    prompt: "" // dynamic — requires user input
  },
  {
    id: "style-transfer",
    name: "Filtro de Estilo",
    description: "Convierte a Anime, 3D, Cyberpunk y más",
    icon: <Palette className="w-4 h-4" />,
    credits: 200,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10 hover:bg-pink-500/20",
    borderColor: "border-pink-500/15",
    prompt: "" // dynamic — requires style selection
  },
  {
    id: "inpainting",
    name: "Borrador Mágico",
    description: "Borra imperfecciones y la IA rellena",
    icon: <Eraser className="w-4 h-4" />,
    credits: 150,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    borderColor: "border-amber-500/15",
    prompt: "" // dynamic — requires user description
  },
  {
    id: "vectorize",
    name: "Vectorizar SVG",
    description: "Convierte logos/diseños planos a vector",
    icon: <FileCode className="w-4 h-4" />,
    credits: 100,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20",
    borderColor: "border-cyan-500/15",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen y redibújala como una ilustración vectorial limpia y minimalista con bordes definidos, colores sólidos planos, y sin gradientes complejos ni texturas fotográficas. El resultado debe lucir como un logo o ícono vectorial SVG profesional, con contornos suaves y geometría precisa. Mantén los mismos colores principales y composición pero simplifícalos al estilo vector flat.`
  },
  {
    id: "relight",
    name: "Re-iluminar",
    description: "Cambia la luz: neón, estudio, atardecer...",
    icon: <Sun className="w-4 h-4" />,
    credits: 150,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    borderColor: "border-orange-500/15",
    prompt: "" // dynamic — requires lighting selection
  },
];

const STYLE_OPTIONS = [
  { id: "anime", label: "🎌 Anime" },
  { id: "pixar3d", label: "🧸 Pixar 3D" },
  { id: "cyberpunk", label: "🌃 Cyberpunk Neon" },
  { id: "pencil", label: "✏️ Boceto a Lápiz" },
  { id: "watercolor", label: "🎨 Acuarela" },
  { id: "oilpainting", label: "🖼️ Óleo Clásico" },
  { id: "retro", label: "📺 Retro Pixel Art" },
  { id: "comic", label: "💥 Cómic Americano" },
];

const LIGHT_OPTIONS = [
  { id: "neon", label: "🌃 Neón Nocturno" },
  { id: "golden", label: "🌅 Hora Dorada" },
  { id: "studio", label: "📸 Estudio Profesional" },
  { id: "dramatic", label: "🎭 Claroscuro Dramático" },
  { id: "moonlight", label: "🌙 Luz de Luna" },
  { id: "underwater", label: "🌊 Submarino" },
];

export default function EditorPRO({ image, onClose, onImageSaved }: EditorPROProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dynamic input states
  const [bgPrompt, setBgPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [inpaintDesc, setInpaintDesc] = useState("");
  const [selectedLight, setSelectedLight] = useState("");

  const [magicPhrase, setMagicPhrase] = useState("");

  const MAGIC_PHRASES = [
    "Analizando píxeles mágicos...",
    "Invocando la inteligencia artificial...",
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
        if (!bgPrompt.trim()) { setError("Describe el nuevo fondo que deseas."); return null; }
        return `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta. PRESERVA al sujeto principal (persona/objeto/personaje) sin modificarlo ni un solo píxel. REEMPLAZA ÚNICAMENTE el fondo/escenario por: "${bgPrompt}". El sujeto debe verse integrado naturalmente en el nuevo entorno, con iluminación coherente.`;
      case "style-transfer":
        if (!selectedStyle) { setError("Selecciona un estilo."); return null; }
        const style = STYLE_OPTIONS.find(s => s.id === selectedStyle)?.label || selectedStyle;
        return `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta y TRANSFÓRMALA completamente al estilo visual: "${style}". Mantén la misma composición, poses y elementos, pero reinterprétalos al 100% en la estética solicitada. El resultado debe parecer que fue creado originalmente en ese estilo artístico.`;
      case "inpainting":
        if (!inpaintDesc.trim()) { setError("Describe qué quieres borrar o corregir."); return null; }
        return `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta. Sin alterar nada más, BORRA/CORRIGE lo siguiente: "${inpaintDesc}". Rellena el área afectada de forma natural, fundiéndola con el entorno circundante para que el resultado sea invisible. NO modifiques ninguna otra parte de la imagen.`;
      case "relight":
        if (!selectedLight) { setError("Selecciona un tipo de iluminación."); return null; }
        const light = LIGHT_OPTIONS.find(l => l.id === selectedLight)?.label || selectedLight;
        return `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta y CAMBIA COMPLETAMENTE su iluminación a: "${light}". Mantén exactamente los mismos sujetos, composición y colores base, pero transforma todas las fuentes de luz, sombras y reflejos para que coincidan con la nueva atmósfera lumínica. El resultado debe sentirse cinematográfico.`;
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

    // Start magic phrases cycle
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
        onImageSaved(); // refresh the history
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

  return (
    <div className="fixed inset-0 bg-[#09090b]/98 z-50 flex flex-col animate-fade-in">

      {/* Top Bar */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-white/[0.06] bg-[#0f0f11]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Estudio
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FFDE00]/10 to-[#FFB800]/10 border border-[#FFDE00]/15">
            <Wand2 className="w-3.5 h-3.5 text-[#FFDE00]" />
            <span className="text-xs font-bold text-[#FFDE00]">Editor Mágico PRO</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-6 relative">
          {processing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4 animate-fade-in">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-[#FFDE00]/20 border-t-[#FFDE00] animate-spin" />
                <Wand2 className="w-7 h-7 text-[#FFDE00] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-sm text-[#FFDE00] font-medium animate-pulse">{magicPhrase}</p>
              <p className="text-[10px] text-zinc-600">Esto puede tardar 20–60 segundos</p>
            </div>
          )}

          <div className="relative max-w-2xl w-full">
            {/* Before/After labels */}
            {resultUrl && (
              <div className="absolute -top-8 left-0 flex items-center gap-2">
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest flex items-center gap-1">
                  <Check className="w-3 h-3" /> Resultado
                </span>
              </div>
            )}
            <img
              src={displayUrl}
              alt="Editor Canvas"
              className="w-full max-h-[70vh] object-contain rounded-xl border border-white/[0.06] shadow-2xl shadow-black/40"
            />
            {/* Prompt under image */}
            <p className="mt-3 text-[11px] text-zinc-600 text-center line-clamp-2 px-8">
              &quot;{image.prompt}&quot;
            </p>
          </div>
        </div>

        {/* Right: Tools Panel */}
        <div className="w-80 border-l border-white/[0.06] bg-[#0f0f11] flex flex-col overflow-hidden shrink-0">

          {/* Tools Header */}
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white/80">Herramientas Mágicas</h3>
            <p className="text-[10px] text-zinc-600 mt-0.5">Selecciona una transformación</p>
          </div>

          {/* Tools List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {MAGIC_TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => { setActiveTool(tool.id); setError(null); setResultUrl(null); }}
                disabled={processing}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${
                  activeTool === tool.id
                    ? `${tool.bgColor} ${tool.borderColor} ring-1 ring-white/[0.05]`
                    : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
                } disabled:opacity-40`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${activeTool === tool.id ? tool.bgColor : "bg-white/[0.04]"} ${tool.color}`}>
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${activeTool === tool.id ? tool.color : "text-zinc-300"}`}>
                      {tool.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 truncate">{tool.description}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                    activeTool === tool.id ? `${tool.bgColor} ${tool.color}` : "bg-white/[0.04] text-zinc-600"
                  }`}>
                    {tool.credits}c
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Dynamic Options Panel */}
          {activeTool && (
            <div className="p-4 border-t border-white/[0.06] bg-white/[0.01]">

              {/* Replace BG */}
              {activeTool === "replace-bg" && (
                <div className="mb-3">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5 block">Nuevo Escenario</label>
                  <input
                    type="text"
                    value={bgPrompt}
                    onChange={e => setBgPrompt(e.target.value)}
                    placeholder='Ej: "Casino futurista con luces de neón"'
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/80 placeholder-zinc-700 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              )}

              {/* Style Transfer */}
              {activeTool === "style-transfer" && (
                <div className="mb-3">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5 block">Estilo Visual</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STYLE_OPTIONS.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStyle(s.id)}
                        className={`text-[10px] py-2 px-2 rounded-lg border font-medium transition-all ${
                          selectedStyle === s.id
                            ? "bg-pink-500/15 border-pink-500/30 text-pink-300"
                            : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Inpainting */}
              {activeTool === "inpainting" && (
                <div className="mb-3">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5 block">¿Qué quieres borrar/corregir?</label>
                  <input
                    type="text"
                    value={inpaintDesc}
                    onChange={e => setInpaintDesc(e.target.value)}
                    placeholder='Ej: "La mano tiene 6 dedos" o "El texto del fondo"'
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/80 placeholder-zinc-700 focus:outline-none focus:border-amber-500/40"
                  />
                </div>
              )}

              {/* Relight */}
              {activeTool === "relight" && (
                <div className="mb-3">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5 block">Tipo de Iluminación</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LIGHT_OPTIONS.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setSelectedLight(l.id)}
                        className={`text-[10px] py-2 px-2 rounded-lg border font-medium transition-all ${
                          selectedLight === l.id
                            ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                            : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
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
                <p className="text-[11px] text-red-400 mb-2 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/15">{error}</p>
              )}

              {/* Execute Button */}
              <button
                onClick={handleExecute}
                disabled={processing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFDE00] to-[#FFB800] text-black font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FFDE00]/10"
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Aplicar {currentTool?.name} ({currentTool?.credits}c)</>
                )}
              </button>

              {/* Download result */}
              {resultUrl && (
                <a
                  href={resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="w-full mt-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar Resultado
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
