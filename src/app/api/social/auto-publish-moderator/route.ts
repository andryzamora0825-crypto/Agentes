import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { createPost } from "@/lib/services/social-posts.service";
import OpenAI from "openai";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ isModerator: false });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const isUnlocked = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
    
    // Super-Admin o Dueño de Agencia
    if (userEmail === "andryzamora0825@gmail.com" || isUnlocked) {
      return NextResponse.json({ isModerator: true });
    }

    // El usuario es un empleado, revisar si está como moderador nativo
    const { data, error } = await supabase
      .from("social_settings")
      .select("id")
      .contains("moderators_list", [userEmail])
      .limit(1)
      .single();

    if (!error && data) {
      return NextResponse.json({ isModerator: true });
    }

    return NextResponse.json({ isModerator: false });
  } catch (error) {
    return NextResponse.json({ isModerator: false });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const isUnlocked = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
    const body = await request.json();
    const { imageUrl, imagePrompt } = body;

    if (!imageUrl || !imagePrompt) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    let adminSettings = null;

    // 1. Resolver el "Dueño" o la Agencia de la publicación
    if (userEmail === "andryzamora0825@gmail.com" || isUnlocked) {
      // Es dueño. Su agencia es su propio ID.
      const { data } = await supabase.from("social_settings").select("*").eq("user_id", user.id).single();
      adminSettings = data;
    } else {
      // Es empleado. Buscar el admin que lo contrató.
      const { data } = await supabase
        .from("social_settings")
        .select("*")
        .contains("moderators_list", [userEmail])
        .limit(1)
        .single();
      adminSettings = data;
    }

    if (!adminSettings) {
      return NextResponse.json({ error: "No se encontró configuración de Agencia para ti ni estás asignado como Moderador." }, { status: 403 });
    }

    // 2. RATE LIMIT (Anti-Spam)
    // Verificar cuántos posts se han creado en el último minuto para esta agencia
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count, error: countErr } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', adminSettings.user_id)
      .gte('created_at', oneMinuteAgo);

    if (count !== null && count >= 3) {
      return NextResponse.json({ error: "Has enviado demasiadas auto-publicaciones rápido. Espera un minuto." }, { status: 429 });
    }

    // 3. Generar el copy con OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "El motor de inteligencia de texto no está configurado." }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const voice = adminSettings.brand_voice && adminSettings.brand_voice.trim() !== "" 
      ? adminSettings.brand_voice 
      : "experto, claro y sumamente profesional";

    const sysPrompt = `Eres el Community Manager experto de la empresa.
Tu tono de marca debe ser rigurosamente: "${voice}".
Escribe un copy hipnótico, corto (max 2 párrafos) pero tremendamente persuasivo para Facebook e Instagram. Incluye 2 a 3 hashtags.
El post acompañará a una imagen generada con este prompt original: "${imagePrompt}". 
La idea es darle contexto de marketing a esa imagen. Devuelve SÓLO el copy resultante final, sin notas explicativas.`;

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: "system", content: sysPrompt }],
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 300,
    });

    const generatedCaption = chatCompletion.choices[0]?.message?.content?.trim() || "¡Tenemos una imagen increíble para ti!";

    // 4. Inserción Directa
    const postObj = await createPost({
      user_id: adminSettings.user_id, // Siempre va a la base de datos del Admin global
      caption: generatedCaption,
      image_url: imageUrl,
      image_prompt: imagePrompt,
      status: "approved", 
      platform: adminSettings.moderator_target_network || adminSettings.default_platform || "facebook"
    });

    return NextResponse.json({ 
      success: true, 
      message: "Enviado a la cola de publicación exitosamente",
      post: postObj
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error auto-publish-moderator:", error);
    return NextResponse.json(
      { error: "Rastreamos un problema procesando tu post automático. Reintenta." },
      { status: 500 }
    );
  }
}

