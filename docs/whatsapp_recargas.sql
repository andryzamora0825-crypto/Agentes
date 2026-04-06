-- =========================================================================
-- ZAMTOOLS: Tabla de Recargas Pendientes (WhatsApp Bot)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_recargas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id TEXT NOT NULL,            -- ID de Clerk del dueño del bot
    phone_number TEXT NOT NULL,        -- Número de WhatsApp del cliente
    client_name TEXT,                  -- Nombre del cliente (extraído de WhatsApp)
    amount NUMERIC(10,2),             -- Monto de la recarga en USD
    bank TEXT,                         -- Banco seleccionado
    status TEXT DEFAULT 'pending',     -- 'pending' | 'completed' | 'rejected'
    is_scammer BOOLEAN DEFAULT FALSE,  -- Cruce automático con tabla scammers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_recargas_owner ON public.whatsapp_recargas (owner_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recargas_status ON public.whatsapp_recargas (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recargas_phone ON public.whatsapp_recargas (phone_number);

-- RLS
ALTER TABLE public.whatsapp_recargas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access whatsapp_recargas" 
ON public.whatsapp_recargas 
FOR ALL USING (true) WITH CHECK (true);
