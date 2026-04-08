-- =========================================================================
-- ZAMTOOLS: Etiquetas de contacto para el Bot de WhatsApp
-- Ejecutar en Supabase SQL Editor
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    tag TEXT NOT NULL,             -- 'lead', 'vip', 'recarga_pendiente', 'escalado', 'retiro_pendiente'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(owner_id, phone_number, tag)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_tags_lookup
ON public.whatsapp_contact_tags (owner_id, phone_number);

ALTER TABLE public.whatsapp_contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access whatsapp_contact_tags"
ON public.whatsapp_contact_tags
FOR ALL USING (true) WITH CHECK (true);
