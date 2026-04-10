import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { generateFullPost } from "@/lib/services/ai-content.service";
import { createPost } from "@/lib/services/social-posts.service";
import { publishPost } from "@/lib/services/meta-publisher.service";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

export const maxDuration = 300; // 5 minutos de timeout por si demora

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Protección absoluta: Solo Admin
    if (!user || user.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "No autorizado. Solo administrador." }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, topic, platform, imageFormat } = body;

    if (!targetUserId || !topic) {
        return NextResponse.json({ error: "Faltan datos requeridos (targetUserId, topic)" }, { status: 400 });
    }

    // Obtener la configuración del cliente (Tokens y Prompts)
    const { data: settings } = await supabase
      .from("social_settings")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    // Obtener aiSettings y tokens perdidos en migración del usuario desde Clerk
    const client = await clerkClient();
    const targetUserClerk = await client.users.getUser(targetUserId);
    const aiSettings = targetUserClerk.publicMetadata?.aiSettings || null;
    const oldClerkTokens = targetUserClerk.publicMetadata?.socialMediaSettings as any;

    const page_access_token = settings?.meta_page_access_token || oldClerkTokens?.meta_page_access_token;
    const brand_voice = settings?.brand_voice || "profesional y cercano";
    const custom_prompt_template = settings?.custom_prompt_template || "";

    if (!page_access_token) {
        return NextResponse.json({ error: "Este cliente no tiene los tokens de Meta configurados (Page Access Token faltante)." }, { status: 400 });
    }

    // Construir el "Brand Voice" o prompt final usando la plantilla del cliente
    let finalTopic = topic;
    
    if (custom_prompt_template) {
       finalTopic = `${topic}\nTono de Voz exigido: ${brand_voice}\nEstilo Visual exigido: ${custom_prompt_template}`;
    } else {
       finalTopic = `${topic}\nTono de Voz: ${brand_voice}`;
    }

    // Paso 1: Generar con IA usando aiSettings
    const { caption, imageUrl, imagePrompt, model } = await generateFullPost(
      { 
        topic: finalTopic, 
        brandVoice: brand_voice, 
        platform: platform || "both", 
        imageFormat: imageFormat || "square" 
      },
      targetUserId,
      aiSettings // <- PASAMOS aiSettings PARA REPLICAR ESTUDIO IA
    );

    // Paso 2: Guardar el post asociado al cliente
    const post = await createPost({
      user_id: targetUserId,
      caption,
      image_url: imageUrl,
      image_prompt: imagePrompt,
      status: "pending",
      scheduled_at: new Date().toISOString(),
      platform: platform || "both",
    });

    // Paso 3: Publicarlo inmediatamente
    const result = await publishPost(post);

    if (result.success) {
      await supabase
        .from("social_posts")
        .update({
          status: "published",
          meta_post_id: result.metaPostId,
          published_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", post.id);
        
      return NextResponse.json({ success: true, postUrl: result.postUrl, metaPostId: result.metaPostId });
    } else {
      await supabase
        .from("social_posts")
        .update({
          status: "failed",
          last_error: result.error,
        })
        .eq("id", post.id);
        
      return NextResponse.json({ error: result.error || "Fallo en la publicación a Meta" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Broadcast Single Error:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}
