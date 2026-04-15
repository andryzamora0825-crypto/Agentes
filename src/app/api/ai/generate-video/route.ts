import { NextResponse } from "next/server";

// Video generation has been permanently disabled
export async function POST() {
  return NextResponse.json({ error: "Video generation has been removed." }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ error: "Video generation has been removed." }, { status: 410 });
}
