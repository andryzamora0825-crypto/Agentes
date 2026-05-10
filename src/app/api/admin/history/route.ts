import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    // Verificar admin via Supabase
    const email = user.primaryEmailAddress?.emailAddress;
    const { data: adminRow } = await supabase
      .from("admins")
      .select("email")
      .eq("email", email)
      .single();
    if (!adminRow) {
      return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetEmail = searchParams.get("targetEmail");

    if (!targetEmail) {
      return NextResponse.json({ error: "Falta el correo objetivo" }, { status: 400 });
    }

    const { data: posts, error } = await supabase
      .from("ai_images")
      .select("*")
      .eq("author_id", targetEmail)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, images: posts });
  } catch (error: any) {
    console.error("Error cargando historial agente en Admin:", error);
    return NextResponse.json({ error: "Fallo al cargar registros del agente." }, { status: 500 });
  }
}
