-- ==========================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- ZAMTOOLS: Apartado "Novedades / Feed"
-- ==========================================
-- 1. Copia y pega en tu panel de Supabase (Sección "SQL Editor").
-- 2. Haz clic en "Run" (Ejecutar).

-- --------------------------------------------------------
-- TABLAS PRINCIPALES
-- --------------------------------------------------------

-- Tabla 1: Posts (El muro)
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  description TEXT,
  images TEXT[], -- Array de URLs para múltiples fotos
  author_id TEXT NOT NULL, -- Email del admin que lo subió
  author_name TEXT,
  author_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla 2: Likes (Me Gustas)
CREATE TABLE IF NOT EXISTS likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Identificador (email) de quien da like
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id) -- Un mismo post y usuario no se puede duplicar el like
);

-- Tabla 3: Comentarios
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL, -- Identificador de quien comenta
  author_name TEXT,
  author_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --------------------------------------------------------
-- SEGURIDAD (RLS POLICIES)
-- --------------------------------------------------------

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Política lectura: Todos leen posts, likes y comentarios
CREATE POLICY "Public read posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Public read comments" ON comments FOR SELECT USING (true);

-- Política escritura: Dejaremos la inserción abierta para simular el comportamiento
-- validado que llevamos a cabo desde nuestro backend local en la aplicación Next.js
CREATE POLICY "Allow all insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update posts" ON posts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete posts" ON posts FOR DELETE USING (true);

CREATE POLICY "Allow all insert likes" ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete likes" ON likes FOR DELETE USING (true);

CREATE POLICY "Allow all insert comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete comments" ON comments FOR DELETE USING (true);


-- ==========================================
-- PASOS PARA CREAR EL BUCKET EN STORAGE
-- ==========================================
-- ¡CRITICO! Al igual que con los estafadores, debes crear el disco de almacenamiento para los artes:
-- 1. Ve a "Storage" en la barra izquierda de Supabase.
-- 2. "New bucket".
-- 3. Llámalo EXACTAMENTE: feed-media
-- 4. Activa el botón de "Public bucket" (Contenedor público).
-- 5. "Save".
-- (Si es necesario, ve a Policies dentro del bucket 'feed-media', crea una New Policy [For full customization], selecciona SELECT e INSERT, pon 'true' y guarda).
