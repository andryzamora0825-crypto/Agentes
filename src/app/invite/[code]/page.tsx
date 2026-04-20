"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, Crown, ShieldCheck, ArrowRight, UserPlus, CheckCircle2, AlertTriangle, X } from "lucide-react";

export default function InvitePage() {
  const pathname = usePathname();
  // Extraemos el código de la URL: /invite/OP-1234 -> OP-1234
  const code = pathname?.split('/').pop()?.toUpperCase() || "";
  
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "evaluating" | "awaiting_confirmation" | "linking" | "success" | "error" | "already_linked">("evaluating");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        // Caso 1: Verificar si ya está vinculado
        const meta = user?.publicMetadata as any;
        if (meta?.linkedOperatorId) {
           setStatus("already_linked");
        } 
        else if (meta?.role === "operator") {
           setStatus("error");
           setErrorMsg("Las agencias (operadores) no pueden afiliarse a otras agencias.");
        }
        else {
           // No está vinculado a nadie.
           // Verificamos si acaba de crear cuenta desde este link (Caso 3) o si ya tenía sesión iniciada (Caso 2)
           const autoLink = localStorage.getItem("autoLinkAfterSignup");
           if (autoLink === "true") {
             localStorage.removeItem("autoLinkAfterSignup");
             linkOperator(); // Vinculación automática (Caso 3)
           } else {
             setStatus("awaiting_confirmation"); // Solicitar confirmación permanente (Caso 2)
           }
        }
      } else {
         setStatus("idle"); // Vista para usuario no logueado
      }
    }
  }, [isLoaded, isSignedIn]);

  const linkOperator = async () => {
    setStatus("linking");
    try {
      const res = await fetch("/api/user/link-operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateCode: code })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 3000);
      } else {
        // Red de seguridad: si Clerk Metadata estaba muy fresco y el Auth Local (JWT) no se había enterado de que
        // ya habíamos sido vinculados antes, el Backend dirá "Ya estás vinculada". En vez de error, asimilarlo como éxito/info.
        if (data.error && data.error.includes("Ya estás")) {
           setStatus("already_linked");
        } else {
           setStatus("error");
           setErrorMsg(data.error || "No se pudo vincular la agencia. El código podría ser inválido.");
        }
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg("Error de red. Verifica tu internet.");
    }
  };

  const handleSignupRedirect = () => {
    // Marcamos para un auto-link al volver (Caso 3)
    localStorage.setItem("autoLinkAfterSignup", "true");
    const returnUrl = encodeURIComponent(`/invite/${code}`);
    router.push(`/sign-up?redirect_url=${returnUrl}`);
  };

  if (!isLoaded || status === "evaluating") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-10 h-10 text-[#FFDE00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-[#FFDE00]/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="bg-[#0A0A0A] border border-white/[0.08] shadow-[0_0_50px_rgba(255,222,0,0.05)] rounded-3xl p-8 max-w-md w-full relative z-10 text-center animate-fade-in my-8">
        
        {/* State: Idle (Not Logged In) - Caso 3 (Paso 1) */}
        {!isSignedIn && status === "idle" && (
          <>
            <div className="w-20 h-20 bg-gradient-to-br from-[#FFDE00] to-[#FFB800] rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-[#FFDE00]/20 mb-6 rotate-3">
              <Crown className="w-10 h-10 text-black -rotate-3" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-2">Invitación VIP</h1>
            <p className="text-white/50 text-sm mb-8 leading-relaxed">
              Has sido invitado a formar parte de nuestra red bajo la distribución de la agencia <strong className="text-[#FFDE00]">{code}</strong>.
            </p>

            <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-4 mb-8 text-left space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs text-white/80">Afiliación instantánea y automática</span>
              </div>
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="text-xs text-white/80">Acceso a recargas de administrador</span>
              </div>
            </div>

            <button
              onClick={handleSignupRedirect}
              className="w-full bg-[#FFDE00] hover:bg-[#FFE533] text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,222,0,0.2)] flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" /> Crear Cuenta para Unirme
            </button>
            <p className="mt-4 text-[10px] text-white/30 uppercase tracking-widest">Ya tienes cuenta? Dale click también.</p>
          </>
        )}

        {/* State: Awaiting Confirmation (Already Logged In, not linked) - Caso 2 */}
        {isSignedIn && status === "awaiting_confirmation" && (
           <div className="animate-in zoom-in duration-300">
             <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto border border-white/[0.06] mb-6">
                <UserPlus className="w-8 h-8 text-white/50" />
             </div>
             <h2 className="text-xl font-black text-white mb-3">Solicitud de Afiliación</h2>
             <p className="text-sm text-white/50 mb-8">
               Tu cuenta actual va a quedar vinculada <strong>de manera permanente e irreversible</strong> a la agencia <strong className="text-[#FFDE00]">{code}</strong>.
             </p>
             
             <div className="flex flex-col gap-3">
               <button
                 onClick={linkOperator}
                 className="w-full py-4 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
               >
                 <CheckCircle2 className="w-5 h-5" /> Aceptar y Vincular
               </button>
               <button
                 onClick={() => router.push("/dashboard")}
                 className="w-full py-3 text-white/40 hover:text-white hover:bg-white/[0.04] rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all mt-2"
               >
                 Rechazar y Volver
               </button>
             </div>
           </div>
        )}

        {/* State: Already Linked - Caso 1 */}
        {isSignedIn && status === "already_linked" && (
           <div className="animate-in zoom-in duration-300 py-4">
             <ShieldCheck className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
             <h2 className="text-xl font-black text-white mb-2">Ya estás Afiliado</h2>
             <p className="text-sm text-white/40 mb-8">
               Tu cuenta ya se encuentra afiliada a un operador actualmente. No es posible cambiar de agencia.
             </p>
             <button
               onClick={() => router.push("/dashboard")}
               className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
             >
               Ir al Panel Principal <ArrowRight className="w-4 h-4" />
             </button>
           </div>
        )}

        {/* State: Linking */}
        {isSignedIn && status === "linking" && (
          <div className="py-6">
            <Loader2 className="w-12 h-12 text-[#FFDE00] animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Integrando Tu Cuenta...</h2>
            <p className="text-sm text-white/40">Estableciendo conexión encriptada con la base de datos.</p>
          </div>
        )}

        {/* State: Success */}
        {isSignedIn && status === "success" && (
          <div className="animate-in zoom-in duration-300 py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-black text-white mb-2">¡Vínculo Exitoso!</h2>
            <p className="text-sm text-white/40 mb-6">Agencia oficializada. Redirigiendo a tu panel...</p>
            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full w-full animate-[progress_3s_ease-in-out_forwards]"></div>
            </div>
          </div>
        )}

        {/* State: Error */}
        {isSignedIn && status === "error" && (
          <div className="animate-in zoom-in duration-300 py-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-white mb-3">Falló el Vínculo</h2>
            <p className="text-sm text-red-400/80 mb-8 bg-red-500/10 border border-red-500/20 p-4 rounded-xl">{errorMsg}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Volver al Panel <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </div>
  );
}
