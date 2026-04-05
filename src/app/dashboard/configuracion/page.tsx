"use client";

import { UserProfile, useUser, useClerk } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Settings, Shield, Coins, Loader2, Calendar, LogOut, Star, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfiguracionPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>("Cargando...");
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    fetch("/api/user/sync")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCredits(data.credits);
          setPlan(data.plan || "FREE");
          setDaysLeft(data.daysLeft || 0);
        }
      })
      .catch(console.error);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-[#FFDE00] drop-shadow-[0_0_10px_rgba(255,222,0,0.5)]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 pb-32">

      {/* ── Header ── */}
      <div className="relative bg-[#111111] border border-white/5 p-6 sm:p-8 rounded-3xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FFDE00]/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <div className="bg-[#FFDE00] p-2 rounded-xl shadow-[0_0_15px_rgba(255,222,0,0.4)]">
                <Settings className="w-7 h-7 text-black" />
              </div>
              Perfil y Configuración
            </h1>
            <p className="text-gray-400 mt-2 text-sm max-w-md">
              Administra tu identidad digital y revisa los beneficios activos de tu membresía.
            </p>
          </div>

          {/* Botón Cerrar Sesión */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 px-5 py-2.5 rounded-xl font-bold transition-all group shrink-0"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* ── Info Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Avatar + Nombre */}
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
          <img
            src={user?.imageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}&background=1a1a1a&color=FFDE00`}
            alt="Avatar"
            className="w-14 h-14 rounded-2xl border border-white/10 object-cover"
          />
          <div>
            <div className="font-black text-white text-lg leading-tight">{user?.fullName || user?.firstName}</div>
            <div className="text-xs text-gray-500 mt-0.5">{user?.primaryEmailAddress?.emailAddress}</div>
          </div>
        </div>

        {/* Créditos */}
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5 hover:border-[#FFDE00]/20 transition-colors group">
          <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <Coins className="w-3.5 h-3.5 text-[#FFDE00]" /> Billetera Zamtools
          </div>
          {credits === null ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#FFDE00]" />
          ) : (
            <div className="text-4xl font-black text-white group-hover:text-[#FFDE00] transition-colors">
              {credits.toLocaleString()}
              <span className="text-base font-bold text-gray-600 ml-2">créditos</span>
            </div>
          )}
        </div>

        {/* Plan */}
        <div className={`bg-[#111111] border rounded-2xl p-5 transition-colors ${plan === 'VIP' ? 'border-[#FFDE00]/20 hover:border-[#FFDE00]/40' : 'border-white/5 hover:border-white/10'}`}>
          <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#FFDE00]" /> Rango Actual
          </div>
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase tracking-wider text-sm ${
              plan === 'VIP'
                ? 'bg-[#FFDE00] text-black shadow-[0_0_20px_rgba(255,222,0,0.3)]'
                : 'bg-white/5 text-gray-400 border border-white/10'
            }`}>
              {plan === 'VIP' ? <Star className="w-4 h-4 fill-black" /> : <Zap className="w-4 h-4" />}
              {plan}
            </div>
          </div>
          {plan === "VIP" && daysLeft > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-500">
              <Calendar className="w-3.5 h-3.5 text-[#FFDE00]" />
              Expira en {daysLeft} días
            </div>
          )}
        </div>

      </div>

      {/* ── Clerk UserProfile (hash routing evita el error de catch-all) ── */}
      <div className="rounded-3xl overflow-hidden border border-white/5 shadow-xl">
        <UserProfile
          routing="hash"
          appearance={{
            baseTheme: dark,
            variables: {
              colorBackground: "#111111",
              colorInputBackground: "#0A0A0A",
              colorInputText: "#FFFFFF",
              colorText: "#FFFFFF",
              colorTextSecondary: "#9CA3AF",
              colorPrimary: "#FFDE00",
              colorDanger: "#EF4444",
              colorSuccess: "#22C55E",
              colorNeutral: "#9CA3AF",
              borderRadius: "0.75rem",
              fontFamily: "inherit",
            },
            elements: {
              rootBox: "w-full",
              card: "w-full shadow-none border-0 bg-[#111111]",
              navbar: "bg-[#0D0D0D] border-r border-white/5",
              navbarButton: "text-gray-400 hover:text-white hover:bg-white/5",
              navbarButtonActive: "text-[#FFDE00] bg-[#FFDE00]/10",
              pageScrollBox: "p-4 sm:p-6",
              page: "text-white",
              profileSectionTitle: "text-white font-bold",
              profileSectionTitleText: "text-white",
              profileSectionContent: "border-white/5",
              profileSectionPrimaryButton: "text-[#FFDE00] hover:text-[#FFC107]",
              formFieldLabel: "text-gray-300 font-semibold",
              formFieldInput: "bg-[#0A0A0A] border-white/10 text-white",
              formFieldHintText: "text-gray-400",
              formFieldSuccessText: "text-green-400",
              formFieldErrorText: "text-red-400",
              formButtonPrimary: "bg-[#FFDE00] text-black font-bold hover:bg-[#FFC107]",
              formButtonReset: "text-gray-400 hover:text-white",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              dividerLine: "bg-white/5",
              dividerText: "text-gray-600",
              badge: "bg-[#FFDE00]/10 text-[#FFDE00] border-[#FFDE00]/20",
              userPreviewTextContainer: "text-white",
              userPreviewSecondaryIdentifier: "text-gray-400",
              menuList: "bg-[#111111] border-white/10",
              menuItem: "text-gray-300 hover:bg-white/5 hover:text-white",
              alertText: "text-gray-300",
              accordionTriggerButton: "text-white",
              accordionContent: "text-gray-300",
              activeDeviceListItem: "border-white/10",
              deviceListItem__current: "border-[#FFDE00]/20",
            }
          }}
        />
      </div>

      {/* ── Identidad de Agencia (IA) ── */}
      <AiSettingsForm />

    </div>
  );
}

// ── COMPONENTE FORMULARIO IA ── //
import { supabase } from "@/lib/supabase";
import { Upload, Check, Save, Sparkles } from "lucide-react";

function AiSettingsForm() {
  const { user, isLoaded } = useUser();
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    agencyName: "",
    agencyDesc: "",
    primaryColor: "#FFDE00",
    secondaryColor: "#000000",
    contactNumber: "",
    extraContact: "",
    agencyLogoUrl: "",
    inspLogoUrl: "",
    brandLogoUrl: "",
    aiEnabled: true,
  });

  const [loadingImg, setLoadingImg] = useState<{ [key: string]: boolean }>({});

  // Cargar datos previos
  useEffect(() => {
    if (isLoaded && user && user.publicMetadata?.aiSettings) {
      setForm((prev) => ({
        ...prev,
        ...(user.publicMetadata.aiSettings as any)
      }));
    }
  }, [user, isLoaded]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const uploadImage = async (e: any, fieldName: string) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingImg(p => ({ ...p, [fieldName]: true }));
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}_${fieldName}_${Date.now()}.${fileExt}`;
    
    try {
      const { data, error } = await supabase.storage
        .from('ai-generations')
        .upload(`agency-assets/${fileName}`, file, { cacheControl: '3600', upsert: false });
        
      if (error) throw error;
      
      const publicURL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-generations/agency-assets/${fileName}`;
      setForm(p => ({ ...p, [fieldName]: publicURL }));
      
    } catch (err) {
      console.error("Error subiendo imagen:", err);
      alert("Hubo un error subiendo la imagen.");
    } finally {
      setLoadingImg(p => ({ ...p, [fieldName]: false }));
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if(data.success) {
        // Soft reload de Clerk para inyectar nueva metadata al user object
        await user?.reload();
        alert("Configuración de IA Guardada con éxito.");
      } else {
        alert("Error guardando.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#111111] border border-[#FFDE00]/20 p-6 sm:p-8 rounded-3xl mt-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFDE00]/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-[#FFDE00]/10 p-2.5 rounded-xl border border-[#FFDE00]/20">
          <Sparkles className="w-6 h-6 text-[#FFDE00]" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Estudio IA • Identidad de Marca</h2>
          <p className="text-gray-400 text-sm mt-1">Configura cómo la IA debe visualizar tu agencia al generar contenido y fotos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-gray-300">Nombre de la Agencia</span>
          <input type="text" name="agencyName" value={form.agencyName} onChange={handleChange} placeholder="Ej: Reyes Ecuabet" className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFDE00]/50 placeholder-gray-600" />
        </label>
        
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-gray-300">Número de Contacto Primario</span>
          <input type="text" name="contactNumber" value={form.contactNumber} onChange={handleChange} placeholder="+593 9..." className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFDE00]/50 placeholder-gray-600" />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-bold text-gray-300">Descripción de la Agencia (Tono, Estilo, Rubro)</span>
          <textarea name="agencyDesc" value={form.agencyDesc} onChange={handleChange} rows={3} placeholder="Describe qué colores usan tus cajeros, de qué trata tu local, ideas principales..." className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFDE00]/50 placeholder-gray-600 resize-none"></textarea>
        </label>

        {/* COLORES */}
        <div className="flex flex-col gap-2 border border-white/5 p-4 rounded-xl bg-[#0A0A0A]">
          <span className="text-sm font-bold text-gray-300">Color Primario</span>
          <div className="flex items-center gap-4">
            <input type="color" name="primaryColor" value={form.primaryColor} onChange={handleChange} className="w-12 h-12 rounded-lg cursor-pointer bg-transparent" />
            <span className="text-gray-400 uppercase font-mono text-xs">{form.primaryColor}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border border-white/5 p-4 rounded-xl bg-[#0A0A0A]">
          <span className="text-sm font-bold text-gray-300">Color Secundario</span>
          <div className="flex items-center gap-4">
            <input type="color" name="secondaryColor" value={form.secondaryColor} onChange={handleChange} className="w-12 h-12 rounded-lg cursor-pointer bg-transparent" />
            <span className="text-gray-400 uppercase font-mono text-xs">{form.secondaryColor}</span>
          </div>
        </div>

        {/* LOGOS REFS */}
        {[
          { key: 'agencyLogoUrl', label: 'Logo Principal', desc: 'Sube tu logo para que la IA lo vea' },
          { key: 'inspLogoUrl', label: 'Referencia de Inspiración', desc: 'Una imagen de las chicas o estilo que quieres' },
          { key: 'brandLogoUrl', label: 'Logo de Marca Extra', desc: 'Alguna otra marca que quieres que aparezca' }
        ].map((item) => {
          const hasImage = (form[item.key as keyof typeof form] as string) !== "";
          return (
            <div key={item.key} className="flex flex-col gap-3 border border-white/10 p-4 rounded-xl bg-[#0A0A0A] hover:border-white/20 transition-colors">
              <span className="text-sm font-bold text-gray-300">{item.label}</span>
              <span className="text-xs text-gray-500">{item.desc}</span>

              {hasImage ? (
                <div className="flex flex-col items-center gap-3 mt-2">
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-white/10">
                    <img src={form[item.key as keyof typeof form] as string} className="w-full h-full object-contain bg-black" />
                    <div className="absolute top-2 right-2 bg-green-500/90 p-1 rounded-full">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <label className="flex-1 cursor-pointer text-center bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-2 rounded-lg text-xs font-bold border border-white/10 transition-colors">
                      {loadingImg[item.key] ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : <Upload className="w-3 h-3 inline mr-1" />}
                      Cambiar
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, item.key)} />
                    </label>
                    <button
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 transition-colors"
                      onClick={() => setForm(p => ({ ...p, [item.key]: "" }))}
                    >
                      ✕ Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <label className="mt-2 cursor-pointer flex flex-col items-center gap-2 border-2 border-dashed border-white/10 hover:border-[#FFDE00]/30 rounded-xl p-5 transition-colors hover:bg-[#FFDE00]/5 group/up">
                  {loadingImg[item.key] ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#FFDE00]" />
                  ) : (
                    <Upload className="w-6 h-6 text-gray-600 group-hover/up:text-[#FFDE00] transition-colors" />
                  )}
                  <span className="text-xs text-gray-500 group-hover/up:text-gray-400 font-semibold transition-colors">
                    {loadingImg[item.key] ? "Subiendo..." : "Seleccionar Archivo"}
                  </span>
                  <span className="text-[10px] text-gray-700 uppercase tracking-widest">JPG · PNG · WEBP</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, item.key)} />
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <button 
          onClick={saveSettings} 
          disabled={saving}
          className="bg-[#FFDE00] text-black px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#FFC107] transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Identidad
        </button>
      </div>

    </div>
  );
}

