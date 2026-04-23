import { supabase } from "./supabase";

export class InsufficientCreditsError extends Error {
  have: number;
  need: number;
  constructor(have: number, need: number) {
    super(`insufficient_credits: have ${have}, need ${need}`);
    this.name = "InsufficientCreditsError";
    this.have = have;
    this.need = need;
  }
}

type CreditTxOpts = {
  userId: string;
  amount: number;
  relatedId?: string;
  idempotencyKey?: string;
  note?: string;
};

type CreditTxResult = { newBalance: number; ledgerId: string };

function extractRow(data: any): { new_balance: number; ledger_id: string } {
  if (Array.isArray(data)) return data[0];
  return data;
}

export async function spendCredits(opts: CreditTxOpts): Promise<CreditTxResult> {
  const { data, error } = await supabase.rpc("spend_credits", {
    p_user_id: opts.userId,
    p_amount: opts.amount,
    p_related_id: opts.relatedId ?? null,
    p_idem: opts.idempotencyKey ?? null,
    p_note: opts.note ?? null,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("insufficient_credits")) {
      const match = msg.match(/have (-?\d+), need (\d+)/);
      const have = match ? parseInt(match[1], 10) : 0;
      const need = match ? parseInt(match[2], 10) : opts.amount;
      throw new InsufficientCreditsError(have, need);
    }
    throw error;
  }

  const row = extractRow(data);
  return { newBalance: row.new_balance, ledgerId: row.ledger_id };
}

export async function refundCredits(opts: CreditTxOpts): Promise<CreditTxResult> {
  const { data, error } = await supabase.rpc("refund_credits", {
    p_user_id: opts.userId,
    p_amount: opts.amount,
    p_related_id: opts.relatedId ?? null,
    p_idem: opts.idempotencyKey ?? null,
    p_note: opts.note ?? null,
  });
  if (error) throw error;
  const row = extractRow(data);
  return { newBalance: row.new_balance, ledgerId: row.ledger_id };
}

export async function earnCredits(opts: CreditTxOpts): Promise<CreditTxResult> {
  const { data, error } = await supabase.rpc("earn_credits", {
    p_user_id: opts.userId,
    p_amount: opts.amount,
    p_related_id: opts.relatedId ?? null,
    p_idem: opts.idempotencyKey ?? null,
    p_note: opts.note ?? null,
  });
  if (error) throw error;
  const row = extractRow(data);
  return { newBalance: row.new_balance, ledgerId: row.ledger_id };
}

export async function getBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

export async function logRefundFailure(opts: {
  userId: string;
  amount: number;
  relatedId?: string;
  error: string;
}): Promise<void> {
  try {
    await supabase.from("credit_refund_failures").insert({
      user_id: opts.userId,
      amount: opts.amount,
      related_id: opts.relatedId ?? null,
      error: opts.error,
    });
  } catch (e) {
    console.error("[credits] No se pudo registrar refund failure:", e);
  }
}
