import { NextResponse } from "next/server";
import { syncLiveFixtures } from "@/lib/sports-live";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET = llamada del cron (Vercel Cron). POST = invocación manual/admin.
export async function GET(request: Request) {
  // Protección con CRON_SECRET (Vercel lo inyecta automáticamente como Authorization: Bearer)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.includes(secret)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await syncLiveFixtures("cron");
  const status = result.success ? 200 : 500;
  return NextResponse.json(result, { status });
}

export async function POST(request: Request) {
  // POST protegido igualmente con CRON_SECRET si está configurado
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.includes(secret)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await syncLiveFixtures("manual");
  const status = result.success ? 200 : 500;
  return NextResponse.json(result, { status });
}
