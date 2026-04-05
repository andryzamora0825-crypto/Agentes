-- ==========================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- ZAMTOOLS: Apartado "Verificar Estafador"
-- ==========================================
--
-- 1. Copia y pega todo este código en tu panel de Supabase
--    (En la sección "SQL Editor" de la izquierda).
-- 2. Haz clic en el botón "Run" (Ejecutar).

-- Crear la tabla 'scammers' (estafadores)
CREATE TABLE IF NOT EXISTS scammers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT,
  description TEXT,
  photo_url TEXT,
  proof_urls TEXT[], -- Array de textos para guardar hasta 5 URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT -- Opcional, para guardar el email o ID del admin
);

-- Habilitar RLS (Seguridad a nivel de fila) para evitar inserción anónima indeseada
ALTER TABLE scammers ENABLE ROW LEVEL SECURITY;

-- Política de lectura: Cualquier persona (autenticada) puede buscar/leer el directorio
CREATE POLICY "Public read access for scammers" 
ON scammers FOR SELECT 
USING (true);

-- Política de inserción: Para hacer este prototipo más sencillo al inicio,
-- dejaremos que cualquier usuario logueado o en nuestro sistema ingrese estafadores,
-- aunque desde el código Frontend de Next.js bloquearemos el botón "Añadir" para
-- que solo el administrador pueda verlo y usar la función.
-- Si prefieres restringir la inserción desde base de datos, reemplaza 'true' 
-- por reglas avanzadas de tu JWT de Auth.
CREATE POLICY "Allow insertions" 
ON scammers FOR INSERT 
WITH CHECK (true);

-- ==========================================
-- PASOS PARA CREAR EL BUCKET EN STORAGE
-- ==========================================
-- Una vez ejecutado este código SQL con éxito, haz esto para tus fotos:
-- 1. Ve a la sección "Storage" (Almacenamiento) en la barra izquierda de Supabase.
-- 2. Haz clic en el botón verde "New bucket" (Nuevo contenedor).
-- 3. Ponle de nombre EXACTAMENTE: scammers-evidence
-- 4. ¡MUY IMPORTANTE! Enciende el interruptor (switch) que dice "Public bucket" (Contenedor público).
-- 5. Haz clic en "Save" (Guardar).
-- 6. Opcional: Si Supabase te exige generar políticas de permisos (Policies) para el Bucket,
--    ve a la pestaña "Policies" dentro de tu bucket 'scammers-evidence' y crea una 
--    política (New Policy) eligiendo "For full customization", nómbrala "Public Access",
--    marca las casillas SELECT e INSERT y pon 'true' en todo para no tener problemas de subida.
