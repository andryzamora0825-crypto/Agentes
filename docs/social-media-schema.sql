-- ══════════════════════════════════════════════
-- Social Media Automation System — Database Schema
-- Run this in your Supabase SQL Editor
-- ══════════════════════════════════════════════

-- TABLA: social_posts
-- Almacena contenido generado por IA para RRSS
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Contenido
  caption TEXT NOT NULL,
  image_url TEXT,
  image_prompt TEXT,

  -- Estado
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'published', 'failed', 'rejected')),

  -- Programación
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,

  -- Plataforma destino
  platform TEXT NOT NULL DEFAULT 'facebook'
    CHECK (platform IN ('facebook', 'instagram', 'both')),

  -- Meta API response
  meta_post_id TEXT,

  -- Retries
  retry_count INT DEFAULT 0,
  last_error TEXT,

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_social_posts_user_status ON social_posts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(status, scheduled_at)
  WHERE status = 'approved' AND scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_social_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_posts_updated_at ON social_posts;
CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_updated_at();


-- TABLA: social_logs
-- Logs persistentes de acciones del sistema
CREATE TABLE IF NOT EXISTS social_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_logs_post ON social_logs(post_id);
CREATE INDEX IF NOT EXISTS idx_social_logs_action ON social_logs(action, created_at DESC);


-- TABLA: social_settings
-- Configuración por usuario (tokens Meta, etc)
CREATE TABLE IF NOT EXISTS social_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Meta Graph API
  meta_page_id TEXT,
  meta_page_access_token TEXT,
  meta_ig_user_id TEXT,

  -- Preferencias de generación
  brand_voice TEXT DEFAULT 'profesional',
  default_platform TEXT DEFAULT 'facebook',
  auto_generate BOOLEAN DEFAULT FALSE,
  daily_post_count INT DEFAULT 1,
  custom_prompt_template TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS social_settings_updated_at ON social_settings;
CREATE TRIGGER social_settings_updated_at
  BEFORE UPDATE ON social_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_social_updated_at();

-- Row Level Security (usando service_role desde backend)
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access posts" ON social_posts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access logs" ON social_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access settings" ON social_settings
  FOR ALL USING (true) WITH CHECK (true);
