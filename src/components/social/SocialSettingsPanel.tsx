"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Save,
  Loader2,
  Globe,
  Camera,
  Key,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  X,
  HelpCircle,
} from "lucide-react";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "2426882634447043";

interface SocialSettingsData {
  meta_page_id: string;
  meta_page_access_token: string;
  meta_ig_user_id: string;
  brand_voice: string;
  default_platform: string;
  auto_generate: boolean;
  daily_post_count: number;
  custom_prompt_template: string;
}

interface SocialSettingsPanelProps {
  onClose: () => void;
}

export default function SocialSettingsPanel({ onClose }: SocialSettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [settings, setSettings] = useState<SocialSettingsData>({
    meta_page_id: "",
    meta_page_access_token: "",
    meta_ig_user_id: "",
    brand_voice: "profesional y cercano",
    default_platform: "facebook",
    auto_generate: false,
    daily_post_count: 1,
    custom_prompt_template: "",
  });

  // Load existing settings
  useEffect(() => {
    fetch("/api/social/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setSettings((prev) => ({
            ...prev,
            ...data.settings,
            meta_page_id: data.settings.meta_page_id || "",
            meta_page_access_token: data.settings.meta_page_access_token || "",
            meta_ig_user_id: data.settings.meta_ig_user_id || "",
            brand_voice: data.settings.brand_voice || "profesional y cercano",
            default_platform: data.settings.default_platform || "facebook",
            custom_prompt_template: data.settings.custom_prompt_template || "",
          }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/social/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Error guardando configuración.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // FACEBOOK OAUTH — Conectar con un clic (sin Graph API Explorer)
  // ═══════════════════════════════════════════════════════
  const handleFacebookConnect = useCallback(() => {
    setConnecting(true);
    setError(null);

    const redirectUri = `${window.location.origin}/dashboard/social/callback`;
    const permissions = [
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish"
    ].join(",");

    const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${permissions}&response_type=token`;

    // Open popup
    const popup = window.open(oauthUrl, "facebook_oauth", "width=600,height=700,scrollbars=yes");

    // Listen for the token from the callback page
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "META_OAUTH_TOKEN") {
        window.removeEventListener("message", handleMessage);
        const accessToken = event.data.accessToken;
        
        // Auto-configure using the received token (same as Arreglador Mágico Strategy 1)
        try {
          const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`);
          const pagesData = await pagesRes.json();

          if (pagesData.data && pagesData.data.length > 0) {
            const page = pagesData.data[0];
            const newSettings = {
              ...settings,
              meta_page_id: page.id,
              meta_page_access_token: page.access_token || accessToken
            };
            if (page.instagram_business_account?.id) {
              newSettings.meta_ig_user_id = page.instagram_business_account.id;
            }
            setSettings(newSettings);
            setSuccess(true);
            setError(`✅ ¡Conectado! Página "${page.name}" configurada automáticamente. ${page.instagram_business_account?.id ? '📸 Instagram encontrado.' : '⚠️ Sin Instagram vinculado.'} ¡Dale a GUARDAR!`);
            setTimeout(() => setSuccess(false), 8000);
          } else {
            // Token received but no pages — store token and let user try Arreglador Mágico
            setSettings({ ...settings, meta_page_access_token: accessToken });
            setError("Token recibido pero no se encontraron páginas. Prueba el Arreglador Mágico abajo.");
          }
        } catch (err: any) {
          setError(`Error auto-configurando: ${err.message}`);
        }
        setConnecting(false);
      }

      if (event.data?.type === "META_OAUTH_ERROR") {
        window.removeEventListener("message", handleMessage);
        setError(`❌ Facebook rechazó la conexión: ${event.data.error}`);
        setConnecting(false);
      }
    };

    window.addEventListener("message", handleMessage);

    // Check if popup was closed without completing
    const checkPopup = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkPopup);
        setConnecting(false);
      }
    }, 1000);
  }, [settings]);

  const handleFetchIgId = async () => {
    if (!settings.meta_page_access_token) {
      setError("Necesitas colocar al menos tu Token de Acceso.");
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      const token = settings.meta_page_access_token;
      
      // ══════════════════════════════════════════
      // ESTRATEGIA 1: me/accounts (Token de Usuario Personal que admina páginas)
      // ══════════════════════════════════════════
      try {
        const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${token}`);
        const pagesData = await pagesRes.json();
        
        if (pagesData.data && pagesData.data.length > 0) {
          const page = pagesData.data[0];
          const newSettings = { 
            ...settings, 
            meta_page_id: page.id,
            meta_page_access_token: page.access_token || token
          };
          if (page.instagram_business_account?.id) {
            newSettings.meta_ig_user_id = page.instagram_business_account.id;
          }
          setSettings(newSettings);
          setSuccess(true);
          setError(`✅ ¡ÉXITO con Estrategia 1! Página "${page.name}" (ID: ${page.id}) detectada. ${page.instagram_business_account?.id ? 'Instagram Business también encontrado.' : '⚠️ Sin Instagram Business vinculado.'} ¡Dale a GUARDAR!`);
          setTimeout(() => setSuccess(false), 8000);
          return;
        }
      } catch {}

      // ══════════════════════════════════════════
      // ESTRATEGIA 2: Consulta DIRECTA al Page ID si ya tiene uno guardado
      // (funciona con tokens de System User que tienen la página como activo)
      // ══════════════════════════════════════════
      if (settings.meta_page_id) {
        try {
          const directRes = await fetch(`https://graph.facebook.com/v19.0/${settings.meta_page_id}?fields=id,name,access_token,instagram_business_account&access_token=${token}`);
          const directData = await directRes.json();
          
          if (directData.id && !directData.error) {
            const newSettings = { 
              ...settings, 
              meta_page_id: directData.id,
              // Si la API devuelve un Page Access Token dedicado, usarlo (es el que permite PUBLICAR)
              meta_page_access_token: directData.access_token || token
            };
            if (directData.instagram_business_account?.id) {
              newSettings.meta_ig_user_id = directData.instagram_business_account.id;
            }
            setSettings(newSettings);
            setSuccess(true);
            const gotPageToken = !!directData.access_token;
            setError(`✅ ¡ÉXITO con Estrategia 2! Página "${directData.name}" confirmada. ${gotPageToken ? '🔑 Page Token de PUBLICACIÓN obtenido.' : '⚠️ Sin Page Token dedicado, usando token actual.'} ${directData.instagram_business_account?.id ? '📸 Instagram Business encontrado.' : '⚠️ Sin Instagram vinculado.'} ¡Dale a GUARDAR!`);
            setTimeout(() => setSuccess(false), 8000);
            return;
          }
        } catch {}
      }

      // ══════════════════════════════════════════
      // ESTRATEGIA 3: Buscar negocios → páginas de cada negocio  
      // (funciona con Business Manager tokens)
      // ══════════════════════════════════════════
      try {
        const bizRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=businesses.limit(5){id,name,owned_pages.limit(10){id,name,access_token,instagram_business_account}}&access_token=${token}`);
        const bizData = await bizRes.json();
        
        if (bizData.businesses?.data) {
          for (const biz of bizData.businesses.data) {
            if (biz.owned_pages?.data?.length > 0) {
              const page = biz.owned_pages.data[0];
              const newSettings = { 
                ...settings, 
                meta_page_id: page.id,
                meta_page_access_token: page.access_token || token
              };
              if (page.instagram_business_account?.id) {
                newSettings.meta_ig_user_id = page.instagram_business_account.id;
              }
              setSettings(newSettings);
              setSuccess(true);
              setError(`✅ ¡ÉXITO con Estrategia 3! Página "${page.name}" encontrada a través del negocio "${biz.name}". ${page.instagram_business_account?.id ? 'Instagram encontrado.' : '⚠️ Sin Instagram.'} ¡GUARDAR!`);
              setTimeout(() => setSuccess(false), 8000);
              return;
            }
          }
        }
      } catch {}

      // ══════════════════════════════════════════
      // ESTRATEGIA 4: Diagnóstico — ¿Quién eres?
      // ══════════════════════════════════════════
      try {
        const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`);
        const meData = await meRes.json();
        
        if (meData.error) {
          setError(`❌ Token inválido o expirado: ${meData.error.message}`);
        } else {
          setError(`❌ Todas las estrategias fallaron. Tu token pertenece a "${meData.name}" (ID: ${meData.id}), pero NO tiene acceso a ninguna Página de Facebook. SOLUCIÓN: En el Graph API Explorer, dale a "Generate Access Token", y cuando salga la ventana de Facebook, MARCA con el check (☑️) tu Página antes de continuar.`);
        }
      } catch {
        setError("❌ Error de red conectando con Meta. Verifica tu conexión a internet.");
      }

    } catch (err: any) {
      setError(`Error inesperado: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const hasMetaConfig = !!settings.meta_page_id && !!settings.meta_page_access_token;

  if (loading) {
    return (
      <div className="bg-[#121212] rounded-3xl border border-white/5 p-8 shadow-2xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDE00]" />
      </div>
    );
  }

  return (
    <div className="bg-[#121212] rounded-3xl border border-white/5 p-5 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
            <Settings className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Configuración de Redes
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Conecta tus cuentas de Facebook e Instagram
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white p-2 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status Badge */}
      <div className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border ${
        hasMetaConfig
          ? "bg-emerald-500/10 border-emerald-500/20"
          : "bg-amber-500/10 border-amber-500/20"
      }`}>
        {hasMetaConfig ? (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm font-bold text-emerald-400">
              Meta API conectada — publicación real activada
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-bold text-amber-400">
              Modo demo — las publicaciones serán simuladas (mock)
            </span>
          </>
        )}
      </div>

      {success && (
        <div className="mb-6 bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-500/20 font-bold text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> ¡Configuración guardada!
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-500/10 text-red-400 p-3 rounded-xl border border-red-500/20 font-bold text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-8">
        {/* ═══ CONECTAR CON FACEBOOK (ONE CLICK) ═══ */}
        <div className="space-y-4">
          <button
            onClick={handleFacebookConnect}
            disabled={connecting}
            className="w-full py-4 bg-[#1877F2] hover:bg-[#166AE0] disabled:opacity-50 text-white rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-[0_0_25px_rgba(24,119,242,0.3)] active:scale-[0.98]"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            )}
            {connecting ? "Conectando con Facebook..." : "🔗 Conectar con Facebook (1 clic)"}
          </button>
          <p className="text-[10px] text-gray-600 text-center">
            Conecta tu cuenta de Facebook para autoconfigurar todo: Page ID, Token de publicación e Instagram.
            Sin necesidad de copiar tokens manualmente.
          </p>
        </div>

        {/* ═══ CONFIGURACIÓN MANUAL (META GRAPH API) ═══ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Key className="w-3.5 h-3.5" />
              Configuración Manual (avanzado)
            </h3>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20"
            >
              <HelpCircle className="w-3 h-3" />
              {showGuide ? "Cerrar guía" : "¿Cómo obtener los tokens?"}
            </button>
          </div>

          {/* Guide */}
          {showGuide && (
            <div className="bg-[#0b0b0b] border border-purple-500/10 rounded-2xl p-5 space-y-3 text-sm text-gray-400">
              <h4 className="text-purple-400 font-black text-xs uppercase tracking-widest mb-2">
                Guía de configuración
              </h4>
              <ol className="space-y-2 list-decimal list-inside">
                <li>
                  Ve a{" "}
                  <a
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline inline-flex items-center gap-1"
                  >
                    Meta for Developers <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  y crea una app tipo &quot;Business&quot;
                </li>
                <li>
                  En <strong>Products</strong>, agrega &quot;Facebook Login for Business&quot;
                </li>
                <li>
                  Ve a{" "}
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline inline-flex items-center gap-1"
                  >
                    Graph API Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Selecciona tu app → Genera un <strong>Page Access Token</strong> con permisos:
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {["pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish"].map((p) => (
                      <code key={p} className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-500/20">
                        {p}
                      </code>
                    ))}
                  </div>
                </li>
                <li>
                  Copia el <strong>Page ID</strong> y <strong>Page Access Token</strong> generados
                </li>
                <li>
                  Para Instagram: Ve a tu Page → Settings → Instagram → copia el <strong>Instagram User ID</strong>
                </li>
                <li>
                  <strong>Importante:</strong> Para tokens permanentes, convierte el token de corta duración a uno de larga duración usando el endpoint{" "}
                  <code className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                    /oauth/access_token?grant_type=fb_exchange_token
                  </code>
                </li>
              </ol>
            </div>
          )}

          {/* Token visibility toggle */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowTokens(!showTokens)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showTokens ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showTokens ? "Ocultar tokens" : "Mostrar tokens"}
            </button>
          </div>

          {/* Facebook Page ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                Facebook Page ID
              </label>
              <button
                onClick={handleFetchIgId}
                disabled={!settings.meta_page_access_token || saving}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-500/10 px-2 py-1 rounded shadow-[0_0_10px_rgba(16,185,129,0.2)] whitespace-nowrap"
              >
                {saving ? "Escaneando Meta..." : "✨ Arreglador Mágico Meta (Clickea aquí)"}
              </button>
            </div>
            <input
              type={showTokens ? "text" : "password"}
              value={settings.meta_page_id}
              onChange={(e) => setSettings({ ...settings, meta_page_id: e.target.value })}
              placeholder="Ej: 123456789012345 (Dejar vacío e intentar Arreglo Mágico)"
              className="w-full bg-[#050505] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm placeholder-gray-700"
            />
          </div>

          {/* Page Access Token */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Page Access Token
            </label>
            <input
              type={showTokens ? "text" : "password"}
              value={settings.meta_page_access_token}
              onChange={(e) => setSettings({ ...settings, meta_page_access_token: e.target.value })}
              placeholder="EAAxxxxxxx..."
              className="w-full bg-[#050505] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm font-mono placeholder-gray-700"
            />
          </div>

          {/* Instagram User ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                Instagram Business User ID (opcional)
              </label>
            </div>
            <input
              type={showTokens ? "text" : "password"}
              value={settings.meta_ig_user_id}
              onChange={(e) => setSettings({ ...settings, meta_ig_user_id: e.target.value })}
              placeholder="Ej: 17841400000000000"
              className="w-full bg-[#050505] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm placeholder-gray-700"
            />
          </div>
        </div>

        {/* ═══ PREFERENCIAS DE CONTENIDO ═══ */}
        <div className="space-y-4 pt-6 border-t border-white/5">
          <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">
            Preferencias de contenido
          </h3>

          {/* Brand Voice */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Tono de voz de marca
            </label>
            <input
              type="text"
              value={settings.brand_voice}
              onChange={(e) => setSettings({ ...settings, brand_voice: e.target.value })}
              className="w-full bg-[#050505] text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/50 text-sm"
              placeholder="profesional y cercano"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              Define el estilo de los captions generados. Ej: &quot;informal y divertido&quot;, &quot;corporativo serio&quot;, etc.
            </p>
          </div>

          {/* Custom Prompt Template */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">
              Plantilla de prompt personalizada (opcional)
            </label>
            <textarea
              value={settings.custom_prompt_template}
              onChange={(e) => setSettings({ ...settings, custom_prompt_template: e.target.value })}
              placeholder="Deja vacío para usar el prompt por defecto. Usa {topic} como placeholder del tema."
              className="w-full bg-[#050505] text-white border border-white/10 rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/50 resize-none h-24 text-sm placeholder-gray-700"
            />
          </div>
        </div>

        {/* ═══ SAVE BUTTON ═══ */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold text-sm border border-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3.5 bg-[#FFDE00] hover:bg-[#FFC107] text-black rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(255,222,0,0.3)] disabled:opacity-40 active:scale-95"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
