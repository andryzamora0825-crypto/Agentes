"use client";

import { useState, useCallback } from "react";
import { Loader2, Sparkles, Trophy, Dices, ChevronRight, Check, X, AlertCircle, Clock, Zap, Square, Smartphone, Monitor, RectangleVertical, RectangleHorizontal } from "lucide-react";

// Opciones de Formato
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


// ══════════════════════════════════════════════════════════════
// ARRAYS COMBINATORIOS — Modo "Auto-Generar Creativo"
// 30 opciones × 4 categorías = 810,000 combinaciones únicas
// ══════════════════════════════════════════════════════════════

const PROTAGONISTAS = [
  "Lionel Messi celebrando con los brazos abiertos y euforia total",
  "Cristiano Ronaldo ejecutando un tiro libre con concentración absoluta",
  "Vinícius Jr driblando a máxima velocidad con expresión de desafío",
  "Kendry Páez festejando un gol con la bandera de Ecuador",
  "Moisés Caicedo lanzando un grito de guerra tras recuperar el balón",
  "Enner Valencia corriendo hacia el arco con determinación implacable",
  "Neymar Jr haciendo una bicicleta espectacular ante el rival",
  "Kylian Mbappé acelerando por la banda a velocidad extrema",
  "Erling Haaland ejecutando un remate de cabeza contundente",
  "LeBron James clavando un balón de básquetbol con potencia brutal",
  "Stephen Curry lanzando un triple imposible desde media cancha",
  "Una ruleta de casino premium girando a toda velocidad en primer plano con chispas doradas",
  "Una baraja de Blackjack sobre mesa terciopelo verde con fichas apiladas y luz cálida",
  "Dados de fuego rodando sobre una superficie de cristal oscuro con reflejos dorados",
  "Máquina tragamonedas mostrando triple 7 con explosión de monedas de oro",
  "Un jugador de póker con gafas oscuras revelando una escalera real en mano",
  "Gonzalo Plata acelerando por la banda con los colores de Ecuador",
  "Alexander Domínguez realizando una atajada espectacular con vuelo completo",
  "Ángel Mena ejecutando un tiro potente desde fuera del área",
  "Piero Hincapié ganando un duelo aéreo con autoridad",
  "Lamine Yamal driblando con la camiseta del Barcelona y confianza juvenil",
  "Jude Bellingham celebrando en el Santiago Bernabéu con público eufórico",
  "Una mesa de ruleta VIP vista desde arriba con apuestas distribuidas estratégicamente",
  "Un balón de fútbol de oro flotando sobre un estadio iluminado épicamente",
  "Mike Tyson lanzando un uppercut devastador con gotas de sudor congeladas en el aire",
  "Rafael Nadal ejecutando un revés a dos manos con arena de tierra batida en suspensión",
  "Carlos Alcaraz sirviendo un ace con expresión de concentración máxima",
  "Una cancha de básquetbol profesional vista desde el aro con el balón entrando limpio",
  "Lewis Hamilton cruzando la meta de Fórmula 1 con chispas volando del asfalto",
  "Un boxeador con guantes dorados lanzando un gancho perfecto bajo luces de estadio",
];

const CONCEPTOS_VISUALES = [
  "Lluvia de monedas doradas con estadio desenfocado de fondo y la app de Ecuabet brillando en un teléfono móvil flotante",
  "Diseño épico tipo póster de película: estadio al fondo, luces de bengala laterales y texto 3D gigante resaltando la oferta promocional",
  "Composición elegante de casino: fondo negro absoluto, acentos en azul eléctrico y dorado, fichas de póker lloviendo con iluminación de lujo",
  "Escena dividida (Split Screen): de un lado la tensión del partido, del otro un usuario celebrando con su ticket ganador en el celular",
  "Diseño minimalista corporativo: colores oficiales de la marca, protagonista recortado limpiamente sobre fondo gradiente con cinta de Alerta de Promoción cruzando el diseño",
  "Explosión cinética: el protagonista en acción con partículas de energía dorada emanando de su cuerpo, efecto de velocidad extrema",
  "Primer plano cinematográfico del rostro empapado en sudor con el estadio completamente desenfocado y luces cálidas de atardecer",
  "Ambiente de vestuario premium: iluminación dramática lateral, el protagonista con mirada desafiante, textura de concreto y metal de fondo",
  "Diseño con doble exposición: silueta del protagonista fusionada con la skyline nocturna de una ciudad latinoamericana iluminada",
  "Mesa de juego VIP en penumbra con un rayo de luz dorada cortando la escena, ambiente misterioso de casino high-roller",
  "Composición vertical tipo story: protagonista dominando el centro con confeti dorado cayendo y banner promocional en la parte inferior",
  "Vista cenital del estadio lleno con un efecto de zoom radial hacia el protagonista en el centro del campo",
  "Ambiente nocturno con neones: la calle refleja luces púrpura y doradas sobre charcos de lluvia, pantalla gigante al fondo mostrando las cuotas",
  "Escena de celebración masiva: selfie grupal de jugadores con trofeo, confeti y pirotecnia dorada explotando en el cielo del estadio",
  "Diseño de tarjeta premium: marco dorado ornamental, fondo terciopelo oscuro, protagonista en pose heroica con badge de VIP",
  "Campo de juego visto a través de la pantalla de un smartphone, con la interfaz de apuestas superpuesta de forma natural",
  "Escena de tensión máxima: portero y delantero frente a frente en un penal decisivo, cámara lenta con gotas de sudor en el aire",
  "Composición diagonal dinámica: el protagonista en acción con estelas de movimiento doradas y el logo de la marca anclado en la esquina",
  "Ambiente de Gran Gala: escenario de premiación con alfombra roja, focos cruzados y el logo de la marca brillando detrás del podio",
  "Tribunal de básquetbol envuelto en humo con iluminación roja y dorada, efecto de cámara baja mirando hacia el aro",
  "Ring de boxeo profesional con focos cenitales, cuerdas brillantes y humo dramático en la base",
  "Circuito de F1 con la recta principal iluminada de noche, chispas volando del asfalto y luces de freno rojas",
  "Diseño editorial de revista deportiva: layout limpio con columnas, foto principal recortada y tipografía bold impactante",
  "Acercamiento extremo de un balón entrando a la red de la portería en cámara super lenta con gotas de rocío desprendiéndose",
  "Escena de bar deportivo premium: pantallas gigantes al fondo mostrando el partido, cerveza artesanal y el celular con la app abierto",
  "Composición art-déco moderna: líneas geométricas doradas sobre fondo negro, protagonista integrado dentro de un marco hexagonal",
  "Panorámica aérea de un estadio latinoamericano repleto con hinchas y bengalas de humo en los graderíos",
  "Efecto de cómic realista: viñeta con onomatopeyas de impacto, líneas de acción y colores saturados de la marca",
  "Diseño tipo infografía deportiva: estadísticas del jugador destacadas con iconos minimalistas alrededor de su foto principal",
  "Ambiente de after-party: luces estroboscópicas, confeti dorado en el aire, jugadores celebrando con el trofeo en alto",
];

const GANCHOS_ECUABET = [
  "¡Bono de Bienvenida del 300%! Triplica tu primer depósito y empieza a ganar desde hoy",
  "La Yapa Ecuabet: Mientras más líneas pongas en tu combinada, ¡más se multiplica tu ganancia!",
  "Torneo Drops & Wins: Premios diarios en efectivo jugando tragamonedas. ¡Participa sin costo extra!",
  "Cuotas Mejoradas: Aprovecha las mejores cuotas del mercado en los partidos más importantes",
  "Bono de Cumpleaños VIP: $5 dólares gratis en tu día especial. ¡Festeja ganando!",
  "Pago Anticipado: Si tu equipo saca ventaja, ¡te pagamos antes de que termine el partido!",
  "Giros Gratis Semanales: Cada lunes recibe giros gratis exclusivos en las mejores tragamonedas",
  "Cashback del 10%: Si la suerte no te acompañó, recupera parte de lo jugado en casino",
  "Apuesta en Vivo: Sigue el partido minuto a minuto y apuesta con cuotas que se actualizan en tiempo real",
  "Freebet de $10: Regístrate hoy y recibe tu apuesta gratuita sin riesgo. ¡Cero excusas!",
  "Combo Ganador: Arma tu parlay de 3+ eventos y recibe un boost del 30% en ganancias",
  "Super Cuota Relámpago: Por tiempo limitado, cuota especial en el partido estelar del día",
  "Casino en Vivo 24/7: Ruleta, Blackjack y Baccarat con dealers reales esperándote ahora mismo",
  "Desafío Semanal: Completa retos de apuestas y acumula puntos para premios exclusivos",
  "Sorteo Mensual de iPhone: Cada apuesta te da un boleto para el gran sorteo del mes",
  "Retiro Express: Retira tus ganancias en minutos directamente a tu cuenta bancaria",
  "Club VIP Ecuabet: Accede a promociones exclusivas, límites elevados y atención preferencial",
  "Predicción Gratuita: Adivina el marcador exacto y gana premios sin arriesgar tu dinero",
  "Bonus por Recarga: Cada vez que recargas tu cuenta, recibe un porcentaje extra de regalo",
  "App Móvil Premium: Apuesta desde cualquier lugar con la app más rápida del mercado ecuatoriano",
  "Multi-Apuesta Express: Combina eventos de diferentes deportes y maximiza tus ganancias",
  "Apuesta sin Riesgo: Tu primera apuesta protegida. Si pierdes, te devolvemos el 100%",
  "Torneo de Póker Online: Compite contra otros jugadores por el pozo acumulado del mes",
  "Jackpot Progresivo: Miles de dólares acumulados esperando al próximo ganador. ¿Serás tú?",
  "Recargas Doradas: Deposita en horarios especiales y recibe el doble de créditos bonus",
  "Referidos Premium: Invita amigos y gana $5 por cada uno que se registre y deposite",
  "Seguro de Combinada: Si fallas solo 1 selección en tu parlay, ¡te devolvemos la apuesta!",
  "Streaming en Vivo: Mira los partidos gratis dentro de la plataforma mientras apuestas",
  "Estadísticas Pro: Accede a datos avanzados de rendimiento para tomar decisiones inteligentes",
  "Doble o Nada: Después de ganar, duplica tu premio con un solo clic. ¿Te atreves?",
];

const COPYS_POST = [
  "🔥 ¡La bola está en tu cancha! Regístrate HOY en Ecuabet, activa tu Bono de Bienvenida y demuestra que eres experto en pronósticos. ⚽👇 Link en la bio.",
  "📈 ¿Te armaste una combinada? ¡Tu ganancia se infla! Juega tus parlays con la Yapa Ecuabet y sácale el jugo a este fin de semana. 💸 ¡Apuesta ahora!",
  "🎰 Lujo, adrenalina y premios reales. Entra ahora a nuestro Casino en Vivo, activa los Giros Gratis y llévate el Jackpot a casa. ♠️♥️ Regístrate aquí.",
  "⚡ ¡ALERTA DE CUOTA MEJORADA! Hoy es tu día de suerte. Entra a Ecuabet, encuentra el partido estrella y apuesta con la mejor cuota del mercado. 🏆",
  "💰 ¿Sabías que en Ecuabet te pagan ANTES de que termine el partido? Sí, leíste bien. Pago Anticipado activado. ¡Corre a apostar! 🚀",
  "🎂 ¡Hoy cumples? ¡Ecuabet te regala $5 para que festejes ganando! Activa tu Bono de Cumpleaños y haz que este día sea LEGENDARIO. 🎉",
  "🏀 NBA + Ecuabet = La combinación ganadora. Mira los partidos en vivo, apuesta en tiempo real y cobra al instante. ¿Quién dice que no? 🔥",
  "⚽ El estadio está listo. Los equipos están en el campo. Solo falta TU apuesta. Entra a Ecuabet y convierte tu predicción en DINERO REAL. 💵",
  "🎯 Precisión, estrategia y ganancias. Arma tu Multi-Apuesta Express combinando deportes y multiplica tu premio. Solo en Ecuabet. 📊",
  "💎 Bienvenido al Club VIP. Promociones exclusivas, retiros express y atención 24/7. Ecuabet no es solo una plataforma, es una EXPERIENCIA. 👑",
  "🥊 ¡Se viene la pelea del año! Apuesta en las mejores cuotas de boxeo y MMA solo en Ecuabet. ¿A quién le vas? Comenta abajo 👇🔥",
  "🏈 Touchdown garantizado para tu bolsillo. La NFL está en vivo en Ecuabet con las mejores cuotas del mercado. ¡No te quedes mirando, APUESTA! 💪",
  "🎲 Los dados están echados, ¿te atreves? Casino en Vivo, Tragamonedas y Póker esperándote 24/7. Entra ahora y reclama tus Giros Gratis. 🃏",
  "📱 Tu estadio personal en el bolsillo. Descarga la App de Ecuabet, apuesta desde donde estés y cobra en minutos. Así de fácil, así de rápido. ⚡",
  "🌟 Cada semana más premios, cada día más oportunidades. Tu Desafío Semanal está activo en Ecuabet. ¡Cumple los retos y gana extra! 🏅",
  "🔴 ¡EN VIVO AHORA! El partido más esperado está a punto de empezar. Apuesta en tiempo real con cuotas dinámicas. Solo en Ecuabet. ⏱️⚽",
  "💸 ¡Invita a tus panas y GANA! Por cada amigo que se registre en Ecuabet recibes $5 gratis. Sin límite de referidos. ¡Comparte y gana! 🤝",
  "🏆 Campeones se hacen apostando con inteligencia. Accede a nuestras Estadísticas Pro y toma decisiones que te llevan al podio. 📈",
  "🎰 JACKPOT ALERT 🚨 El pozo acumulado está por las nubes. Un solo giro puede cambiar tu vida. ¿Te atreves a probar suerte HOY? 💰",
  "⚽ La Liga Pro está que arde 🇪🇨 y en Ecuabet las cuotas están al rojo vivo. Apuesta en tu equipo favorito y celebra con toda la hinchada. 🎉",
  "🔒 Apuesta SIN RIESGO. Tu primera jugada está 100% protegida. Si pierdes, te devolvemos todo. Cero excusas para no empezar AHORA. 🛡️",
  "⏰ ¡ÚLTIMA HORA! Cuota Relámpago activada para el partido de esta noche. Oportunidad única que desaparece en minutos. ¡CORRE! ⚡",
  "🃏 Poker Night is ON. Compite contra los mejores, bluffea como profesional y llévate el pozo del torneo. Solo en Ecuabet Casino. 🏆",
  "📊 Datos > Suerte. Usa nuestras herramientas de análisis deportivo y convierte tus apuestas en una ciencia. Ecuabet: Apuesta inteligente. 🧠",
  "🎁 RECARGA DORADA activada: Deposita entre 6PM y 9PM y recibe el DOBLE de créditos bonus. Oferta válida solo HOY. ¡No la dejes pasar! ⏳",
  "💪 El verdadero campeón no se queda en la tribuna. Baja al campo, haz tu jugada y demuestra que tienes olfato ganador. Ecuabet te espera. 🏟️",
  "🔥 ¡COMBINADA PROTEGIDA! Si fallas una sola selección en tu parlay, te devolvemos la plata. El Seguro de Combinada solo existe aquí. 💯",
  "🌎 Champions League, Premier, La Liga, Liga Pro... Todos los torneos del mundo en una sola plataforma. Ecuabet: Tu ventana al deporte global. 🌐",
  "🍀 Hoy la suerte está de tu lado, lo presiento. Entra a Ecuabet, elige tu evento favorito y demuéstralo. ¡El ganador podrías ser TÚ! 🎯",
  "🚀 De cero a héroe en un clic. Regístrate, reclama tu bono y empieza tu camino de ganancias HOY. Ecuabet: Donde empiezan los ganadores. 🏁",
];

// ══════════════════════════════════════════════════════════════
// DEPORTES DISPONIBLES
// ══════════════════════════════════════════════════════════════
const SPORTS = [
  { id: "football",          label: "Fútbol",           emoji: "⚽", active: true },
  { id: "basketball",        label: "Baloncesto",       emoji: "🏀", active: true },
  { id: "tennis",            label: "Tenis",            emoji: "🎾", active: true },
  { id: "baseball",          label: "Béisbol",          emoji: "⚾", active: true },
  { id: "american-football", label: "F. Americano",     emoji: "🏈", active: true },
  { id: "hockey",            label: "Hockey",           emoji: "🏒", active: true },
  { id: "volleyball",        label: "Voleibol",         emoji: "🏐", active: true },
  { id: "handball",          label: "Handball",         emoji: "🤾", active: true },
  { id: "rugby",             label: "Rugby",            emoji: "🏉", active: true },
];

interface Match {
  id: number;
  home: string;
  away: string;
  time: string;
  league: string;
  status: string;
}

interface GeneratedIdea {
  protagonist: string;
  visual: string;
  hook: string;
  copy: string;
}

interface AdGeneratorProps {
  onResult: (imagePrompt: string, caption: string) => void;
  onDirectGenerate?: (imagePrompt: string, caption: string, formatId: string, platformId: string) => void;
  availablePlatforms?: string[];
  onClose?: () => void;
}

export default function AdGeneratorModal({ onResult, onDirectGenerate, availablePlatforms = [], onClose }: AdGeneratorProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [localPlatform, setLocalPlatform] = useState<string>(availablePlatforms.length > 0 ? availablePlatforms[0] : "");
  const [localFormat, setLocalFormat] = useState<string>("auto");
  const [activeTab, setActiveTab] = useState<"creative" | "sports">("creative");

  // ── Estado Creativo ──
  const [generatedIdea, setGeneratedIdea] = useState<GeneratedIdea | null>(null);
  const [creativeLoading, setCreativeLoading] = useState(false);

  // ── Estado Deportivo ──
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());

  // ── Estado Global ──
  const [assembling, setAssembling] = useState(false);

  // ═══ Modo Creativo: Generar idea aleatoria ═══
  const generateCreativeIdea = useCallback(() => {
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    setGeneratedIdea({
      protagonist: pick(PROTAGONISTAS),
      visual: pick(CONCEPTOS_VISUALES),
      hook: pick(GANCHOS_ECUABET),
      copy: pick(COPYS_POST),
    });
  }, []);

  // ═══ Modo Deportivo: Cargar partidos ═══
  const loadMatches = useCallback(async (sportId: string) => {
    setSelectedSport(sportId);
    setMatches([]);
    setSelectedMatches(new Set());
    setMatchesError(null);
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/sports/matches?sport=${sportId}`);
      const data = await res.json();
      if (data.success && data.matches) {
        setMatches(data.matches);
        if (data.matches.length === 0) {
          setMatchesError("No hay partidos programados para hoy en este deporte.");
        }
      } else {
        setMatchesError(data.error || "Error cargando partidos.");
      }
    } catch (e: any) {
      setMatchesError("Error de conexión al servidor.");
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  const toggleMatch = (id: number) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ═══ Ensamblar Prompt y Generar ═══
  const handleProceed = useCallback(async () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    setAssembling(true);
    try {
      let body: any = {};

      if (activeTab === "creative" && generatedIdea) {
        body = { mode: "creative", generatedIdea };
      } else if (activeTab === "sports" && selectedMatches.size > 0) {
        const chosen = matches.filter(m => selectedMatches.has(m.id));
        body = { mode: "sports", matches: chosen };
      }

      const res = await fetch("/api/ai/sports-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        if (onDirectGenerate) {
          onDirectGenerate(data.imagePrompt, data.caption, localFormat, localPlatform);
        } else {
          onResult(data.imagePrompt, data.caption);
        }
      } else {
        alert(data.error || "Error generando el prompt.");
      }
    } catch (e: any) {
      alert("Error de conexión: " + e.message);
    } finally {
      setAssembling(false);
    }
  }, [step, activeTab, generatedIdea, selectedMatches, matches, localFormat, localPlatform, onDirectGenerate, onResult]);

  const canProceed =
    (activeTab === "creative" && generatedIdea !== null) ||
    (activeTab === "sports" && selectedMatches.size > 0);

  return (
    <div className="bg-[#111111] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 cursor-pointer" onClick={() => step === 2 && setStep(1)}>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-white/90">
            {step === 1 ? "Generador de Publicidad" : "Configurar Aspecto"}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      {step === 1 && (
        <div className="flex border-b border-white/[0.06]">
          <button
            onClick={() => setActiveTab("creative")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold transition-colors ${
              activeTab === "creative"
                ? "text-amber-400 border-b-2 border-amber-400 bg-amber-400/[0.04]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            Auto-Generar
          </button>
          <button
            onClick={() => setActiveTab("sports")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold transition-colors ${
              activeTab === "sports"
                ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/[0.04]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Partidos de Hoy
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar">

        {/* ═══ TAB: AUTO-GENERAR CREATIVO ═══ */}
        {step === 1 && activeTab === "creative" && (
          <div className="space-y-4">
            <button
              onClick={generateCreativeIdea}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold hover:from-amber-500/15 hover:to-orange-500/15 transition-all flex items-center justify-center gap-2"
            >
              <Dices className="w-4 h-4" />
              {generatedIdea ? "Generar Otra Idea" : "Crear Idea Mágica"}
            </button>

            {generatedIdea && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
                {[
                  { label: "Protagonista", value: generatedIdea.protagonist, color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/15" },
                  { label: "Concepto Visual", value: generatedIdea.visual, color: "text-purple-300", bg: "bg-purple-500/10 border-purple-500/15" },
                  { label: "Gancho Promocional", value: generatedIdea.hook, color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/15" },
                  { label: "Copy para Redes", value: generatedIdea.copy, color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/15" },
                ].map((item, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${item.bg}`}>
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${item.color}`}>{item.label}</span>
                    <p className="text-xs text-white/80 mt-1 leading-relaxed">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: PARTIDOS DE HOY ═══ */}
        {step === 1 && activeTab === "sports" && (
          <div className="space-y-4">
            {/* Menú de deportes */}
            <div className="flex flex-wrap gap-1.5">
              {SPORTS.map(sport => (
                <button
                  key={sport.id}
                  onClick={() => loadMatches(sport.id)}
                  disabled={!sport.active}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    selectedSport === sport.id
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : sport.active
                        ? "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                        : "bg-white/[0.02] border-white/[0.04] text-zinc-700 cursor-not-allowed"
                  }`}
                >
                  <span className="text-sm">{sport.emoji}</span>
                  <span className="hidden sm:inline">{sport.label}</span>
                </button>
              ))}
            </div>

            {/* Estado de carga */}
            {matchesLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mr-2" />
                <span className="text-sm text-zinc-400">Cargando partidos...</span>
              </div>
            )}

            {/* Error */}
            {matchesError && !matchesLoading && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/15 text-orange-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {matchesError}
              </div>
            )}

            {/* Lista de partidos */}
            {!matchesLoading && matches.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2">
                  {matches.length} partido{matches.length !== 1 ? "s" : ""} encontrado{matches.length !== 1 ? "s" : ""} hoy
                </p>
                {matches.map(match => {
                  const isSelected = selectedMatches.has(match.id);
                  return (
                    <button
                      key={match.id}
                      onClick={() => toggleMatch(match.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all border ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/25"
                          : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "bg-emerald-500 text-black" : "bg-white/[0.06] border border-white/[0.1]"
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isSelected ? "text-white" : "text-white/70"}`}>
                          {match.home} vs {match.away}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">{match.league}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        <span className="text-[11px] font-mono text-zinc-400">{match.time}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sin deporte seleccionado */}
            {!selectedSport && !matchesLoading && (
              <div className="text-center py-8">
                <Trophy className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">Selecciona un deporte para ver los partidos de hoy</p>
              </div>
            )}
          </div>
        )}
        {/* ═══ ESTADO: PASO 2 CONFIGURACIÓN ═══ */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Resumen */}
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1 block">Selección a procesar:</span>
              <p className="text-xs text-white/80 font-medium">
                {activeTab === 'creative' 
                  ? `Modo Creativo: ${generatedIdea?.protagonist?.substring(0, 40)}...` 
                  : `Deportivo: ${selectedMatches.size} partido(s) seleccionado(s).`
                }
              </p>
            </div>

            {/* Plataforma */}
            {availablePlatforms.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">1. Plataforma</span>
                <div className="flex flex-wrap gap-2">
                  {availablePlatforms.map(plat => {
                    const isSelected = localPlatform === plat;
                    let label = plat.charAt(0).toUpperCase() + plat.slice(1);
                    if (plat === 'doradobet') label = 'DoradoBet';
                    if (plat === 'masparley') label = 'MasParley';
                    if (plat === 'databet') label = 'DataBet';
                    
                    return (
                      <button
                        key={plat}
                        onClick={() => setLocalPlatform(plat)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                          isSelected 
                          ? 'bg-[#FFDE00]/10 border-[#FFDE00]/30 text-[#FFDE00]'
                          : 'bg-[#0A0A0A] border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/80'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Formato */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">2. Formato de Imagen</span>
              <div className="grid grid-cols-2 gap-2">
                {FORMAT_OPTIONS.map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => setLocalFormat(fmt.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      localFormat === fmt.id
                        ? 'bg-[#FFDE00]/[0.06] border-[#FFDE00]/30 text-[#FFDE00]'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04] hover:text-white hover:border-white/[0.12]'
                    }`}
                  >
                    <FormatIcon icon={fmt.icon} className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold">{fmt.label} {fmt.ratio && <span className="text-zinc-600 ml-1 font-normal">{fmt.ratio}</span>}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{fmt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: Botón de acción ── */}
      <div className="px-5 py-4 border-t border-white/[0.06] bg-[#0D0D0D]">
        <button
          onClick={handleProceed}
          disabled={!canProceed || assembling}
          className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            canProceed && !assembling
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
              : "bg-white/[0.04] text-zinc-600 cursor-not-allowed"
          }`}
        >
          {assembling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generando Visuales...
            </>
          ) : step === 1 ? (
            <>
              Continuar 
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Confirmar y Generar Imagen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
