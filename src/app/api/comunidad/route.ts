import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Or service_role key if mutating safely
);

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "30");

    // Traer la tabla community_gallery ordenada por fecha
    const { data, error } = await supabase
      .from("community_gallery")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "No se pudo cargar la galería comunitaria." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { image_url, prompt_used, reference_images, model_used } = body;

    if (!image_url || !prompt_used) {
      return NextResponse.json({ error: "Imagen y prompt son requeridos." }, { status: 400 });
    }

    const { error } = await supabase
      .from("community_gallery")
      .insert({
        author_id: user.id,
        author_name: user.firstName || "Inspirador",
        author_avatar: user.imageUrl || "",
        image_url,
        prompt_used,
        reference_images: reference_images || [],
        model_used: model_used || "Nano Banana 🍌",
        likes_count: 0
      });

    if (error) {
      console.error(error);
      // Probablemente la tabla no existe aún.
      return NextResponse.json({ error: "Error al guardar en la base de datos de la comunidad. Verifica que la tabla exista." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Aporte publicado en la comunidad con éxito." });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
