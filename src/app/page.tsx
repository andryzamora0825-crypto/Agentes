import { NavbarAuth, HeroCTA } from "@/components/LandingAuth";
import Link from "next/link";
import { FileText, Sparkles, Newspaper, ShieldAlert } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">

      {/* ── NAVBAR ── */}
      <header className="flex justify-between items-center px-5 sm:px-8 py-4 bg-black/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FFDE00] flex items-center justify-center font-black text-black text-sm shadow-[0_0_12px_rgba(255,222,0,0.4)]">
            Z
          </div>
          <span className="text-xl font-black text-white tracking-tight">Zamtools</span>
        </div>

        <div>
        <NavbarAuth />
        </div>
      </header>

      {/* ── HERO ── */}
      <main className="flex-1 flex flex-col items-center">
        <section className="relative w-full flex flex-col items-center text-center pt-20 sm:pt-32 pb-20 px-5">
          {/* Glow fondo */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#FFDE00]/10 rounded-full blur-[120px] pointer-events-none" />

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#FFDE00]/10 border border-[#FFDE00]/20 text-[#FFDE00] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6">
            ⚡ Plataforma Exclusiva para Agentes Ecuabet
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight max-w-3xl">
            Impulsa tus operaciones con{" "}
            <span className="text-[#FFDE00] drop-shadow-[0_0_20px_rgba(255,222,0,0.4)]">Zamtools</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Gestiona, analiza y potencia tus resultados con herramientas avanzadas e intuitivas — todo en un solo lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <HeroCTA />

            <a
              href="#features"
              className="bg-white/5 text-gray-300 border border-white/10 font-bold px-8 py-3.5 rounded-2xl hover:bg-white/10 hover:text-white transition-all text-sm"
            >
              Ver funciones
            </a>
          </div>
        </section>

        {/* ── FEATURES GRID ── */}
        <section id="features" className="w-full max-w-6xl px-5 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Todo lo que necesitas</h2>
            <p className="text-gray-500 mt-2 text-sm">Herramientas diseñadas para agentes profesionales</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                title: "Notas de Retiro",
                description: "Registra y verifica comprobantes con IA en segundos.",
                icon: <FileText className="w-7 h-7 text-[#FFDE00]" />,
                glow: "hover:shadow-[0_0_30px_rgba(255,222,0,0.08)]",
              },
              {
                title: "Estudio IA",
                description: "Genera imágenes profesionales con Nano Banana (Gemini).",
                icon: <Sparkles className="w-7 h-7 text-[#FFDE00]" />,
                glow: "hover:shadow-[0_0_30px_rgba(255,222,0,0.08)]",
              },
              {
                title: "Muro de Novedades",
                description: "Comparte noticias, promociones y recursos con tu red.",
                icon: <Newspaper className="w-7 h-7 text-[#FFDE00]" />,
                glow: "hover:shadow-[0_0_30px_rgba(255,222,0,0.08)]",
              },
              {
                title: "Alertas de Seguridad",
                description: "Directorio de números con reportes de fraude verificados.",
                icon: <ShieldAlert className="w-7 h-7 text-[#FFDE00]" />,
                glow: "hover:shadow-[0_0_30px_rgba(255,222,0,0.08)]",
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`bg-[#111111] border border-white/5 p-6 rounded-2xl transition-all ${f.glow} hover:border-[#FFDE00]/10 hover:-translate-y-1`}
              >
                <div className="bg-[#FFDE00]/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-[#FFDE00]/20">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-6 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} Zamtools. Todos los derechos reservados.</span>
          <span className="text-[#FFDE00]/70 font-bold tracking-widest uppercase">Exclusivo para agentes Ecuabet</span>
        </div>
      </footer>

    </div>
  );
}
