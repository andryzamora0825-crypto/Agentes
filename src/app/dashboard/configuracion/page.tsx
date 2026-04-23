"use client";

import { UserProfile, useUser, useClerk } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Settings, Shield, Coins, Loader2, Calendar, LogOut, Star, Zap, Upload, Globe, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfiguracionPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>("Cargando...");
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Affiliate linking states
  const [affiliateInput, setAffiliateInput] = useState('');
  const [linkingOperator, setLinkingOperator] = useState(false);
  const [linkedOperatorName, setLinkedOperatorName] = useState<string | null>(null);
  const [linkedOperatorId, setLinkedOperatorId] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      if (user) {
        await user.setProfileImage({ file });
      }
    } catch (err: any) {
      console.error(err);
      alert("Error al subir la imagen: " + (err.errors?.[0]?.longMessage || err.message));
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const syncData = () => {
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
    };
    
    syncData();
    window.addEventListener("credits_updated", syncData);

    // Check if already linked to an operator
    if (user && user.publicMetadata) {
      const meta = user.publicMetadata as any;
      if (meta.linkedOperatorId) {
        setLinkedOperatorId(meta.linkedOperatorId);
        setLinkedOperatorName(meta.linkedOperatorName || 'Agencia Vinculada');
      }
    }
    
    return () => window.removeEventListener("credits_updated", syncData);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDE00]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-5 pb-32 animate-fade-in">

      {/* Header */}
      <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#FFDE00] p-2 rounded-lg">
              <Settings className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white/90">Configuración</h1>
              <p className="text-white/30 mt-0.5 text-sm">Tu identidad digital y beneficios.</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/15 px-4 py-2 rounded-lg font-medium text-sm transition-colors group shrink-0"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Avatar + Name */}
        <div className="bg-[#141414] border border-white/[0.06] rounded-lg p-4 flex items-center gap-3.5 hover:border-white/[0.1] transition-colors">
          <div className="relative group/avatar shrink-0 w-12 h-12">
            {uploadingAvatar ? (
              <div className="w-12 h-12 rounded-xl bg-[#050505] border border-white/[0.07] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[#FFDE00] animate-spin" />
              </div>
            ) : (
              <>
                <img
                  src={user?.imageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}&background=111113&color=FFDE00`}
                  alt="Avatar"
                  className="w-12 h-12 rounded-xl border border-white/[0.07] object-cover"
                />
                <label className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="w-4 h-4 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </label>
              </>
            )}
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">{user?.fullName || user?.firstName}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{user?.primaryEmailAddress?.emailAddress}</div>
          </div>
        </div>

        {/* Credits */}
        <div className="bg-[#141414] border border-white/[0.06] rounded-lg p-4 hover:border-[#FFDE00]/15 transition-colors group">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Coins className="w-3 h-3 text-[#FFDE00]" /> Billetera
          </div>
          {credits === null ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#FFDE00]" />
          ) : (
            <div className="text-xl font-semibold text-white/80 group-hover:text-[#FFDE00]/80 transition-colors">
              {credits.toLocaleString()}
              <span className="text-sm font-medium text-zinc-600 ml-1.5">créditos</span>
            </div>
          )}
        </div>

        {/* Plan */}
        <div className={`bg-[#141414] border rounded-lg p-4 transition-colors ${plan === 'VIP' ? 'border-[#FFDE00]/15 hover:border-[#FFDE00]/20' : 'border-white/[0.06] hover:border-white/[0.1]'}`}>
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#FFDE00]" /> Rango
          </div>
          <div className="flex items-center gap-2.5">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs ${
              plan === 'VIP'
                ? 'bg-[#FFDE00] text-black'
                : 'bg-white/[0.06] text-zinc-400 border border-white/[0.06]'
            }`}>
              {plan === 'VIP' ? <Star className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              {plan}
            </div>
          </div>
          {plan === "VIP" && daysLeft > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <Calendar className="w-3 h-3 text-[#FFDE00]" />
              Expira en {daysLeft} días
            </div>
          )}
        </div>

      </div>

      {/* Vincular Agencia / Operador */}
      {(user?.publicMetadata as any)?.role !== 'operator' && (
        <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
              <Link2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white/90 tracking-tight">Vinculación de Agencia</h2>
              <p className="text-white/30 text-sm mt-0.5">Conecta tu cuenta a un operador autorizado.</p>
            </div>
          </div>

          {linkedOperatorId ? (
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400">Vinculado exitosamente</p>
                <p className="text-xs text-white/30 mt-0.5">Tu cuenta está conectada permanentemente a: <strong className="text-white/50">{linkedOperatorName}</strong></p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={affiliateInput}
                onChange={(e) => setAffiliateInput(e.target.value.toUpperCase())}
                placeholder="Ej: OP-7F4B2"
                className="flex-1 bg-[#0A0A0A] border border-white/[0.08] rounded-lg px-4 py-3 text-white/90 text-sm focus:outline-none focus:border-cyan-500/40 placeholder-white/20 font-bold tracking-widest uppercase transition-colors"
              />
              <button
                disabled={linkingOperator || !affiliateInput.trim()}
                onClick={async () => {
                  if (!confirm('⚠️ ATENCIÓN: Este enlace es PERMANENTE e IRREVERSIBLE. ¿Estás seguro de vincularte a esta agencia?')) return;
                  setLinkingOperator(true);
                  try {
                    const res = await fetch('/api/user/link-operator', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ affiliateCode: affiliateInput.trim() })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setLinkedOperatorId('linked');
                      setLinkedOperatorName(data.operatorName);
                      alert(data.message);
                    } else {
                      alert(data.error);
                    }
                  } catch (e) {
                    alert('Error de conexión.');
                  } finally {
                    setLinkingOperator(false);
                  }
                }}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-3 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-2 justify-center shrink-0"
              >
                {linkingOperator ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Vincular
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clerk UserProfile */}
      <div className="rounded-lg overflow-hidden border border-white/[0.06]">
        <UserProfile
          routing="hash"
          appearance={{
            baseTheme: dark,
            variables: {
              colorBackground: "#111113",
              colorInputBackground: "#09090b",
              colorInputText: "#FAFAFA",
              colorText: "#FAFAFA",
              colorTextSecondary: "#71717A",
              colorPrimary: "#FFDE00",
              colorDanger: "#EF4444",
              colorSuccess: "#22C55E",
              colorNeutral: "#71717A",
              borderRadius: "0.5rem",
              fontFamily: "Inter, system-ui, sans-serif",
            },
            elements: {
              rootBox: "w-full",
              card: "w-full shadow-none border-0 bg-[#111113]",
              navbar: "bg-[#09090b] border-r border-white/[0.06]",
              navbarButton: "text-zinc-400 hover:text-white hover:bg-white/[0.04]",
              navbarButtonActive: "text-[#FFDE00] bg-[#FFDE00]/10",
              pageScrollBox: "p-4 sm:p-6",
              page: "text-white",
              profileSectionTitle: "text-white font-bold",
              profileSectionTitleText: "text-white",
              profileSectionContent: "border-white/[0.06]",
              profileSectionPrimaryButton: "text-[#FFDE00] hover:text-[#ffe94d]",
              formFieldLabel: "text-zinc-300 font-medium",
              formFieldInput: "bg-[#09090b] border-white/[0.08] text-white",
              formFieldHintText: "text-zinc-500",
              formFieldSuccessText: "text-emerald-400",
              formFieldErrorText: "text-red-400",
              formButtonPrimary: "bg-[#FFDE00] text-black font-bold hover:bg-[#ffe94d]",
              formButtonReset: "text-zinc-400 hover:text-white",
              headerTitle: "text-white",
              headerSubtitle: "text-zinc-500",
              dividerLine: "bg-white/[0.06]",
              dividerText: "text-zinc-600",
              badge: "bg-[#FFDE00]/10 text-[#FFDE00] border-[#FFDE00]/15",
              userPreviewTextContainer: "text-white",
              userPreviewSecondaryIdentifier: "text-zinc-500",
              menuList: "bg-[#111113] border-white/[0.08]",
              menuItem: "text-zinc-300 hover:bg-white/[0.04] hover:text-white",
              alertText: "text-zinc-300",
              accordionTriggerButton: "text-white",
              accordionContent: "text-zinc-300",
              activeDeviceListItem: "border-white/[0.08]",
              deviceListItem__current: "border-[#FFDE00]/15",
            }
          }}
        />
      </div>

      {/* AI Settings */}
      <AiSettingsForm />

    </div>
  );
}

// ── AI SETTINGS FORM ── //
import { supabase } from "@/lib/supabase";
import { Check, Save, Sparkles } from "lucide-react";

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
    characterImageUrl: "",
    activePlatforms: ["ecuabet"],
    aiEnabled: true,
  });

  const [loadingImg, setLoadingImg] = useState<{ [key: string]: boolean }>({});

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
        await user?.reload();
        alert("Configuración guardada.");
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
    <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg mt-6">
      
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-white/[0.06] p-2 rounded-lg">
          <Sparkles className="w-5 h-5 text-white/90" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white/90 tracking-tight">Identidad de Marca IA</h2>
          <p className="text-white/40 text-sm mt-0.5">Configura cómo la IA visualiza tu agencia.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-white/40">Nombre de la Agencia</span>
          <input type="text" name="agencyName" value={form.agencyName} onChange={handleChange} placeholder="Ej: Reyes Ecuabet" className="bg-[#0A0A0A] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white/90 text-sm focus:outline-none focus:border-white/20 placeholder-white/20 transition-colors" />
        </label>
        
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-white/40">Número de Contacto</span>
          <input type="text" name="contactNumber" value={form.contactNumber} onChange={handleChange} placeholder="+593 9..." className="bg-[#0A0A0A] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white/90 text-sm focus:outline-none focus:border-white/20 placeholder-white/20 transition-colors" />
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium text-white/40">Descripción (Tono, Estilo, Rubro)</span>
          <textarea name="agencyDesc" value={form.agencyDesc} onChange={handleChange} rows={3} placeholder="Describe tu local, colores, estilo..." className="bg-[#0A0A0A] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white/90 text-sm focus:outline-none focus:border-white/20 placeholder-white/20 resize-none transition-colors"></textarea>
        </label>

        {/* Colors */}
        <div className="flex flex-col gap-1.5 border border-white/[0.06] p-3 rounded-lg bg-[#0A0A0A]">
          <span className="text-sm font-medium text-white/40">Color Primario</span>
          <div className="flex items-center gap-3">
            <input type="color" name="primaryColor" value={form.primaryColor} onChange={handleChange} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
            <span className="text-white/40 font-mono text-xs">{form.primaryColor}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border border-white/[0.06] p-3 rounded-lg bg-[#0A0A0A]">
          <span className="text-sm font-medium text-white/40">Color Secundario</span>
          <div className="flex items-center gap-3">
            <input type="color" name="secondaryColor" value={form.secondaryColor} onChange={handleChange} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
            <span className="text-white/40 font-mono text-xs">{form.secondaryColor}</span>
          </div>
        </div>

        {/* Image uploads */}
        {[
          { key: 'agencyLogoUrl', label: 'Logo de la Agencia', desc: 'Tu logo oficial de agencia' },
          { key: 'inspLogoUrl', label: 'Referencia Visual', desc: 'Imagen de estilo deseado' },
          { key: 'characterImageUrl', label: 'Personaje', desc: 'Foto del representante de tu agencia' }
        ].map((item) => {
          const hasImage = (form[item.key as keyof typeof form] as string) !== "";
          return (
            <div key={item.key} className="flex flex-col gap-2.5 border border-white/[0.06] p-3 rounded-lg bg-[#0A0A0A]">
              <span className="text-sm font-medium text-white/40">{item.label}</span>
              <span className="text-xs text-white/20">{item.desc}</span>

              {hasImage ? (
                <div className="flex flex-col items-center gap-2.5 mt-1">
                  <div className="relative w-full h-28 rounded-lg overflow-hidden border border-white/[0.06] bg-[#0A0A0A]">
                    <img src={form[item.key as keyof typeof form] as string} className="w-full h-full object-contain" />
                    <div className="absolute top-1.5 right-1.5 bg-emerald-500 p-0.5 rounded text-white">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <label className="flex-1 cursor-pointer text-center hover:bg-white/[0.04] text-white/60 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] transition-colors">
                      {loadingImg[item.key] ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : <Upload className="w-3 h-3 inline mr-1" />}
                      Cambiar
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, item.key)} />
                    </label>
                    <button
                      className="px-3 py-1.5 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/10 transition-colors"
                      onClick={() => setForm(p => ({ ...p, [item.key]: "" }))}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <label className="mt-1 cursor-pointer flex flex-col items-center justify-center gap-1.5 border border-dashed border-white/[0.08] hover:border-white/20 rounded-lg p-4 transition-colors">
                  {loadingImg[item.key] ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                  ) : (
                    <Upload className="w-5 h-5 text-white/40 transition-colors" />
                  )}
                  <span className="text-xs text-white/40 font-medium transition-colors">
                    {loadingImg[item.key] ? "Subiendo..." : "Seleccionar"}
                  </span>
                  <span className="text-[9px] text-white/20">JPG · PNG</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e, item.key)} />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Plataformas de Apuestas */}
      <div className="mt-8 border-t border-white/[0.06] pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/[0.06] p-2 rounded-lg">
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white/90">Plataformas de Apuestas</h3>
            <p className="text-white/40 text-sm mt-0.5">Selecciona las casas de apuestas con las que trabajas.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: "ecuabet", name: "Ecuabet", color: "text-[#FFDE00]" },
            { id: "doradobet", name: "DoradoBet", color: "text-[#F5A623]" },
            { id: "masparley", name: "MasParley", color: "text-[#e82f2f]" },
            { id: "databet", name: "DataBet", color: "text-[#1d4ed8]" },
            { id: "astrobet", name: "AstroBet", color: "text-[#4A8FE7]" },
          ].map((plat) => {
            const isActive = form.activePlatforms.includes(plat.id);
            return (
              <div 
                key={plat.id}
                onClick={() => {
                  setForm(prev => {
                    const platforms = prev.activePlatforms || [];
                    if (platforms.includes(plat.id)) {
                      return { ...prev, activePlatforms: platforms.filter(p => p !== plat.id) };
                    } else {
                      return { ...prev, activePlatforms: [...platforms, plat.id] };
                    }
                  });
                }}
                className={`p-4 rounded-xl cursor-pointer flex items-center justify-between border transition-all ${
                  isActive 
                  ? 'bg-white/[0.04] border-white/20 shadow-sm' 
                  : 'bg-[#0A0A0A] border-white/[0.04] hover:bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <span className={`font-medium text-sm tracking-wide transition-colors ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                  {plat.name}
                </span>
                <div className={`w-8 h-4.5 rounded-full relative transition-colors ${isActive ? 'bg-current opacity-90 ' + plat.color : 'bg-white/[0.08]'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform shadow-sm ${isActive ? 'translate-x-[14px]' : 'translate-x-0'}`}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button 
          onClick={saveSettings} 
          disabled={saving}
          className="bg-[#FFDE00] text-black px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Configuración
        </button>
      </div>

    </div>
  );
}
