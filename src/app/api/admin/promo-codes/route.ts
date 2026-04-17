import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

// GET: Obtener todos los códigos promocionales activos e inactivos
export async function GET() {
  try {
    const user = await currentUser();
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, codes: data });
  } catch (error: any) {
    console.error("Error obteniendo códigos:", error);
    return NextResponse.json({ error: "Fallo interno al obtener códigos" }, { status: 500 });
  }
}

// POST: Crear nuevo código promocional
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { code, reward_type, reward_value, combo_credits, stock } = await request.json();

    if (!code || !reward_type || !reward_value) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    // Calcular la expiración a 24 horas desde ahora
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const insertPayload: any = {
      code: code.toUpperCase().replace(/\s+/g, ''),
      reward_type,
      reward_value: Number(reward_value),
      stock: stock ? Number(stock) : null,
      expires_at: expiresAt.toISOString(),
      used_count: 0
    };

    // Solo incluir combo_credits si es tipo combo y la columna existe
    if (reward_type === 'combo' && combo_credits) {
      insertPayload.combo_credits = Number(combo_credits);
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Código único violado
        return NextResponse.json({ error: "El código promocional ya existe." }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, code: data });
  } catch (error: any) {
    console.error("Error creando código:", error);
    return NextResponse.json({ error: "Error al crear el código promocional" }, { status: 500 });
  }
}

// DELETE: Eliminar/Expirar un código de forma prematura
export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

    const { error } = await supabase
      .from("promo_codes")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error borrando código:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
