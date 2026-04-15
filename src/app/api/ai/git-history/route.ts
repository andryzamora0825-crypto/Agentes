import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    const output = execSync('git log -p -n 3 src/app/api/ai/generate-video/route.ts', { shell: 'cmd.exe', encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
    return new NextResponse(output, { headers: { "Content-Type": "text/plain" } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
