import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

// GET: Leer modelo global actual
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Cualquier usuario puede leer el modelo global (necesitan saber cuál usar)
    const { data } = await supabase
      .from("global_config")
      .select("value")
      .eq("key", "default_ai_model")
      .single();

    return NextResponse.json({ 
      success: true, 
      model: data?.value || "flash" 
    });
  } catch (e: any) {
    // Si la tabla no existe, devolver flash por defecto
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
      return NextResponse.json({ error: "Solo administradores pueden cambiar el modelo." }, { status: 403 });
    }

    const body = await request.json();
    const { model } = body;

    if (!["flash", "pro"].includes(model)) {
      return NextResponse.json({ error: "Modelo inválido. Usa 'flash' o 'pro'." }, { status: 400 });
    }

    // Upsert en global_config
    const { error } = await supabase
      .from("global_config")
      .upsert(
        { key: "default_ai_model", value: model, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      // Si la tabla no existe, intentar crearla insertando
      console.warn("[AI-MODEL] Error en upsert:", error.message);
      
      // Fallback: intentar insert directo
      const { error: insertErr } = await supabase
        .from("global_config")
        .insert({ key: "default_ai_model", value: model });
      
      if (insertErr) {
        console.error("[AI-MODEL] También falló insert:", insertErr.message);
        return NextResponse.json({ 
          error: "No se pudo guardar. Crea la tabla 'global_config' en Supabase con columnas: key (text, PK), value (text), updated_at (timestamptz)." 
        }, { status: 500 });
      }
    }

    console.log(`[AI-MODEL] Modelo global cambiado a '${model}' por ${email}`);
    return NextResponse.json({ success: true, model });

  } catch (e: any) {
    console.error("[AI-MODEL] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
