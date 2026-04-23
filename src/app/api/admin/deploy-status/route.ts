import { NextResponse } from "next/server";

// Esta ruta (subida de estados a WhatsApp masiva con Gemini) ya no está activa ni genera cargos.
// Se mantiene un export POST dummy para que Next.js no falle durante el "npm run build" en Vercel,
// ya que exige que los archivos route.ts exporten un handler válido.

export async function POST() {
  return NextResponse.json({ success: false, error: "Esta característica fue deshabilitada." }, { status: 404 });
}

export async function GET() {
  return NextResponse.json({ success: false, error: "Esta característica fue deshabilitada." }, { status: 404 });
}
