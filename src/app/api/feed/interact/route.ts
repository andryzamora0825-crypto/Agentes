import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { action, postId, content } = body;
    const userId = user.primaryEmailAddress?.emailAddress;

    if (!postId) {
      return NextResponse.json({ error: "ID de Post requerido" }, { status: 400 });
    }

    if (action === "comment") {
      if (!content) return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });

      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          content,
          author_id: userId,
          author_name: user.fullName || "Agente",
          author_avatar_url: user.imageUrl,
        })
        .select()
        .single();
        
      if (error) throw error;
      return NextResponse.json({ success: true, data });

    } else if (action === "like") {
      // Intentar insertar el like. Si viola Primary Key (compuesta), significa que ya dio like (Supabase lo denegará silenciosamente o tirará error según upsert, preferimos usar insert y agarrar el throw o usar upsert)
      const { error } = await supabase
        .from("likes")
        .insert({
          post_id: postId,
          user_id: userId
        });
      
      // Ignoramos error de duplicado (ej: 23505) pues asume que ya tiene like
      if (error && error.code !== '23505') throw error;
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error: any) {
    console.error("Error en interact API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = user.primaryEmailAddress?.emailAddress;
    const isAdmin = userId === "andryzamora0825@gmail.com";

    if (action === 'like') {
      const postId = searchParams.get('postId');
      if (!postId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
      
      const { error } = await supabase.from("likes").delete().match({ post_id: postId, user_id: userId });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'comment_delete') {
      const commentId = searchParams.get('commentId');
      if (!commentId) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

      // Admin puede borrar cualquiera, usuario normal solo el suyo
      const matchCondition = isAdmin ? { id: commentId } : { id: commentId, author_id: userId };
      
      const { error } = await supabase.from("comments").delete().match(matchCondition);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error: any) {
    console.error("Error en DELETE:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { action, commentId, content } = body;
    const userId = user.primaryEmailAddress?.emailAddress;
    
    if (action === 'comment_edit') {
       if (!commentId || !content) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
       
       const { error } = await supabase
         .from("comments")
         .update({ content })
         // Solo el dueño puede editar
         .match({ id: commentId, author_id: userId });

       if (error) throw error;
       return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error: any) {
    console.error("Error en PUT interact:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
