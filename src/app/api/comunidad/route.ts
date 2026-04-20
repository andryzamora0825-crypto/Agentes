import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "30");

    const { data, error } = await supabase
      .from("community_gallery")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[COMUNIDAD GET] Error Supabase:", error.message, error.code, error.details);
      return NextResponse.json({ error: "No se pudo cargar la galería: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[COMUNIDAD GET] Error general:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { image_url, prompt_used, model_used } = body;

    if (!image_url || !prompt_used) {
      return NextResponse.json({ error: "Imagen y prompt son requeridos." }, { status: 400 });
    }

    const { error } = await supabase
      .from("community_gallery")
      .insert({
        author_id: user.id,
        author_name: user.firstName || user.username || "Artista",
        author_avatar: user.imageUrl || "",
        image_url,
        prompt_used,
        model_used: model_used || "Nano IA",
        likes_count: 0
      });

    if (error) {
      console.error("[COMUNIDAD POST] Error Supabase:", error.message, error.code, error.details, error.hint);
      return NextResponse.json({ error: "Error al publicar: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "¡Publicado en la comunidad!" });
  } catch (error: any) {
    console.error("[COMUNIDAD POST] Error general:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
