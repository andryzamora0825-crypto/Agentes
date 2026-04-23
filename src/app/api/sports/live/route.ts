import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Lee el caché compartido de live_fixtures_cache (NO consulta API-Sports).
// Costo API externo por request: 0.
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data, error } = await supabase
      .from("live_fixtures_cache")
      .select("fixtures, fixture_count, updated_at, source")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        hint: "Corre docs/live_fixtures_cache.sql en Supabase.",
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        fixtures: [],
        fixture_count: 0,
        updated_at: null,
        stale: true,
      });
    }

    const ageSeconds = data.updated_at
      ? Math.round((Date.now() - new Date(data.updated_at).getTime()) / 1000)
      : null;

    return NextResponse.json({
      success: true,
      fixtures: data.fixtures || [],
      fixture_count: data.fixture_count || 0,
      updated_at: data.updated_at,
      age_seconds: ageSeconds,
      // Si el cron no ha corrido en > 15 min, marcamos como stale
      stale: ageSeconds === null || ageSeconds > 900,
      source: data.source,
    });
  } catch (e: any) {
    console.error("[LIVE] Error:", e);
    return NextResponse.json({ error: "Error leyendo caché live." }, { status: 500 });
  }
}
