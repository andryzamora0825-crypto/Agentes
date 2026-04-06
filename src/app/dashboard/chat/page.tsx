"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Clock, Loader2, Send, MessageSquare, X } from "lucide-react";
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (!isAdmin) {
      loadMessages();
    } else if (isAdmin && selectedContact) {
      loadMessages();
    }
  }, [isAdmin, selectedContact]);

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

  return (
    <>
      {/* Contenedor principal */}
      <div className="p-2 sm:p-4 h-[calc(100svh-4.5rem)] sm:h-[calc(100vh-5rem)]">
        <div className="bg-[#0A0A0A] rounded-2xl sm:rounded-3xl border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden h-full flex">

          {/* ── SIDEBAR CONTACTOS (Admin) ── */}
          {isAdmin && (
            <div className={`
              ${mobileView === "chat" ? "hidden" : "flex"} 
              sm:flex
              w-full sm:w-72 md:w-80 shrink-0 border-r border-white/5 bg-[#111111] flex-col
            `}>
              {/* Header sidebar */}
              <div className="p-4 border-b border-white/5 flex items-center gap-3 shrink-0">
                <div className="bg-[#FFDE00] p-1.5 rounded-lg shadow-[0_0_10px_rgba(255,222,0,0.3)]">
                  <MessageSquare className="w-4 h-4 text-black" />
                </div>
                <span className="font-black text-white tracking-tight">Chats Activos</span>
                
                <div className="ml-auto flex items-center gap-3">
                  {contacts.length > 0 && (
                    <span className="bg-[#FFDE00] text-black text-xs font-black px-2 py-0.5 rounded-full">
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
                      className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${
                        selectedContact === c.email
                          ? "bg-[#FFDE00]/10 border border-[#FFDE00]/20"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <img
                        src={c.avatar || `https://ui-avatars.com/api/?name=${c.name}&background=1a1a1a&color=FFDE00`}
                        alt="A"
                        className="w-10 h-10 rounded-full border border-white/10 shrink-0"
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
            flex-1 flex-col bg-[#0D0D0D] relative overflow-hidden min-w-0
          `}>
            {/* Fondo sutil */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "radial-gradient(circle, #FFDE00 1px, transparent 1px)",
              backgroundSize: "28px 28px"
            }} />

            {/* Header chat */}
            <div className="p-3 sm:p-4 bg-[#111111] border-b border-white/5 flex items-center gap-3 z-10 shrink-0">
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
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#FFDE00] rounded-full flex items-center justify-center font-black text-black shadow-[0_0_15px_rgba(255,222,0,0.3)] shrink-0 text-sm">
                  Z
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h2 className="font-black text-white tracking-tight text-sm sm:text-base truncate">
                  {isAdmin ? (selectedContact || "Selecciona un Agente") : "Soporte Zamtools"}
                </h2>
                {!isAdmin && (
                  <p className="text-[10px] sm:text-xs text-[#FFDE00] font-bold tracking-widest uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#FFDE00] rounded-full animate-pulse inline-block" />
                    En línea
                  </p>
                )}
              </div>
              
              {/* Close Chat typical X */}
              <Link href="/dashboard" className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-gray-400 hover:text-white transition-all shrink-0 ml-auto">
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
                  <Loader2 className="w-8 h-8 text-[#FFDE00] animate-spin drop-shadow-[0_0_8px_rgba(255,222,0,0.5)]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 bg-white/[0.02] border border-white/5 rounded-2xl my-4 text-sm text-gray-600 font-medium">
                  ¡La conversación está vacía! Escribe tu mensaje abajo.
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_email === user?.primaryEmailAddress?.emailAddress;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] sm:max-w-[65%] p-3 sm:p-3.5 rounded-2xl shadow-lg ${
                        isMine
                          ? "bg-[#FFDE00] text-black rounded-tr-sm shadow-[0_0_15px_rgba(255,222,0,0.15)]"
                          : "bg-[#1A1A1A] border border-white/8 text-gray-200 rounded-tl-sm"
                      }`}>
                        <p className="text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
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
              <div className="p-3 sm:p-4 bg-[#111111] border-t border-white/5 z-10 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escribe tu mensaje..."
                    value={inputMsg}
                    onChange={e => setInputMsg(e.target.value)}
                    className="flex-1 bg-[#0A0A0A] text-white placeholder-gray-600 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 focus:outline-none focus:ring-1 focus:ring-[#FFDE00] focus:border-[#FFDE00] transition-all text-sm min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputMsg.trim()}
                    className="bg-[#FFDE00] text-black p-2.5 sm:p-3 rounded-xl hover:bg-[#FFC107] hover:shadow-[0_0_15px_rgba(255,222,0,0.4)] disabled:opacity-50 transition-all shrink-0 hover:scale-105 active:scale-95"
                  >
                    {sending ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
