// ══════════════════════════════════════════════
// Persistent Logger — Writes to social_logs table
// Also logs to console for Vercel runtime visibility
// ══════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

type LogAction = 'generate' | 'approve' | 'reject' | 'publish' | 'publish_failed' | 'edit' | 'delete' | 'retry' | 'error' | 'cron_trigger';

export async function logSocialAction(
  action: LogAction,
  details: Record<string, unknown> = {},
  postId?: string | null,
  userId?: string | null
): Promise<void> {
  // Console log for Vercel runtime
  const timestamp = new Date().toISOString();
  console.log(`[SOCIAL][${action.toUpperCase()}] ${timestamp}`, {
    postId: postId || 'N/A',
    userId: userId || 'system',
    ...details,
  });

  // Persist to Supabase
  try {
    await supabase.from("social_logs").insert({
      action,
      details,
      post_id: postId || null,
      user_id: userId || null,
    });
  } catch (err) {
    // Never let logging crash the main flow
    console.error("[SOCIAL][LOGGER] Failed to persist log:", err);
  }
}
