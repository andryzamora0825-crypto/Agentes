-- ==========================================
-- BLACKLIST COMUNITARIA DE ESTAFADORES
-- ==========================================
-- Extiende el módulo actual para permitir múltiples reportes
-- por el mismo número, agregación automática, y contador de severidad.
--
-- Ejecutar en Supabase SQL Editor DESPUÉS del script original de estafadores.

-- 1) Quitar el UNIQUE en phone_number (permitir múltiples reportes del mismo número)
ALTER TABLE scammers DROP CONSTRAINT IF EXISTS scammers_phone_number_key;

-- 2) Normalizar teléfono: guardar versión canónica (últimos 10 dígitos) para match
ALTER TABLE scammers ADD COLUMN IF NOT EXISTS phone_canonical TEXT;
UPDATE scammers SET phone_canonical = REGEXP_REPLACE(COALESCE(phone_number,''), '[^0-9]', '', 'g');
UPDATE scammers SET phone_canonical = RIGHT(phone_canonical, 10) WHERE LENGTH(phone_canonical) > 10;
CREATE INDEX IF NOT EXISTS scammers_phone_canonical_idx ON scammers(phone_canonical);

-- 3) Vista agregada: un número = múltiples reportes consolidados
CREATE OR REPLACE VIEW scammer_summary AS
SELECT
  phone_canonical,
  MIN(phone_number) AS phone_number,      -- un representante
  COUNT(*) AS report_count,
  ARRAY_AGG(DISTINCT COALESCE(name,''))      FILTER (WHERE COALESCE(name,'') <> '') AS aliases,
  ARRAY_AGG(DISTINCT COALESCE(description,'')) FILTER (WHERE COALESCE(description,'') <> '') AS descriptions,
  ARRAY_AGG(photo_url) FILTER (WHERE photo_url IS NOT NULL) AS photos,
  ARRAY_AGG(created_by) FILTER (WHERE created_by IS NOT NULL) AS reporters,
  MAX(created_at) AS last_reported_at,
  MIN(created_at) AS first_reported_at
FROM scammers
GROUP BY phone_canonical;

-- 4) Trigger que mantiene phone_canonical actualizado en cada insert
CREATE OR REPLACE FUNCTION trg_scammers_normalize()
RETURNS trigger AS $$
BEGIN
  NEW.phone_canonical := RIGHT(REGEXP_REPLACE(COALESCE(NEW.phone_number,''), '[^0-9]', '', 'g'), 10);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scammers_normalize_phone ON scammers;
CREATE TRIGGER scammers_normalize_phone
  BEFORE INSERT OR UPDATE ON scammers
  FOR EACH ROW EXECUTE FUNCTION trg_scammers_normalize();

-- 5) Permitir lectura pública de la vista (igual que la tabla)
GRANT SELECT ON scammer_summary TO anon, authenticated;
