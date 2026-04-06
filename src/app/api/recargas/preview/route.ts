import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

// GET — Obtener los últimos 10 mensajes de un número de teléfono
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ error: "Falta el número de teléfono" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("whatsapp_chats")
      .select("role, content, created_at")
      .eq("owner_id", user.id)
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    // Invertir para orden cronológico
    const messages = (data || []).reverse();

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error("Error obteniendo preview:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
