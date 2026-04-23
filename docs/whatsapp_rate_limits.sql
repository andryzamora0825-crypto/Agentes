-- ==========================================
-- RATE LIMIT DEL BOT WHATSAPP
-- ==========================================
-- Protege contra loops y abuso. Por cada número, máximo N respuestas/minuto.
--
-- Ejecutar en Supabase SQL Editor una vez.

CREATE TABLE IF NOT EXISTS whatsapp_rate_log (
  id BIGSERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_rate_log_lookup
  ON whatsapp_rate_log (owner_id, phone_number, sent_at DESC);

-- Retención automática: borrar registros > 1h (cron lo puede hacer o lo hacemos en código)
-- Opcional: si quieres un TTL con pg_cron, descomenta:
-- SELECT cron.schedule('whatsapp_rate_log_cleanup', '*/15 * * * *',
--   $$DELETE FROM whatsapp_rate_log WHERE sent_at < NOW() - INTERVAL '1 hour'$$);


-- ==========================================
-- VERIFICACIONES DE COMPROBANTES (Vision)
-- ==========================================
-- Cada vez que el bot recibe una imagen y la valida con Gemini Vision,
-- guardamos el resultado para auditoría y anti-fraude.

CREATE TABLE IF NOT EXISTS whatsapp_receipt_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  chat_msg_id TEXT,
  is_valid_receipt BOOLEAN,
  detected_bank TEXT,
  detected_amount NUMERIC,
  detected_date TEXT,
  detected_reference TEXT,
  detected_titular TEXT,
  raw_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whatsapp_receipt_checks_phone_idx
  ON whatsapp_receipt_checks (owner_id, phone_number, created_at DESC);
