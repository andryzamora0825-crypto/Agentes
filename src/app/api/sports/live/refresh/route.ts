import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { syncLiveFixtures } from "@/lib/sports-live";

export const dynamic = "force-dynamic";

// Refresh manual del caché live. Protegido por Clerk + rate-limit (60s) interno.
// Llama al sincronizador in-process (sin self-fetch) — evita problemas de auth del middleware.
export async function POST() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Audit (best-effort)
    supabase.from("live_refresh_log").insert({ user_id: user.id }).then(() => {});

    const result = await syncLiveFixtures("manual");

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        hint: (result as any).hint,
      }, { status: 500 });
    }

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        refreshed: false,
        reason: "cache_fresh",
        age_seconds: result.ageSeconds,
        fixture_count: result.fixture_count,
      });
    }

    return NextResponse.json({
      success: true,
      refreshed: true,
      fixture_count: result.fixture_count,
      updated_at: result.updated_at,
    });
  } catch (e: any) {
    console.error("[LIVE/REFRESH] Error:", e);
    return NextResponse.json({
      success: false,
      error: e.message || "Error procesando refresh.",
    }, { status: 500 });
  }
}
