import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Solo administrador
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado. Solo admins pueden publicar." }, { status: 403 });
    }

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    
    // Capturamos hasta 10 imágenes (artes)
    const files: File[] = [];
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`image_${i}`) as File | null;
      if (file && file.size > 0) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          return NextResponse.json({ error: `Tipo de archivo no permitido: ${file.type}` }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: `Archivo demasiado grande (máx 10MB)` }, { status: 400 });
        }
        files.push(file);
      }
    }

    const imageUrls: string[] = [];
    
    // Subir cada archivo a Supabase Storage: 'feed-media'
    for (const file of files) {
      const extension = file.name.split('.').pop();
      const filename = `${crypto.randomUUID()}.${extension}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('feed-media')
        .upload(filename, buffer, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error("Error al subir imagen a bucket 'feed-media': " + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from('feed-media')
        .getPublicUrl(filename);

      imageUrls.push(publicUrlData.publicUrl);
    }

    // Insertar el Post
    const { data: postData, error: dbError } = await supabase
      .from("posts")
      .insert({
        title: title || null,
        description: description || null,
        images: imageUrls,
        author_id: user.primaryEmailAddress.emailAddress,
        author_name: user.fullName || "Administrador",
        author_avatar_url: user.imageUrl,
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ success: true, data: postData });

  } catch (error: any) {
    console.error("Error publicando en feed:", error);
    return NextResponse.json({ error: error.message || "Ocurrió un error interno durante la publicación." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
       return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    // Obtener los posts con sus likes y comentarios (Join automático de Supabase gracias a las Foreign Keys)
    const { data: posts, error } = await supabase
      .from("posts")
      .select(`
        *,
        likes ( user_id ),
        comments ( * )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Mapear para devolver a Next.js un flag de si el usuario actual le dio like y contar el total
    const currentUserEmail = user.primaryEmailAddress?.emailAddress;

    const formattedPosts = posts?.map((post: any) => {
      // likes es un arreglo [{ user_id: '...' }, ...]
      const totalLikes = post.likes?.length || 0;
      const hasLiked = post.likes?.some((l: any) => l.user_id === currentUserEmail);
      
      // Ordenar comentarios (los más antiguos primero para sentir flujo natural)
      const sortedComments = (post.comments || []).sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return {
        ...post,
        likesCount: totalLikes,
        hasLiked,
        comments: sortedComments
      };
    });

    return NextResponse.json({ success: true, data: formattedPosts });
  } catch (error: any) {
    console.error("Error al obtener feed:", error);
    return NextResponse.json({ error: "Error interno al cargar el feed." }, { status: 500 });
  }
}
