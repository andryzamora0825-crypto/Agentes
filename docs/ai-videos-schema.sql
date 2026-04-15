-- ============================================
-- Schema: AI Video Generation (Veo 3.1)
-- Tabla para trackear generación de videos
-- ============================================

-- Crear tabla para guardar videos generados con IA
CREATE TABLE IF NOT EXISTS ai_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt TEXT NOT NULL,
  video_url TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER DEFAULT 8,
  aspect_ratio TEXT DEFAULT '16:9',
  author_id TEXT NOT NULL,
  author_name TEXT,
  author_avatar_url TEXT,
  model TEXT DEFAULT 'veo-3.1',
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  operation_name TEXT DEFAULT '',         -- Google operation ID para polling
  credits_charged INTEGER DEFAULT 0,      -- Créditos cobrados (para reembolso si falla)
  clerk_user_id TEXT DEFAULT '',           -- Clerk user ID para reembolso
  error_message TEXT,                      -- Mensaje de error si falló
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para polling de operaciones activas
CREATE INDEX IF NOT EXISTS idx_ai_videos_status ON ai_videos(status);
CREATE INDEX IF NOT EXISTS idx_ai_videos_author ON ai_videos(author_id);

-- RLS (Row Level Security) - Ajustar según tu configuración de Supabase
-- ALTER TABLE ai_videos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- IMPORTANTE: Crear el bucket en Supabase Storage
-- ============================================
-- Ir a: Supabase Dashboard > Storage > New Bucket
-- Nombre: ai-videos
-- Public: Sí (para servir los videos)
-- File size limit: 100MB (videos pueden ser pesados)
-- MIME types: video/mp4
