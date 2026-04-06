import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: posts, error } = await supabase
      .from("ai_images")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, images: posts });
  } catch (error: any) {
    console.error("Error obteniendo historial IA:", error);
    return NextResponse.json({ error: "Fallo al cargar registros." }, { status: 500 });
  }
}
