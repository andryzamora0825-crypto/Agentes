import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("ai_images")
      .select("id, prompt, image_url, author_id, author_name, author_avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching ai_images:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, images: data || [] });
  } catch (err: any) {
    console.error("Error en /api/admin/images:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
