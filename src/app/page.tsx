import { NavbarAuth, HeroCTA } from "@/components/LandingAuth";
import { FileText, Sparkles, Newspaper, ShieldAlert } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] text-white/90">

      {/* Navbar */}
      <header className="flex justify-between items-center px-6 sm:px-10 py-4 border-b border-white/[0.06] sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-sm">
        <span className="text-sm font-semibold tracking-tight">Zamtools</span>
        <NavbarAuth />
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center">
        <section className="w-full max-w-2xl text-center pt-24 sm:pt-36 pb-20 px-6">
          
          <p className="text-[11px] text-[#FFDE00]/70 font-medium uppercase tracking-widest mb-6">
            Plataforma para Agentes Ecuabet
          </p>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-5 leading-[1.15] text-white">
            Herramientas inteligentes para tu operación
          </h1>

          <p className="text-base text-white/35 mb-10 max-w-lg mx-auto leading-relaxed">
            Gestiona, analiza y potencia tus resultados con IA — todo en un solo lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <HeroCTA />
            <a
              href="#features"
              className="text-white/40 border border-white/[0.08] font-medium px-6 py-3 rounded-lg hover:bg-white/[0.03] hover:text-white/60 transition-colors text-sm"
            >
              Ver funciones
            </a>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="w-full max-w-4xl px-6 pb-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/[0.06] border border-white/[0.06] rounded-xl overflow-hidden">
            {[
              { title: "Notas de Retiro", desc: "Extrae datos de comprobantes con IA en segundos.", icon: FileText },
              { title: "Estudio IA", desc: "Genera imágenes profesionales para tu agencia.", icon: Sparkles },
              { title: "Muro de Novedades", desc: "Comparte noticias y recursos con tu red.", icon: Newspaper },
              { title: "Alertas de Seguridad", desc: "Directorio de reportes de fraude verificados.", icon: ShieldAlert },
            ].map((f, i) => (
              <div key={i} className="bg-[#0A0A0A] p-6 sm:p-8">
                <f.icon className="w-5 h-5 text-[#FFDE00]/70 mb-4" />
                <h3 className="text-sm font-semibold text-white/90 mb-1.5">{f.title}</h3>
                <p className="text-sm text-white/30 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-5 px-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center text-[11px] text-white/20">
          <span>© {new Date().getFullYear()} Zamtools</span>
          <span>Exclusivo para agentes Ecuabet</span>
        </div>
      </footer>
    </div>
  );
}
