-- =========================================================================
-- ZAMTOOLS: Motor de Economía (Créditos), Chats y Generador IA
-- =========================================================================

-- 1. TABLA: HISTORIAL DE IMÁGENES CREADAS POR IA
CREATE TABLE IF NOT EXISTS public.ai_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    author_id TEXT NOT NULL,       -- Email del usuario (Clerk)
    author_name TEXT,
    author_avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS en la tabla ai_images pero permitiendo libre acceso
ALTER TABLE public.ai_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access ai_images" ON public.ai_images FOR ALL USING (true) WITH CHECK (true);

-- 2. TABLA: SISTEMA DE CHAT (AGENTE <> ADMIN)
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_email TEXT NOT NULL,    -- Email de quien envía el mensaje
    sender_name TEXT,
    sender_avatar TEXT,
    receiver_email TEXT NOT NULL,  -- Email de quien recibe (A menudo "andryzamora0825@gmail.com")
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para la mensajería
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
-- Permiso universal de inserción y lectura para el flujo del Chat (como es interno, usamos policy abierta)
CREATE POLICY "Public Access chats" ON public.chats FOR ALL USING (true) WITH CHECK (true);

-- 3. BUCKET STORAGE: ALMACENAMIENTO DE RECURSOS IA (.PNG)
-- Intentaremos crear el bucket de Storage para que no expiren los enlaces de DALL-E.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ai-generations', 'ai-generations', true) 
ON CONFLICT (id) DO NOTHING;

-- Dar permisos absolutos al Bucket de IA
CREATE POLICY "Permiso Maestro Generador IA" 
ON storage.objects FOR ALL 
USING (bucket_id = 'ai-generations') 
WITH CHECK (bucket_id = 'ai-generations');
