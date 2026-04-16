"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, RefreshCw, ExternalLink } from "lucide-react";

interface EcuabetHeaderProps {
  iframeKey: number;
  setIframeKey: any;
  title?: string;
  externalLink?: string;
}

export default function EcuabetHeader({ 
  iframeKey, 
  setIframeKey, 
  title = "Sistema Ecuabet",
  externalLink
}: EcuabetHeaderProps) {
  const [showCreds, setShowCreds] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setUsername(localStorage.getItem("_ecuabet_user") || "");
    setPassword(localStorage.getItem("_ecuabet_pass") || "");
  }, []);

  const saveCreds = () => {
    localStorage.setItem("_ecuabet_user", username);
    localStorage.setItem("_ecuabet_pass", password);
    setShowCreds(false);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIframeKey((k: number) => k + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="relative">
      <div className="px-5 py-3 bg-black/40 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between z-20 shadow-sm">
        
        {/* Logo & Title Area */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-[6px] animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 relative z-10 box-shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
          </div>
          <span className="font-extrabold text-[11px] tracking-[0.15em] uppercase truncate max-w-[140px] sm:max-w-none bg-gradient-to-r from-zinc-100 to-zinc-500 bg-clip-text text-transparent drop-shadow-sm">
            {title}
          </span>
        </div>
        
        {/* Right Controls Area */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          
          {/* Credentials Manager Buttons */}
          {username ? (
            <div className="flex items-center gap-1.5 mr-2">
              <button 
                onClick={() => copy(username)}
                className="text-[10px] font-bold tracking-wide text-emerald-400 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 px-3 py-1.5 rounded-full transition-all duration-300 border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] flex items-center gap-1.5"
                title="Copiar Usuario"
              >
                C. Usuario
              </button>
              <button 
                onClick={() => copy(password)}
                className="text-[10px] font-bold tracking-wide text-[#FFDE00] bg-gradient-to-r from-[#FFDE00]/10 to-orange-500/10 hover:from-[#FFDE00]/20 hover:to-orange-500/20 px-3 py-1.5 rounded-full transition-all duration-300 border border-[#FFDE00]/20 hover:border-[#FFDE00]/40 hover:shadow-[0_0_12px_rgba(255,222,0,0.15)] flex items-center gap-1.5"
                title="Copiar Clave"
              >
                C. Clave
              </button>
              <button 
                onClick={() => setShowCreds(true)} 
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/80 transition-colors border border-white/[0.05]"
              >
                +
              </button>
            </div>
          ) : (
             <button 
              onClick={() => setShowCreds(!showCreds)}
              className="text-[10px] font-bold text-white/80 bg-white/[0.03] hover:bg-white/[0.08] px-3 py-1.5 rounded-full transition-all duration-300 border border-white/[0.08] hover:border-white/[0.15] flex items-center gap-1.5 uppercase tracking-wider mr-2"
            >
              Configurar Pegado Automático
            </button>
          )}

          <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block"></div>

          {/* Navigation Controls */}
          <button 
            onClick={() => setIframeKey((k: number) => k + 1)}
            className="text-[10px] font-bold text-zinc-400 bg-black/40 hover:bg-white/5 px-2.5 py-1.5 rounded-full transition-all duration-300 border border-white/[0.05] flex items-center gap-1.5 uppercase tracking-wider hidden sm:flex shrink-0"
            title="Retroceder al inicio"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            <span className="hidden sm:inline">Atrás</span>
          </button>
          
          <button 
            onClick={handleRefresh}
            className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 flex justify-center items-center font-bold text-zinc-400 bg-black/40 hover:bg-white/5 rounded-full transition-all duration-300 border border-white/[0.05] uppercase tracking-wider shrink-0 group"
            title="Recargar caja"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-white transition-colors block sm:hidden ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-zinc-500 mr-2 hidden sm:block ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline text-[10px]">Refresh</span>
          </button>

          {externalLink && (
            <a 
              href={externalLink} 
              target="_blank" 
              rel="noreferrer" 
              className="text-[10px] font-bold text-black bg-[#FFDE00] hover:brightness-110 px-3 py-1.5 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(255,222,0,0.2)] flex items-center gap-1.5 uppercase tracking-wider shrink-0 ml-1 hover:shadow-[0_0_20px_rgba(255,222,0,0.4)]"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Abrir Web</span>
            </a>
          )}
        </div>
      </div>

      {/* Credential Setup Modal/Popup */}
      {showCreds && (
        <div className="absolute top-14 right-4 bg-[#0a0a0b]/95 backdrop-blur-2xl p-5 rounded-2xl border border-white/[0.1] shadow-[0_20px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(255,222,0,0.05)] z-50 w-72 animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Credenciales Rápidas</h3>
            <div className="w-2 h-2 rounded-full bg-[#FFDE00] shadow-[0_0_8px_rgba(255,222,0,0.8)]"></div>
          </div>
          <p className="text-[10px] text-zinc-400 mb-4 leading-relaxed font-medium">
            Guarda tus accesos localmente. Por seguridad Ecuabet bloquea el Administrador de Contraseñas, pero así podrás copiarlas con 1 clic.
          </p>
          
          <div className="space-y-3 mb-5">
            <div>
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Usuario / Email</label>
              <input 
                type="email" 
                value={username} onChange={e => setUsername(e.target.value)} 
                placeholder="ejemplo@correo.com" 
                className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:bg-emerald-500/[0.02] transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Contraseña</label>
              <input 
                type="password" 
                value={password} onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••" 
                className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFDE00]/50 focus:bg-[#FFDE00]/[0.02] transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-2.5">
            <button 
              onClick={() => setShowCreds(false)} 
              className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 font-bold text-[10px] py-2.5 rounded-xl transition-colors border border-white/[0.05]"
            >
              Cancelar
            </button>
            <button 
              onClick={saveCreds} 
              className="flex-1 bg-gradient-to-r from-[#FFDE00] to-yellow-500 text-black font-extrabold text-[10px] uppercase tracking-wider py-2.5 rounded-xl hover:brightness-110 shadow-[0_0_15px_rgba(255,222,0,0.3)] transition-all"
            >
              Guardar Auto-Pegado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
