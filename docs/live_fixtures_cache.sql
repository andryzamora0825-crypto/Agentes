-- ==========================================
-- CACHÉ DE PARTIDOS EN VIVO (shared-cache)
-- ==========================================
-- Una sola request a API-Sports cada X minutos escribe acá.
-- Todos los usuarios del dashboard leen de esta tabla (0 costo API por usuario).
--
-- Ejecutar en Supabase SQL Editor una vez.

-- Snapshot del último sync (incluye TODOS los partidos live en una fila JSONB).
CREATE TABLE IF NOT EXISTS live_fixtures_cache (
  id INT PRIMARY KEY DEFAULT 1,              -- siempre única (upsert)
  fixtures JSONB NOT NULL DEFAULT '[]'::jsonb,
  fixture_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,                                -- "cron" | "manual" | "fallback"
  CONSTRAINT live_fixtures_singleton CHECK (id = 1)
);

-- Asegurar la fila única (safe re-run)
INSERT INTO live_fixtures_cache (id, fixtures, fixture_count)
  VALUES (1, '[]'::jsonb, 0)
  ON CONFLICT (id) DO NOTHING;

-- Registro de refreshes manuales para rate-limiting (opcional, solo audit trail)
CREATE TABLE IF NOT EXISTS live_refresh_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  used_cache BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS live_refresh_log_time_idx ON live_refresh_log(triggered_at DESC);

-- Permitir lectura pública (igual que el feed)
GRANT SELECT ON live_fixtures_cache TO anon, authenticated;
