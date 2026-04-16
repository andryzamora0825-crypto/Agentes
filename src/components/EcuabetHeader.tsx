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
      <div className="px-3 py-2.5 bg-[#0A0A0A] border-b border-white/[0.06] flex items-center justify-between z-20">
        
        {/* Logo & Title Area */}
        <div className="flex items-center gap-2 pr-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
          <span className="text-white/80 font-bold text-[10px] sm:text-xs tracking-widest uppercase truncate max-w-[80px] sm:max-w-none">
            {title}
          </span>
        </div>
        
        {/* Right Controls Area */}
        <div className="flex items-center gap-1.5">
          
          {/* Credentials Manager Buttons */}
          {username ? (
            <div className="flex bg-[#111] border border-white/10 rounded-md overflow-hidden shrink-0">
              <button 
                onClick={() => copy(username)}
                className="text-[9px] sm:text-[10px] font-semibold text-emerald-400 bg-white/[0.02] hover:bg-white/[0.06] px-2 py-1.5 transition-colors border-r border-white/10 flex items-center"
                title="Copiar Usuario"
              >
                C. Usuario
              </button>
              <button 
                onClick={() => copy(password)}
                className="text-[9px] sm:text-[10px] font-semibold text-[#FFDE00] bg-white/[0.02] hover:bg-white/[0.06] px-2 py-1.5 transition-colors border-r border-white/10 flex items-center"
                title="Copiar Clave"
              >
                C. Clave
              </button>
              <button 
                onClick={() => setShowCreds(true)} 
                className="px-1.5 bg-white/[0.02] hover:bg-white/[0.08] text-white/50 transition-colors flex items-center"
              >
                +
              </button>
            </div>
          ) : (
             <button 
              onClick={() => setShowCreds(!showCreds)}
              className="text-[9px] sm:text-[10px] font-semibold text-white/80 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-md transition-colors border border-white/10 flex items-center gap-1 uppercase shrink-0"
            >
              Configurar Pegado
            </button>
          )}

          {/* Navigation Controls */}
          <button 
            onClick={() => setIframeKey((k: number) => k - 1)}
            className="text-[10px] font-semibold text-zinc-400 bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-md transition-colors border border-white/10 flex items-center justify-center shrink-0"
            title="Retroceder al inicio"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          </button>
          
          <button 
            onClick={handleRefresh}
            className="text-[10px] font-semibold text-zinc-400 bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-md transition-colors border border-white/10 flex items-center justify-center shrink-0 group"
            title="Recargar caja"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 group-hover:text-white transition-colors ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          {externalLink && (
            <a 
              href={externalLink} 
              target="_blank" 
              rel="noreferrer" 
              className="px-2 py-1.5 rounded-md text-[#FFDE00] bg-[#FFDE00]/10 hover:bg-[#FFDE00]/20 border border-[#FFDE00]/30 transition-colors flex items-center justify-center shrink-0"
              title="Abrir en pestaña"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          )}
        </div>
      </div>

      {/* Credential Setup Modal/Popup */}
      {showCreds && (
        <div className="absolute top-12 right-4 bg-[#111] p-4 rounded-lg border border-white/[0.08] shadow-2xl z-50 w-64 animate-in slide-in-from-top-4 fade-in duration-200">
          <p className="text-[10px] text-white/50 mb-3 uppercase tracking-wider leading-relaxed">
            Guarda aquí tu clave para copiarla con 1 clic y pegarla abajo de forma segura.
          </p>
          <input 
            type="email" 
            value={username} onChange={e => setUsername(e.target.value)} 
            placeholder="Usuario / Email..." 
            className="w-full bg-[#050505] border border-white/10 rounded-md px-3 py-1.5 mb-2 text-sm text-white focus:outline-none focus:border-[#FFDE00]/50"
          />
          <input 
            type="password" 
            value={password} onChange={e => setPassword(e.target.value)} 
            placeholder="Contraseña..." 
            className="w-full bg-[#050505] border border-white/10 rounded-md px-3 py-1.5 mb-3 text-sm text-white focus:outline-none focus:border-[#FFDE00]/50"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowCreds(false)} className="flex-1 bg-white/5 text-white/60 text-xs py-1.5 rounded-md hover:bg-white/10 transition-colors border border-transparent">Cancelar</button>
            <button onClick={saveCreds} className="flex-1 bg-[#FFDE00] text-black font-semibold text-xs py-1.5 rounded-md hover:brightness-110 transition-colors">Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
