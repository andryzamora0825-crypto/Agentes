// ══════════════════════════════════════════════
// Cron Auth Service — Validates cron job requests
// Vercel sends CRON_SECRET header for authenticated cron jobs
// ══════════════════════════════════════════════

/**
 * Validates that a request comes from Vercel Cron
 * Returns true if the request has a valid CRON_SECRET header
 */
export function validateCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  // If no CRON_SECRET is configured, allow in development
  if (!cronSecret || cronSecret === "your-secret-key-here") {
    console.warn("[CRON] No CRON_SECRET configured. Allowing request in dev mode.");
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  console.error("[CRON] Unauthorized cron request. Invalid or missing authorization header.");
  return false;
}
