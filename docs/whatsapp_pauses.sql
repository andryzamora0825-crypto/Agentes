-- =========================================================================
-- ZAMTOOLS: Sistema de Pausas para Agente Humano
-- =========================================================================

-- TABLA: Pausas activas del bot por conversación
CREATE TABLE IF NOT EXISTS public.whatsapp_pauses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id TEXT NOT NULL,         -- ID del usuario de Clerk (Dueño del bot)
    phone_number TEXT NOT NULL,     -- Número de WhatsApp del cliente
    paused_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(owner_id, phone_number)  -- Solo una pausa activa por conversación
);

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_whatsapp_pauses_lookup 
ON public.whatsapp_pauses (owner_id, phone_number);

-- Habilitar RLS
ALTER TABLE public.whatsapp_pauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access whatsapp_pauses" 
ON public.whatsapp_pauses 
FOR ALL USING (true) WITH CHECK (true);
