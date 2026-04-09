"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Search, Plus, X, UploadCloud, ShieldAlert, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import VipGate from "@/components/VipGate";

export default function EstafadoresPage() {
  const { user } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";
  const [isVip, setIsVip] = useState(false);

  const [searchPhone, setSearchPhone] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);

  // Verificar plan del usuario
  useEffect(() => {
    fetch("/api/user/sync")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsVip(data.plan === "VIP");
        }
      })
      .catch(console.error);
  }, []);

  const canReport = isAdmin || isVip;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone.trim()) return;
    
    setIsSearching(true);
    setSearchAttempted(true);
    setSearchResult(null);

    try {
      const res = await fetch(`/api/scammers?phone=${encodeURIComponent(searchPhone)}`);
      const data = await res.json();
      
      if (data.found && data.data) {
        setSearchResult(data.data);
      }
    } catch (error) {
      console.error("Error buscando:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <VipGate>
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="bg-red-500/20 p-2 rounded-xl border border-red-500/30">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
            Directorio de Alertas
          </h1>
          <p className="text-gray-400 mt-1">Busca números telefónicos para verificar antecedentes de fraude.</p>
        </div>
        {canReport && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-[#FFDE00] text-black px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#FFC107] hover:shadow-[0_0_15px_rgba(255,222,0,0.3)] transition-all"
          >
            <Plus className="w-5 h-5" />
            Añadir Reporte
          </button>
        )}
      </div>

      {/* Buscador */}
      <form onSubmit={handleSearch} className="relative max-w-2xl">
        <div className="relative flex items-center">
          <Search className="w-6 h-6 text-gray-500 absolute left-4" />
          <input 
            type="text"
            placeholder="Buscar por número de celular (ej: 0987654321)"
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="w-full pl-14 pr-32 py-4 bg-[#0A0A0A] border border-white/10 rounded-2xl text-lg font-medium text-white placeholder-gray-600 focus:outline-none focus:border-[#FFDE00] focus:ring-2 focus:ring-[#FFDE00]/20 transition-all"
          />
          <button 
            type="submit"
            disabled={isSearching}
            className="absolute right-2 top-2 bottom-2 bg-[#FFDE00] text-black px-6 rounded-xl font-bold hover:bg-[#FFC107] transition-colors flex items-center"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buscar"}
          </button>
        </div>
      </form>

      {/* Resultado de la Búsqueda */}
      {searchAttempted && !isSearching && (
        <div className="mt-8">
          {searchResult ? (
            <div className="bg-white border-2 border-red-500 rounded-3xl p-6 md:p-10 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Main Photo */}
                <div className="shrink-0 w-32 h-32 md:w-48 md:h-48 rounded-2xl border-4 border-red-100 overflow-hidden bg-gray-50 flex items-center justify-center">
                  {searchResult.photo_url ? (
                    <img src={searchResult.photo_url} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <AlertTriangle className="w-16 h-16 text-red-300" />
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase tracking-widest mb-3">
                      <AlertTriangle className="w-3.5 h-3.5" /> Estafador Confirmado
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">{searchResult.name || "Sujeto Desconocido"}</h2>
                    <p className="text-2xl font-mono text-red-600 font-bold mt-1">{searchResult.phone_number}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700">
                    <p className="font-semibold text-gray-900 mb-1">Descripción de los echos:</p>
                    <p className="whitespace-pre-wrap">{searchResult.description || "Sin descripción adicional."}</p>
                  </div>
                  
                  {/* Pruebas */}
                  {searchResult.proof_urls && searchResult.proof_urls.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <p className="font-bold text-gray-900 mb-3">Capturas de Prueba ({searchResult.proof_urls.length})</p>
                      <div className="flex flex-wrap gap-3">
                        {searchResult.proof_urls.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-lg border-2 border-gray-200 overflow-hidden hover:border-red-400 transition-colors block">
                            <img src={url} alt={`Prueba ${i+1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-800">No se encontraron reportes</h3>
              <p className="text-green-600 mt-2">El número <strong>{searchPhone}</strong> no tiene reportes de fraude en nuestra base de datos por ahora.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Agregar Reporte */}
      {showAddForm && canReport && (
        <AddScammerModal onClose={() => setShowAddForm(false)} />
      )}
    </div>
    </VipGate>
  );
}

function AddScammerModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mainPhoto, setMainPhoto] = useState<File | null>(null);
  const [proofs, setProofs] = useState<File[]>([]);

  const handleProofsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 5); // Max 5
      setProofs(filesArray);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setError("El número de teléfono es obligatorio.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const fd = new FormData();
      fd.append("phone_number", phone);
      fd.append("name", name);
      fd.append("description", description);
      if (mainPhoto) fd.append("main_photo", mainPhoto);
      
      proofs.forEach((file, index) => {
        fd.append(`proof_${index}`, file);
      });

      const res = await fetch("/api/scammers", {
        method: "POST",
        body: fd
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al subir el reporte");
      }

      setSuccess(true);
      setTimeout(() => onClose(), 2000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-red-100 p-3 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Añadir Reporte de Estafador</h2>
          </div>

          {success ? (
            <div className="py-12 text-center text-green-600">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-bold">¡Reporte subido con éxito!</h3>
              <p>El directorio ha sido actualizado.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Número de Teléfono *</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="Ej: 0912345678" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#23274A] outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Alias / Nombre</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Juan Perez" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#23274A] outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Detalles de la Estafa</label>
                <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe cómo opera..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#23274A] outline-none resize-none"></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 block">Identificación (1 foto)</label>
                  <input type="file" accept="image/*" onChange={e => setMainPhoto(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#FFDE00]/20 file:text-[#23274A] hover:file:bg-[#FFDE00]/30 cursor-pointer" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 block">Pruebas/Chats (Max 5)</label>
                  <input type="file" multiple accept="image/*" onChange={handleProofsChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300 cursor-pointer" />
                  <p className="text-xs text-gray-400 font-medium">Seleccionadas: {proofs.length}/5</p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={onClose} disabled={loading} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || !phone} className="px-8 py-3 font-bold bg-[#23274A] text-white hover:bg-[#1A1D36] rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                  Subir al Directorio
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
