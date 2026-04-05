import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    // Validar ser administrador
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    // 1. Opcional: Obtener las imágenes del post para borrarlas físicamente de Storage
    const { data: postData } = await supabase.from("posts").select("images").eq("id", id).single();
    
    // Eliminamos el post (Esto eliminará en cascada Likes y Comentarios de la base de datos)
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) throw error;

    // 2. Limpiar Storage (las imágenes)
    if (postData && postData.images && postData.images.length > 0) {
      // images son URLs completas. Extraigamos solo el filename que agregamos al bucket 'feed-media'.
      const fileNames = postData.images.map((url: string) => {
         const parts = url.split('/');
         return parts[parts.length - 1]; // "uuid.png"
      });
      // Borrado en background (sin bloquear respuesta) o bloqueante si lo preferimos:
      await supabase.storage.from('feed-media').remove(fileNames);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error al eliminar post:", error);
    return NextResponse.json({ error: error.message || "Error eliminando el post." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    // Validar ser administrador
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await request.json();
    const { description } = body;

    const { error } = await supabase
      .from("posts")
      .update({ description })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error al actualizar post:", error);
    return NextResponse.json({ error: error.message || "Error actualizando el post." }, { status: 500 });
  }
}
