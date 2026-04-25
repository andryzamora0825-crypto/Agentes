"use client";

import { useState, useRef, useCallback } from "react";
import {
  X, Loader2, Scissors, ZoomIn, ImageIcon, Palette,
  Eraser, FileCode, Sun, Wand2, Download, Check, ArrowLeft, ChevronLeft, ChevronUp, ChevronDown, GripHorizontal
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

// ─── STYLE CATEGORIES ───
interface StyleCategory {
  id: string;
  label: string;
  emoji: string;
  subs: { id: string; label: string }[];
}

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    id: "anime", label: "Anime", emoji: "🎌",
    subs: [
      { id: "dragon-ball", label: "Dragon Ball Z" },
      { id: "one-piece", label: "One Piece" },
      { id: "naruto", label: "Naruto Shippuden" },
      { id: "bleach", label: "Bleach" },
      { id: "demon-slayer", label: "Demon Slayer" },
      { id: "jujutsu-kaisen", label: "Jujutsu Kaisen" },
      { id: "attack-on-titan", label: "Attack on Titan" },
      { id: "my-hero-academia", label: "My Hero Academia" },
      { id: "hunter-x-hunter", label: "Hunter × Hunter" },
      { id: "death-note", label: "Death Note" },
      { id: "fullmetal-alchemist", label: "Fullmetal Alchemist" },
      { id: "one-punch-man", label: "One Punch Man" },
      { id: "sword-art-online", label: "Sword Art Online" },
      { id: "tokyo-ghoul", label: "Tokyo Ghoul" },
      { id: "neon-genesis-evangelion", label: "Neon Genesis Evangelion" },
      { id: "cowboy-bebop", label: "Cowboy Bebop" },
      { id: "mob-psycho-100", label: "Mob Psycho 100" },
      { id: "chainsaw-man", label: "Chainsaw Man" },
      { id: "spy-x-family", label: "Spy × Family" },
      { id: "black-clover", label: "Black Clover" },
      { id: "fairy-tail", label: "Fairy Tail" },
      { id: "code-geass", label: "Code Geass" },
      { id: "steins-gate", label: "Steins;Gate" },
      { id: "violet-evergarden", label: "Violet Evergarden" },
      { id: "made-in-abyss", label: "Made in Abyss" },
      { id: "vinland-saga", label: "Vinland Saga" },
      { id: "dr-stone", label: "Dr. Stone" },
      { id: "fire-force", label: "Fire Force" },
      { id: "tokyo-revengers", label: "Tokyo Revengers" },
      { id: "re-zero", label: "Re:Zero" },
      { id: "konosuba", label: "KonoSuba" },
      { id: "overlord", label: "Overlord" },
      { id: "mushoku-tensei", label: "Mushoku Tensei" },
      { id: "dororo", label: "Dororo" },
      { id: "berserk", label: "Berserk" },
      { id: "inuyasha", label: "Inuyasha" },
      { id: "sailor-moon", label: "Sailor Moon" },
      { id: "cardcaptor-sakura", label: "Cardcaptor Sakura" },
      { id: "pokemon", label: "Pokémon" },
      { id: "digimon", label: "Digimon" },
      { id: "yu-gi-oh", label: "Yu-Gi-Oh!" },
      { id: "saint-seiya", label: "Saint Seiya" },
      { id: "slam-dunk", label: "Slam Dunk" },
      { id: "captain-tsubasa", label: "Captain Tsubasa" },
      { id: "initial-d", label: "Initial D" },
      { id: "hellsing", label: "Hellsing Ultimate" },
      { id: "solo-leveling", label: "Solo Leveling" },
      { id: "blue-lock", label: "Blue Lock" },
      { id: "oshi-no-ko", label: "Oshi no Ko" },
      { id: "frieren", label: "Frieren" },
    ]
  },
  {
    id: "3d-animation", label: "3D / Animación", emoji: "🧸",
    subs: [
      { id: "pixar", label: "Pixar" },
      { id: "disney-3d", label: "Disney 3D" },
      { id: "dreamworks", label: "DreamWorks" },
      { id: "illumination", label: "Illumination (Minions)" },
      { id: "clay-render", label: "Arcilla / Claymation" },
      { id: "toy-figure", label: "Figura de Juguete" },
      { id: "funko-pop", label: "Funko Pop" },
      { id: "lego-style", label: "Estilo LEGO" },
      { id: "unreal-engine", label: "Unreal Engine 5" },
      { id: "blender-render", label: "Blender Render" },
      { id: "isometric-3d", label: "Isométrico 3D" },
      { id: "low-poly", label: "Low Poly" },
    ]
  },
  {
    id: "comic", label: "Cómic / Cartoon", emoji: "💥",
    subs: [
      { id: "marvel", label: "Marvel Comics" },
      { id: "dc-comics", label: "DC Comics" },
      { id: "manga-bn", label: "Manga B/N Clásico" },
      { id: "simpson", label: "Los Simpsons" },
      { id: "family-guy", label: "Family Guy" },
      { id: "south-park", label: "South Park" },
      { id: "rick-morty", label: "Rick and Morty" },
      { id: "adventure-time", label: "Hora de Aventura" },
      { id: "cartoon-network", label: "Cartoon Network 90s" },
      { id: "disney-classic", label: "Disney Clásico 2D" },
      { id: "franco-belga", label: "Franco-Belga (Tintín)" },
      { id: "webtoon", label: "Webtoon Coreano" },
      { id: "caricatura", label: "Caricatura Exagerada" },
      { id: "chibi", label: "Chibi / SD" },
    ]
  },
  {
    id: "gaming", label: "Videojuegos", emoji: "🎮",
    subs: [
      { id: "pixel-art-8bit", label: "Pixel Art 8-bit" },
      { id: "pixel-art-16bit", label: "Pixel Art 16-bit" },
      { id: "gta-loading", label: "GTA Loading Screen" },
      { id: "fortnite", label: "Estilo Fortnite" },
      { id: "minecraft", label: "Minecraft Voxel" },
      { id: "zelda-botw", label: "Zelda: BOTW" },
      { id: "genshin-impact", label: "Genshin Impact" },
      { id: "dark-souls", label: "Dark Souls / Elden Ring" },
      { id: "cyberpunk-2077", label: "Cyberpunk 2077" },
      { id: "final-fantasy", label: "Final Fantasy" },
      { id: "league-of-legends", label: "League of Legends" },
      { id: "valorant", label: "Valorant" },
      { id: "retro-arcade", label: "Arcade Retro" },
    ]
  },
  {
    id: "art-classic", label: "Arte Clásico", emoji: "🎨",
    subs: [
      { id: "oleo", label: "Óleo sobre Lienzo" },
      { id: "acuarela", label: "Acuarela" },
      { id: "renacentista", label: "Renacentista" },
      { id: "barroco", label: "Barroco (Caravaggio)" },
      { id: "impresionista", label: "Impresionismo (Monet)" },
      { id: "van-gogh", label: "Van Gogh" },
      { id: "picasso", label: "Picasso / Cubismo" },
      { id: "da-vinci", label: "Leonardo da Vinci" },
      { id: "art-nouveau", label: "Art Nouveau (Mucha)" },
      { id: "art-deco", label: "Art Déco" },
      { id: "surrealismo", label: "Surrealismo (Dalí)" },
      { id: "ukiyoe", label: "Ukiyo-e Japonés" },
      { id: "vitral", label: "Vitral / Stained Glass" },
      { id: "mosaico", label: "Mosaico Romano" },
    ]
  },
  {
    id: "drawing", label: "Dibujo / Sketch", emoji: "✏️",
    subs: [
      { id: "lapiz", label: "Lápiz Grafito" },
      { id: "carbon", label: "Carboncillo" },
      { id: "tinta", label: "Tinta China" },
      { id: "pastel", label: "Pastel / Tiza" },
      { id: "lineart", label: "Line Art Limpio" },
      { id: "boceto-arquitecto", label: "Boceto de Arquitecto" },
      { id: "technical-drawing", label: "Dibujo Técnico" },
      { id: "fashion-sketch", label: "Sketch de Moda" },
      { id: "storyboard", label: "Storyboard" },
    ]
  },
  {
    id: "aesthetic", label: "Estéticas Modernas", emoji: "🌃",
    subs: [
      { id: "cyberpunk-neon", label: "Cyberpunk Neón" },
      { id: "vaporwave", label: "Vaporwave" },
      { id: "synthwave", label: "Synthwave / Retrowave" },
      { id: "dark-academia", label: "Dark Academia" },
      { id: "cottagecore", label: "Cottagecore" },
      { id: "y2k", label: "Y2K" },
      { id: "glitchcore", label: "Glitchcore" },
      { id: "steampunk", label: "Steampunk" },
      { id: "solarpunk", label: "Solarpunk" },
      { id: "gothic", label: "Gótico Oscuro" },
      { id: "kawaii", label: "Kawaii Pastel" },
      { id: "grunge", label: "Grunge / Distressed" },
      { id: "minimalist", label: "Minimalismo Clean" },
      { id: "brutalist", label: "Brutalismo" },
    ]
  },
  {
    id: "photo-styles", label: "Estilos Fotográficos", emoji: "📸",
    subs: [
      { id: "hdr-dramatic", label: "HDR Dramático" },
      { id: "analog-film", label: "Película Análoga 35mm" },
      { id: "polaroid", label: "Polaroid Vintage" },
      { id: "infrared", label: "Infrarrojo" },
      { id: "double-exposure", label: "Doble Exposición" },
      { id: "tilt-shift", label: "Tilt-Shift (Miniatura)" },
      { id: "long-exposure", label: "Larga Exposición" },
      { id: "noir-film", label: "Film Noir B/N" },
      { id: "lomography", label: "Lomografía" },
      { id: "cross-process", label: "Cross-Processing" },
    ]
  },
];

const LIGHT_OPTIONS = [
  { id: "neon", label: "🌃 Neón Nocturno" },
  { id: "golden", label: "🌅 Hora Dorada" },
  { id: "studio", label: "📸 Estudio Pro" },
  { id: "dramatic", label: "🎭 Dramática" },
  { id: "moonlight", label: "🌙 Luz de Luna" },
  { id: "underwater", label: "🌊 Submarino" },
  { id: "fire", label: "🔥 Fuego / Lava" },
  { id: "aurora", label: "🌌 Aurora Boreal" },
  { id: "candlelight", label: "🕯️ Velas" },
  { id: "fluorescent", label: "💡 Fluorescente Fría" },
  { id: "sunset-warm", label: "🌇 Atardecer Cálido" },
  { id: "disco", label: "🪩 Disco / Club" },
];

const MAGIC_TOOLS: MagicTool[] = [
  {
    id: "remove-bg", name: "Quitar Fondo", shortName: "Fondo",
    icon: <Scissors className="w-4 h-4" />, credits: 100,
    color: "text-emerald-400",
    activeClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Toma esta imagen exacta y ELIMINA completamente el fondo. Mantén ÚNICAMENTE al sujeto principal con un fondo 100% TRANSPARENTE. NO modifiques al sujeto.`
  },
  {
    id: "upscale", name: "Upscaler 4K", shortName: "4K",
    icon: <ZoomIn className="w-4 h-4" />, credits: 100,
    color: "text-blue-400",
    activeClass: "bg-blue-500/15 border-blue-500/30 text-blue-400 shadow-blue-500/5",
    prompt: `[INSTRUCCIÓN CRÍTICA]: REGENERA esta imagen idéntica en MÁXIMA RESOLUCIÓN (mínimo 2048x2048). Bordes definidos, texturas claras, colores vibrantes. NO cambies composición ni colores.`
  },
  {
    id: "replace-bg", name: "Nuevo Fondo", shortName: "Escena",
    icon: <ImageIcon className="w-4 h-4" />, credits: 100,
    color: "text-violet-400",
    activeClass: "bg-violet-500/15 border-violet-500/30 text-violet-400 shadow-violet-500/5",
    prompt: ""
  },
  {
    id: "style-transfer", name: "Filtro de Estilo", shortName: "Estilo",
    icon: <Palette className="w-4 h-4" />, credits: 100,
    color: "text-pink-400",
    activeClass: "bg-pink-500/15 border-pink-500/30 text-pink-400 shadow-pink-500/5",
    prompt: ""
  },
  {
    id: "inpainting", name: "Borrador Mágico", shortName: "Borrar",
    icon: <Eraser className="w-4 h-4" />, credits: 100,
    color: "text-amber-400",
    activeClass: "bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-amber-500/5",
    prompt: ""
  },
  {
    id: "vectorize", name: "Vectorizar SVG", shortName: "Vector",
    icon: <FileCode className="w-4 h-4" />, credits: 100,
    color: "text-cyan-400",
    activeClass: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400 shadow-cyan-500/5",
    prompt: `[INSTRUCCIÓN CRÍTICA]: Redibuja esta imagen como ilustración vectorial limpia: bordes definidos, colores sólidos planos, sin gradientes. Estilo logo/ícono SVG profesional.`
  },
  {
    id: "relight", name: "Re-iluminar", shortName: "Luz",
    icon: <Sun className="w-4 h-4" />, credits: 100,
    color: "text-orange-400",
    activeClass: "bg-orange-500/15 border-orange-500/30 text-orange-400 shadow-orange-500/5",
    prompt: ""
  },
];

// ─── BOTTOM SHEET SNAP POINTS ───
const SNAP_COLLAPSED = 0;   // just the tool bar
const SNAP_MID = 1;         // tools + options
const SNAP_EXPANDED = 2;    // full catalog

export default function EditorPRO({ image, onClose, onImageSaved }: EditorPROProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetSnap, setSheetSnap] = useState<number>(SNAP_COLLAPSED);

  const [bgPrompt, setBgPrompt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("");
  const [inpaintDesc, setInpaintDesc] = useState("");
  const [selectedLight, setSelectedLight] = useState("");
  const [magicPhrase, setMagicPhrase] = useState("");

  // Touch drag refs
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartSnap = useRef(0);

  const MAGIC_PHRASES = [
    "Analizando píxeles mágicos...",
    "Invocando inteligencia artificial...",
    "Aplicando transformación dimensional...",
    "Reconstruyendo la realidad visual...",
    "Finalizando obra maestra...",
  ];

  const getToolById = (id: string) => MAGIC_TOOLS.find(t => t.id === id);

  const getFullStyleLabel = (): string => {
    if (!selectedStyle) return "";
    for (const cat of STYLE_CATEGORIES) {
      const sub = cat.subs.find(s => s.id === selectedStyle);
      if (sub) return `${cat.label}: ${sub.label}`;
    }
    return selectedStyle;
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
    } catch (e) {
      console.error("Error al descargar:", e);
      // Fallback
      window.open(url, "_blank");
    }
  };

  const buildPrompt = (toolId: string): string | null => {
    const tool = getToolById(toolId);
    if (!tool) return null;
    switch (toolId) {
      case "replace-bg":
        if (!bgPrompt.trim()) { setError("Describe el nuevo fondo."); return null; }
        return `[INSTRUCCIÓN CRÍTICA]: PRESERVA al sujeto principal. REEMPLAZA el fondo por: "${bgPrompt}". Iluminación coherente.`;
      case "style-transfer":
        if (!selectedStyle) { setError("Selecciona un estilo."); return null; }
        const fullLabel = getFullStyleLabel();
        return `[INSTRUCCIÓN CRÍTICA]: TRANSFORMA esta imagen COMPLETAMENTE al estilo visual de "${fullLabel}". Usa exactamente la paleta de colores, trazo, sombreado y estética visual que caracterizan a "${fullLabel}". Mantén composición y poses, reinterprétala 100% en esa estética. El resultado DEBE ser inmediatamente reconocible como perteneciente a "${fullLabel}".`;
      case "inpainting":
        if (!inpaintDesc.trim()) { setError("Describe qué quieres borrar."); return null; }
        return `[INSTRUCCIÓN CRÍTICA]: BORRA/CORRIGE: "${inpaintDesc}". Rellena natural, fusionando con el entorno.`;
      case "relight":
        if (!selectedLight) { setError("Selecciona iluminación."); return null; }
        const light = LIGHT_OPTIONS.find(l => l.id === selectedLight)?.label || selectedLight;
        return `[INSTRUCCIÓN CRÍTICA]: CAMBIA la iluminación a: "${light}". Mismos sujetos y composición, transforma luces, sombras y reflejos cinematográficamente.`;
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
    setSheetSnap(SNAP_COLLAPSED);

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

  // ── Touch Drag Handlers ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartSnap.current = sheetSnap;
  }, [sheetSnap]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = dragStartY.current - e.changedTouches[0].clientY;
    const threshold = 50;

    if (deltaY > threshold) {
      // Swiped UP → expand
      setSheetSnap(prev => Math.min(prev + 1, SNAP_EXPANDED));
    } else if (deltaY < -threshold) {
      // Swiped DOWN → collapse
      setSheetSnap(prev => Math.max(prev - 1, SNAP_COLLAPSED));
    }
  }, []);

  const currentTool = activeTool ? getToolById(activeTool) : null;
  const displayUrl = resultUrl || image.image_url;
  const activeCategory = STYLE_CATEGORIES.find(c => c.id === selectedCategory);

  // Sheet height classes
  const sheetHeightClass =
    sheetSnap === SNAP_EXPANDED ? "max-h-[85vh]" :
    sheetSnap === SNAP_MID ? "max-h-[45vh]" :
    "max-h-[160px]";

  const needsExpand = activeTool === "style-transfer" || activeTool === "relight";

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

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Image Canvas */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden min-h-0">
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

        {/* ── Bottom Sheet ── */}
        <div
          ref={sheetRef}
          className={`shrink-0 border-t border-white/[0.06] bg-[#0c0c0e] rounded-t-2xl transition-all duration-300 ease-out ${sheetHeightClass} flex flex-col overflow-hidden`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag Handle */}
          <div
            className="flex flex-col items-center py-2 cursor-grab active:cursor-grabbing select-none shrink-0"
            onClick={() => setSheetSnap(prev => prev === SNAP_EXPANDED ? SNAP_COLLAPSED : prev + 1)}
          >
            <div className="w-10 h-1 rounded-full bg-white/[0.15] mb-1" />
            <div className="flex items-center gap-1">
              {sheetSnap < SNAP_EXPANDED ? (
                <ChevronUp className="w-3 h-3 text-zinc-600" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-600" />
              )}
              <span className="text-[9px] text-zinc-600 font-medium">
                {sheetSnap === SNAP_EXPANDED ? "Desliza para cerrar" : "Desliza para expandir"}
              </span>
            </div>
          </div>

          {/* Tool Selector (always visible) */}
          <div className="px-3 sm:px-5 pb-2 overflow-x-auto shrink-0">
            <div className="flex gap-1.5 sm:gap-2 min-w-max mx-auto justify-center">
              {MAGIC_TOOLS.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setActiveTool(tool.id);
                    setError(null);
                    setResultUrl(null);
                    setSelectedCategory(null);
                    setSelectedStyle("");
                    // Auto-expand for tools with many options
                    if (tool.id === "style-transfer" || tool.id === "relight") {
                      setSheetSnap(SNAP_MID);
                    } else {
                      setSheetSnap(SNAP_MID);
                    }
                  }}
                  disabled={processing}
                  className={`flex flex-col items-center gap-0.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border transition-all duration-200 min-w-[56px] sm:min-w-[68px] ${
                    activeTool === tool.id
                      ? `${tool.activeClass} shadow-lg`
                      : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                  } disabled:opacity-30`}
                >
                  {tool.icon}
                  <span className="text-[8px] sm:text-[10px] font-semibold leading-none whitespace-nowrap">{tool.shortName}</span>
                  <span className="text-[7px] sm:text-[8px] font-mono opacity-60">{tool.credits}c</span>
                </button>
              ))}
            </div>
          </div>

          {/* Expandable Content Area */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
            {activeTool && (
              <div className="px-4 sm:px-5 pb-4 pt-2">
                <div className="max-w-2xl mx-auto">

                  {/* Replace BG */}
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

                  {/* ── STYLE TRANSFER: Category → Subcategory ── */}
                  {activeTool === "style-transfer" && (
                    <div className="mb-3">
                      {!selectedCategory ? (
                        <>
                          {/* Category Chips (compact row, scrollable) */}
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-2 text-center">
                            Elige una categoría ({STYLE_CATEGORIES.reduce((a, c) => a + c.subs.length, 0)}+ estilos)
                          </p>

                          {sheetSnap < SNAP_EXPANDED ? (
                            /* Collapsed: show as horizontal scroll with "Ver todas" */
                            <>
                              <div className="flex gap-1.5 overflow-x-auto pb-1">
                                {STYLE_CATEGORIES.map(cat => (
                                  <button
                                    key={cat.id}
                                    onClick={() => { setSelectedCategory(cat.id); setSheetSnap(SNAP_EXPANDED); }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-pink-500/20 text-zinc-400 hover:text-pink-300 transition-all whitespace-nowrap shrink-0"
                                  >
                                    <span className="text-base">{cat.emoji}</span>
                                    <span className="text-[10px] font-semibold">{cat.label}</span>
                                    <span className="text-[8px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md">{cat.subs.length}</span>
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setSheetSnap(SNAP_EXPANDED)}
                                className="w-full mt-2 py-2 rounded-xl border border-dashed border-pink-500/20 text-pink-400/70 hover:text-pink-300 hover:border-pink-500/30 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                                Ver todas las categorías y estilos
                              </button>
                            </>
                          ) : (
                            /* Expanded: show as full grid */
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {STYLE_CATEGORIES.map(cat => (
                                <button
                                  key={cat.id}
                                  onClick={() => setSelectedCategory(cat.id)}
                                  className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-pink-500/[0.06] hover:border-pink-500/20 text-zinc-400 hover:text-pink-300 transition-all group"
                                >
                                  <span className="text-2xl group-hover:scale-110 transition-transform">{cat.emoji}</span>
                                  <span className="text-[11px] font-bold leading-tight text-center">{cat.label}</span>
                                  <span className="text-[9px] text-zinc-600 bg-white/[0.04] px-2 py-0.5 rounded-full">{cat.subs.length} estilos</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Subcategory Level */
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              onClick={() => { setSelectedCategory(null); setSelectedStyle(""); }}
                              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.06] px-2.5 py-1.5 rounded-lg border border-white/[0.06]"
                            >
                              <ChevronLeft className="w-3 h-3" />
                              Atrás
                            </button>
                            <span className="text-[11px] font-bold text-pink-400">{activeCategory?.emoji} {activeCategory?.label}</span>
                            <span className="text-[9px] text-zinc-600 ml-auto bg-white/[0.04] px-2 py-0.5 rounded-full">{activeCategory?.subs.length} estilos</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {activeCategory?.subs.map(sub => (
                              <button
                                key={sub.id}
                                onClick={() => setSelectedStyle(sub.id)}
                                className={`text-[10px] sm:text-[11px] py-2 px-3 rounded-lg border font-medium transition-all ${
                                  selectedStyle === sub.id
                                    ? "bg-pink-500/15 border-pink-500/30 text-pink-300 shadow-sm shadow-pink-500/5"
                                    : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                                }`}
                              >
                                {sub.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Inpainting */}
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

                  {/* Relight */}
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
                      <button
                        onClick={() => forceDownload(resultUrl, `EditorPRO_${Date.now()}.png`)}
                        className="shrink-0 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 transition-colors"
                        title="Descargar resultado"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!activeTool && (
              <div className="px-4 pb-4 pt-1 text-center">
                <p className="text-[11px] text-zinc-600">Selecciona una herramienta para transformar tu imagen</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
