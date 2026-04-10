"use client";

import { useEffect } from "react";

/**
 * Facebook OAuth Callback Page
 * This page receives the access_token from Facebook's OAuth redirect,
 * sends it back to the parent window that opened the popup, and closes itself.
 * 
 * Flow: Parent opens popup → Facebook OAuth → Redirect here with token → postMessage to parent → Close
 */
export default function MetaCallbackPage() {

  useEffect(() => {
    // Facebook returns the token in the URL hash (fragment) for implicit grants
    // Example: #access_token=EAA...&token_type=bearer&expires_in=...
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");

    if (accessToken && window.opener) {
      // Send the token back to the parent window (SocialSettingsPanel)
      window.opener.postMessage(
        { type: "META_OAUTH_TOKEN", accessToken },
        window.location.origin
      );
      // Close this popup
      window.close();
    } else if (window.opener) {
      // Check for error
      const searchParams = new URLSearchParams(window.location.search);
      const error = searchParams.get("error_description") || searchParams.get("error");
      window.opener.postMessage(
        { type: "META_OAUTH_ERROR", error: error || "No se recibió token de Facebook." },
        window.location.origin
      );
      window.close();
    }
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white font-bold text-lg">Conectando con Facebook...</p>
        <p className="text-gray-500 text-sm">Esta ventana se cerrará automáticamente.</p>
      </div>
    </div>
  );
}
