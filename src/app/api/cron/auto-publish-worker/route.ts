import { NextResponse } from 'next/server';
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from '@/lib/supabase';
import { generateFullPost } from '@/lib/services/ai-content.service';
import { createPost } from '@/lib/services/social-posts.service';
import { publishPost } from '@/lib/services/meta-publisher.service';

export const maxDuration = 300; // 5 minutos permitidos en Vercel Pro

// Lista de temas aleatorios básicos en caso de que no haya uno definido.
const FALLBACK_TOPICS = [
  "Motivación y Superación Personal",
  "El futuro de los negocios interactivos",
  "Un consejo de impacto productivo",
  "Reflexión del día sobre aprendizaje continuo",
  "Datos curiosos sobre innovación",
  "Innovación para un desarrollo sostenible"
];

function getRandomDelay(minMs: number, maxMs: number) {
  return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: "No userId provided" }, { status: 400 });
    }

    // 1. Validar al usuario y estado auto_generate
    const { data: socialSettings, error: socialError } = await supabase
      .from("social_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!socialSettings || !socialSettings.auto_generate) {
      return NextResponse.json({ error: "El usuario está deshabilitado para generación automática." }, { status: 400 });
    }
    const client = await clerkClient();
    const targetUserClerk = await client.users.getUser(userId);
    const oldClerkTokens = targetUserClerk.publicMetadata?.socialMediaSettings as any;
    
    const page_access_token = socialSettings?.meta_page_access_token || oldClerkTokens?.meta_page_access_token;

    if (!page_access_token) {
      return NextResponse.json({ error: "Este cliente no tiene Tokens de Meta." }, { status: 400 });
    }

    // 2. Retardo Aleatorio (Random Delay) para simulación humana (0 a 140000ms = ~0 a 2.3 minutos)
    // Se usa maxDuration=300, banana dev toma aprox 15-30s. Así que hasta 4 minutos (240000ms) es factible y previsor.
    const delay = getRandomDelay(10000, 180000); 
    console.log(`[Worker ${userId}] DURMIENDO POR ${delay}ms para simulación de bot cron aleatorio...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    // 3. Obtener/construir el Tema y Tono (Brand Voice - Master Prompt)
    let randomFallback = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
    const brandVoice = socialSettings.brand_voice || "profesional y cercano";
    
    let finalTopic = `Tópico de idea general: ${randomFallback}`;
    if (socialSettings.custom_prompt_template && socialSettings.custom_prompt_template.trim().length > 0) {
      finalTopic = `Elige un sub-tema inspirador al azar enfocado en el esquema: ${socialSettings.custom_prompt_template}\nTono de Voz: ${brandVoice}`;
    } else {
      finalTopic = `${finalTopic}\nTono de Voz: ${brandVoice}`;
    }

    console.log(`[Worker ${userId}] Iniciando IA.`);

    // Obtener aiSettings del usuario desde Clerk
    const aiSettings = targetUserClerk.publicMetadata?.aiSettings || null;

    // 4. Invocar generador IA (Nano Banana + Gemini)
    const { caption, imageUrl, imagePrompt } = await generateFullPost(
      { 
        topic: finalTopic, 
        brandVoice: brandVoice, 
        platform: "facebook",  // Idealmente se usa la preferencia, por defecto Facebook.
        imageFormat: "square" 
      },
      userId,
      aiSettings // <- Se pasa aiSettings para aplicar anti-repetición y estilo
    );

    if (!imageUrl) {
        throw new Error("No se pudo generar la imagen IA.");
    }

    // 5. Guardar el post asociado al cliente
    const postData = await createPost({
      user_id: userId,
      caption,
      image_url: imageUrl,
      image_prompt: imagePrompt,
      status: "pending",
      scheduled_at: new Date().toISOString(),
      platform: "facebook",
    });

    // 6. Publicar automáticamente a Meta
    console.log(`[Worker ${userId}] Publicando a META el ID: ${postData.id}`);
    const result = await publishPost(postData);

    if (result.success) {
      await supabase
        .from("social_posts")
        .update({
          status: "published",
          meta_post_id: result.metaPostId,
          published_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", postData.id);
        
      console.log(`[Worker ${userId}] ÉXITO: ${result.postUrl}`);
      return NextResponse.json({ success: true, postUrl: result.postUrl });
    } else {
      await supabase
        .from("social_posts")
        .update({
          status: "failed",
          last_error: result.error,
        })
        .eq("id", postData.id);
        
      console.error(`[Worker ${userId}] FAIL: ${result.error}`);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

  } catch (err: any) {
    console.error(`[Worker Error]:`, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
