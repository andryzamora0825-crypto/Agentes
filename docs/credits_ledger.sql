-- ==========================================
-- LEDGER DE CRÉDITOS — FUENTE DE VERDAD
-- ==========================================
-- Reemplaza el flujo inseguro de user.publicMetadata.credits
-- que era vulnerable a race conditions (un usuario podía gastar
-- el doble disparando requests en paralelo) y a sobrescritura
-- de saldo durante refunds.
--
-- Ejecutar en Supabase SQL Editor una sola vez.

-- ── TABLA LEDGER (INSERT-ONLY — auditoría completa) ──
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('spend','earn','refund','adjust')),
  amount INT NOT NULL,                 -- negativo para spend, positivo para earn/refund
  related_id TEXT,                     -- id de generación/compra/etc
  idempotency_key TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idem_idx
  ON credit_ledger (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_ledger_user_time_idx
  ON credit_ledger (user_id, created_at DESC);

-- ── BALANCE CACHEADO (actualizado transaccionalmente por las RPC) ──
CREATE TABLE IF NOT EXISTS credit_balances (
  user_id TEXT PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABLA DE FALLOS DE REEMBOLSO (para reconciliación manual) ──
CREATE TABLE IF NOT EXISTS credit_refund_failures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INT NOT NULL,
  related_id TEXT,
  error TEXT,
  resolved BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- RPC: spend_credits (atómica, idempotente)
-- ==========================================
CREATE OR REPLACE FUNCTION spend_credits(
  p_user_id TEXT,
  p_amount INT,
  p_related_id TEXT DEFAULT NULL,
  p_idem TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS TABLE(new_balance INT, ledger_id UUID) AS $$
DECLARE
  v_existing_id UUID;
  v_current INT;
  v_new_balance INT;
  v_ledger_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  -- Idempotency short-circuit
  IF p_idem IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM credit_ledger
      WHERE user_id = p_user_id AND idempotency_key = p_idem LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      SELECT balance INTO v_current FROM credit_balances WHERE user_id = p_user_id;
      RETURN QUERY SELECT COALESCE(v_current, 0), v_existing_id;
      RETURN;
    END IF;
  END IF;

  -- Lock row (upsert + FOR UPDATE)
  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_current FROM credit_balances
    WHERE user_id = p_user_id FOR UPDATE;

  IF v_current < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits: have %, need %', v_current, p_amount
      USING ERRCODE = 'P0001';
  END IF;

  v_new_balance := v_current - p_amount;
  UPDATE credit_balances SET balance = v_new_balance, updated_at = NOW()
    WHERE user_id = p_user_id;

  INSERT INTO credit_ledger (user_id, type, amount, related_id, idempotency_key, note)
    VALUES (p_user_id, 'spend', -p_amount, p_related_id, p_idem, p_note)
    RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT v_new_balance, v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC: refund_credits (atómica, idempotente)
-- ==========================================
CREATE OR REPLACE FUNCTION refund_credits(
  p_user_id TEXT,
  p_amount INT,
  p_related_id TEXT DEFAULT NULL,
  p_idem TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS TABLE(new_balance INT, ledger_id UUID) AS $$
DECLARE
  v_existing_id UUID;
  v_new_balance INT;
  v_ledger_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF p_idem IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM credit_ledger
      WHERE user_id = p_user_id AND idempotency_key = p_idem LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      SELECT balance INTO v_new_balance FROM credit_balances WHERE user_id = p_user_id;
      RETURN QUERY SELECT COALESCE(v_new_balance, 0), v_existing_id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE credit_balances SET balance = balance + p_amount, updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

  INSERT INTO credit_ledger (user_id, type, amount, related_id, idempotency_key, note)
    VALUES (p_user_id, 'refund', p_amount, p_related_id, p_idem, p_note)
    RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT v_new_balance, v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC: earn_credits (compras, promos, admin)
-- ==========================================
CREATE OR REPLACE FUNCTION earn_credits(
  p_user_id TEXT,
  p_amount INT,
  p_related_id TEXT DEFAULT NULL,
  p_idem TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS TABLE(new_balance INT, ledger_id UUID) AS $$
DECLARE
  v_existing_id UUID;
  v_new_balance INT;
  v_ledger_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF p_idem IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM credit_ledger
      WHERE user_id = p_user_id AND idempotency_key = p_idem LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      SELECT balance INTO v_new_balance FROM credit_balances WHERE user_id = p_user_id;
      RETURN QUERY SELECT COALESCE(v_new_balance, 0), v_existing_id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO credit_balances (user_id, balance) VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + p_amount, updated_at = NOW()
    RETURNING balance INTO v_new_balance;

  INSERT INTO credit_ledger (user_id, type, amount, related_id, idempotency_key, note)
    VALUES (p_user_id, 'earn', p_amount, p_related_id, p_idem, p_note)
    RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT v_new_balance, v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- MIGRACIÓN ONE-TIME: importar saldos existentes desde Clerk
-- ==========================================
-- Después de aplicar este SQL, corre el endpoint /api/admin/migrate-credits
-- (lo creamos junto a este fix) para poblar credit_balances con los valores
-- actuales de publicMetadata.credits de cada usuario.
