import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Video feature removed." }, { status: 410 });
}
