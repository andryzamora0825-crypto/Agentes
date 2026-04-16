"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Clock, Loader2, Send, MessageSquare, X, Image as ImageIcon } from "lucide-react";
import Link from "next/link";

export default function ChatPage() {
  const { user } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";

  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>(isAdmin ? "" : "andryzamora0825@gmail.com");
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  // En móvil: vista = "list" | "chat"
  const [mobileView, setMobileView] = useState<"list" | "chat">(isAdmin ? "list" : "chat");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/chat?action=get_contacts")
        .then(res => res.json())
        .then(data => { if (data.success) setContacts(data.contacts); })
        .catch(console.error);
    }
  }, [isAdmin]);

  const loadMessages = () => {
    if (!selectedContact) return;
    setLoading(true);
    fetch(`/api/chat?targetEmail=${selectedContact}`)
      .then(res => res.json())
      .then(data => { if (data.success) setMessages(data.messages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin && !selectedContact && user) {
       // Regular users start with standard support email automatically
       loadMessages();
    } else if (selectedContact) {
       loadMessages();
    }
    
    // Polling every 7 seconds to get new messages without reload
    const interval = setInterval(() => {
      if (selectedContact) {
        fetch(`/api/chat?targetEmail=${selectedContact}`)
          .then(res => res.json())
          .then(data => { if (data.success) setMessages(data.messages); })
          .catch(() => {});
      }
    }, 7000);
    
    return () => clearInterval(interval);
  }, [isAdmin, selectedContact, user]);

  const handleSelectContact = (email: string) => {
    setSelectedContact(email);
    setMobileView("chat");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !selectedContact) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputMsg, receiver_email: selectedContact })
      });
      if (res.ok) { setInputMsg(""); loadMessages(); }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no debe pesar más de 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: base64, receiver_email: selectedContact })
        });
        if (res.ok) { loadMessages(); }
      } catch (err) {
        console.error(err);
        alert("Error enviando imagen.");
      } finally {
        setSending(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Contenedor principal */}
      <div className="p-2 sm:p-4 h-[calc(100svh-4.5rem)] sm:h-[calc(100vh-5rem)]">
        <div className="bg-[#0F0F0F] rounded-lg border border-white/[0.06] overflow-hidden h-full flex">

          {/* ── SIDEBAR CONTACTOS (Admin) ── */}
          {isAdmin && (
            <div className={`
              ${mobileView === "chat" ? "hidden" : "flex"} 
              sm:flex
              w-full sm:w-72 md:w-80 shrink-0 border-r border-white/[0.06] bg-[#141414] flex-col
            `}>
              {/* Header sidebar */}
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-3 shrink-0">
                <div className="bg-[#FFDE00] p-1.5 rounded-md">
                  <MessageSquare className="w-4 h-4 text-black" />
                </div>
                <span className="font-medium text-white/80 text-sm tracking-tight">Chats</span>
                
                <div className="ml-auto flex items-center gap-3">
                  {contacts.length > 0 && (
                    <span className="bg-[#FFDE00] text-black text-xs font-bold px-2 py-0.5 rounded-full">
                      {contacts.length}
                    </span>
                  )}
                  {/* Close Chat in Contact List View */}
                  <Link href="/dashboard" className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </Link>
                </div>
              </div>

              {/* Lista contactos */}
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {contacts.length === 0 ? (
                  <div className="text-center text-gray-600 text-sm p-6 mt-10">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    Ningún agente te ha escrito aún.
                  </div>
                ) : (
                  contacts.map(c => (
                    <button
                      key={c.email}
                      onClick={() => handleSelectContact(c.email)}
                      className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                        selectedContact === c.email
                          ? "bg-[#FFDE00]/[0.06] border border-[#FFDE00]/15"
                          : "hover:bg-white/[0.03] border border-transparent"
                      }`}
                    >
                      <img
                        src={c.avatar || `https://ui-avatars.com/api/?name=${c.name}&background=1a1a1a&color=FFDE00`}
                        alt="A"
                        className="w-10 h-10 rounded-full border border-white/[0.08] shrink-0"
                      />
                      <div className="overflow-hidden flex-1 min-w-0">
                        <div className={`font-bold text-sm truncate ${selectedContact === c.email ? "text-[#FFDE00]" : "text-gray-300"}`}>
                          {c.name || c.email}
                        </div>
                        <div className="text-xs text-gray-600 truncate">{c.lastMessage}</div>
                      </div>
                      {c.unread > 0 && selectedContact !== c.email && (
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── ZONA PRINCIPAL DEL CHAT ── */}
          <div className={`
            ${isAdmin && mobileView === "list" ? "hidden" : "flex"}
            sm:flex
            flex-1 flex-col bg-[#0A0A0A] relative overflow-hidden min-w-0
          `}>
            {/* Fondo sutil */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "radial-gradient(circle, #FFDE00 1px, transparent 1px)",
              backgroundSize: "28px 28px"
            }} />

            {/* Header chat */}
            <div className="p-3 sm:p-4 bg-[#141414] border-b border-white/[0.06] flex items-center gap-3 z-10 shrink-0">
              {/* Botón volver en móvil para admin */}
              {isAdmin && (
                <button
                  onClick={() => setMobileView("list")}
                  className="sm:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}

              {!isAdmin && (
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#FFDE00] rounded-lg flex items-center justify-center font-semibold text-black shrink-0 text-sm">
                  Z
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-white tracking-tight text-sm sm:text-base truncate">
                  {isAdmin ? (selectedContact || "Selecciona un Agente") : "Soporte Zamtools"}
                </h2>
                {!isAdmin && (
                  <p className="text-[10px] sm:text-xs text-[#FFDE00] font-medium tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#FFDE00] rounded-full animate-pulse inline-block" />
                    En línea
                  </p>
                )}
              </div>
              
              {/* Close Chat typical X */}
              <Link href="/dashboard" className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-zinc-400 hover:text-white transition-all shrink-0 ml-auto">
                <X className="w-5 h-5" />
              </Link>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 z-10">
              {(!selectedContact && isAdmin) ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-700">
                  <Clock className="w-14 h-14 mb-4 opacity-30" />
                  <p className="text-gray-500 font-semibold text-sm text-center px-4">
                    Selecciona un agente para chatear.
                  </p>
                </div>
              ) : loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 text-[#FFDE00] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-xl my-4 text-sm text-zinc-600 font-medium">
                  ¡La conversación está vacía! Escribe tu mensaje abajo.
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_email === user?.primaryEmailAddress?.emailAddress;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] sm:max-w-[65%] p-3 sm:p-3.5 rounded-lg ${
                        isMine
                          ? "bg-[#FFDE00] text-black rounded-tr-sm"
                          : "bg-[#141414] border border-white/[0.06] text-white/70 rounded-tl-sm"
                      }`}>
                        {msg.content.startsWith("data:image/") || msg.content.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ? (
                          <div className="relative group rounded-xl overflow-hidden shadow-sm border border-black/10 inline-block">
                            <img src={msg.content} className="w-full max-w-[250px] sm:max-w-[320px] object-cover" alt="Archivo adjunto" />
                            <button 
                              type="button"
                              onClick={() => setLightboxImg(msg.content)}
                              className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]"
                            >
                              <span className="bg-black/70 text-white text-[11px] px-3 py-1.5 rounded-lg border border-white/20 font-bold uppercase tracking-widest shadow-lg">
                                Ver completa
                              </span>
                            </button>
                          </div>
                        ) : (
                          <p className="text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        <span className={`text-[10px] uppercase font-bold mt-1.5 block text-right ${isMine ? "text-black/40" : "text-gray-600"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input mensaje */}
            {selectedContact && (
              <div className="p-3 sm:p-4 bg-[#141414] border-t border-white/[0.06] z-10 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleImageSelect} 
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="text-zinc-400 p-2.5 sm:p-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-all shrink-0"
                    title="Adjuntar imagen"
                  >
                    <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <input
                    type="text"
                    placeholder="Escribe tu mensaje..."
                    value={inputMsg}
                    onChange={e => setInputMsg(e.target.value)}
                    className="flex-1 bg-[#0A0A0A] text-white/90 placeholder-white/15 border border-white/[0.08] rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 focus:outline-none focus:ring-1 focus:ring-[#FFDE00]/30 transition-colors text-sm min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputMsg.trim()}
                    className="bg-[#FFDE00] text-black p-2.5 sm:p-3 rounded-lg hover:brightness-110 disabled:opacity-50 transition-all shrink-0 active:scale-[0.97]"
                  >
                    {sending ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* MODAL: Lightbox para Ver Imágenes */}
      {lightboxImg && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxImg(null)}
        >
          <button 
            className="absolute top-4 sm:top-8 right-4 sm:right-8 bg-white/10 hover:bg-white/20 p-2 sm:p-3 rounded-full text-white transition-colors"
            onClick={() => setLightboxImg(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxImg} 
            alt="Ampliación" 
            className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
