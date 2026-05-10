import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

const CONFIG_BUCKET = "ai-generations";
const CONFIG_PATH = "config/global_ai_model.json";

// GET: Leer modelo global actual
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(CONFIG_PATH);

    if (error || !data) {
      // Config no existe aún, devolver flash por defecto
      return NextResponse.json({ success: true, model: "flash" });
    }

    const text = await data.text();
    const config = JSON.parse(text);
    return NextResponse.json({ success: true, model: config.model || "flash" });
  } catch (e: any) {
    return NextResponse.json({ success: true, model: "flash" });
  }
}

// POST: Actualizar modelo global (solo admin)
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const email = user.primaryEmailAddress?.emailAddress;

    // Verificar admin via Supabase
    const { data: adminData } = await supabase
      .from("admins")
      .select("email")
      .eq("email", email)
      .single();

    if (!adminData) {
      return NextResponse.json({ error: "Solo administradores." }, { status: 403 });
    }

    const body = await request.json();
    const { model } = body;

    if (!["flash", "pro"].includes(model)) {
      return NextResponse.json({ error: "Modelo inválido." }, { status: 400 });
    }

    // Guardar como JSON en Supabase Storage (no requiere tabla)
    const configJson = JSON.stringify({ model, updatedAt: new Date().toISOString(), updatedBy: email });
    const blob = new Blob([configJson], { type: "application/json" });

    const { error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .upload(CONFIG_PATH, blob, { contentType: "application/json", upsert: true });

    if (error) {
      console.error("[AI-MODEL] Error guardando config:", error.message);
      return NextResponse.json({ error: "Error guardando: " + error.message }, { status: 500 });
    }

    console.log(`[AI-MODEL] ✅ Modelo global cambiado a '${model}' por ${email}`);
    return NextResponse.json({ success: true, model });

  } catch (e: any) {
    console.error("[AI-MODEL] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
