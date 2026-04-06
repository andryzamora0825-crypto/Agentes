-- =========================================================================
-- ZAMTOOLS: Historial de Chats para Agentes de WhatsApp (Gemini)
-- =========================================================================

-- TABLA: Memoria de conversaciones de WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id TEXT NOT NULL,         -- ID del usuario de Clerk (Dueño del bot)
    phone_number TEXT NOT NULL,     -- Número de WhatsApp del cliente
    role TEXT NOT NULL,             -- 'user' o 'model'
    content TEXT NOT NULL,          -- Texto del mensaje
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para búsqueda rápida de historial por número y dueño
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_owner_phone ON public.whatsapp_chats (owner_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_created_at ON public.whatsapp_chats (created_at);

-- Habilitar RLS en la tabla
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- Política de Acceso: Permitir inserción y lectura al Webhook
CREATE POLICY "Public Access whatsapp_chats" 
ON public.whatsapp_chats 
FOR ALL USING (true) WITH CHECK (true);
