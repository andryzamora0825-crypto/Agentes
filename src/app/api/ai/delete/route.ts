import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { imageId } = await request.json();
    if (!imageId) return NextResponse.json({ error: "Falta imageId" }, { status: 400 });

    // Obtener el registro para verificar autoría y obtener la URL del archivo
    const { data: record, error: fetchError } = await supabase
      .from("ai_images")
      .select("*")
      .eq("id", imageId)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    // Verificar que el usuario sea el dueño o el admin
    const userEmail = user.primaryEmailAddress?.emailAddress;
    const isAdmin = userEmail === "andryzamora0825@gmail.com";
    if (record.author_id !== userEmail && !isAdmin) {
      return NextResponse.json({ error: "No tienes permiso para eliminar esta imagen" }, { status: 403 });
    }

    // Intentar eliminar de Storage (extraer path del URL público)
    try {
      const url = new URL(record.image_url);
      const storagePath = url.pathname.split("/object/public/ai-generations/")[1];
      if (storagePath) {
        await supabase.storage.from("ai-generations").remove([storagePath]);
      }
    } catch (e) {
      console.error("Error eliminando archivo de storage (no crítico):", e);
    }

    // Eliminar registro de la BD
    const { error: deleteError } = await supabase
      .from("ai_images")
      .delete()
      .eq("id", imageId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: "Imagen eliminada." });

  } catch (error: any) {
    console.error("Error eliminando imagen:", error);
    return NextResponse.json({ error: "Error interno al eliminar." }, { status: 500 });
  }
}
