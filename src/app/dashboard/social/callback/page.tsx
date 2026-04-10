"use client";

import { useEffect, useState } from "react";

/**
 * Facebook OAuth Callback Page
 * Receives the access_token from Facebook's OAuth redirect (implicit grant),
 * sends it back to the parent window via postMessage, and closes itself.
 * 
 * Also handles fallback: if window.opener is lost (e.g., page reload), 
 * shows the token for manual copy.
 */
export default function MetaCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "manual">("loading");
  const [token, setToken] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    // Facebook returns the token in the URL hash (fragment) for implicit grants
    // Example: #access_token=EAA...&token_type=bearer&expires_in=...
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");

    // Check for error in query params
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get("error_description") || searchParams.get("error");

    if (error) {
      if (window.opener) {
        window.opener.postMessage(
          { type: "META_OAUTH_ERROR", error },
          window.location.origin
        );
        setStatus("success");
        setTimeout(() => window.close(), 500);
      } else {
        setStatus("error");
        setErrorMsg(error);
      }
      return;
    }

    if (accessToken) {
      if (window.opener) {
        // Send the token back to the parent window (SocialSettingsPanel)
        window.opener.postMessage(
          { type: "META_OAUTH_TOKEN", accessToken },
          window.location.origin
        );
        setStatus("success");
        // Small delay before closing to ensure message is sent
        setTimeout(() => window.close(), 500);
      } else {
        // Fallback: window.opener lost (browser security, redirect, etc.)
        // Show the token for manual copy
        setToken(accessToken);
        setStatus("manual");
      }
    } else {
      // No token and no error — something unexpected
      setStatus("error");
      setErrorMsg("No se recibió token de Facebook. Intenta de nuevo.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md w-full">
        
        {status === "loading" && (
          <>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white font-bold text-lg">Conectando con Facebook...</p>
            <p className="text-gray-500 text-sm">Esta ventana se cerrará automáticamente.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-green-400 font-bold text-lg">¡Conectado exitosamente!</p>
            <p className="text-gray-500 text-sm">Cerrando ventana...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">❌</span>
            </div>
            <p className="text-red-400 font-bold text-lg">Error de conexión</p>
            <p className="text-gray-400 text-sm">{errorMsg}</p>
            <button 
              onClick={() => window.close()} 
              className="mt-4 px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm font-bold"
            >
              Cerrar ventana
            </button>
          </>
        )}

        {status === "manual" && (
          <>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-yellow-400 font-bold text-lg">Token obtenido</p>
            <p className="text-gray-400 text-sm">
              La ventana principal no pudo recibir el token automáticamente. 
              Copia este token y pégalo manualmente en el campo &quot;Page Access Token&quot;:
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mt-4">
              <textarea 
                readOnly 
                value={token} 
                className="w-full bg-transparent text-green-400 text-xs font-mono resize-none h-20 outline-none"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(token);
                  alert("¡Token copiado al portapapeles!");
                }}
                className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
              >
                📋 Copiar Token
              </button>
            </div>
            <button 
              onClick={() => window.close()} 
              className="mt-2 px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm font-bold"
            >
              Cerrar ventana
            </button>
          </>
        )}
      </div>
    </div>
  );
}
