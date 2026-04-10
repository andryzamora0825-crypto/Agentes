"use client";

import { useState, useEffect } from "react";
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
        {/* ═══ META GRAPH API ═══ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Key className="w-3.5 h-3.5" />
              Meta Graph API (Facebook + Instagram)
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
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Facebook Page ID
            </label>
            <input
              type={showTokens ? "text" : "password"}
              value={settings.meta_page_id}
              onChange={(e) => setSettings({ ...settings, meta_page_id: e.target.value })}
              placeholder="Ej: 123456789012345"
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
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1.5">
              <Camera className="w-3.5 h-3.5 text-pink-400" />
              Instagram Business User ID (opcional)
            </label>
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
