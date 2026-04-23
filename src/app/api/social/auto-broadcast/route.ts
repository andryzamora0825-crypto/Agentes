import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { createPost } from "@/lib/services/social-posts.service";
import OpenAI from "openai";

export const maxDuration = 120; // 2 min máximo para evitar Timeouts durante el Broadcasting

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ isModerator: false });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    
    // Si tiene agencias conectadas a él en Supabase
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
    if (!user) return NextResponse.json({ error: "No autorizado. Sistema bloqueado." }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const body = await request.json();
    const { imagePrompt } = body;

    if (!imagePrompt) {
      return NextResponse.json({ error: "Falta la señal del Prompt." }, { status: 400 });
    }

    // 1. Encontrar a todos los administradores (agencias) que tienen a este moderador
    const { data: allSettings, error: fetchErr } = await supabase
      .from("social_settings")
      .select("*")
      .contains("moderators_list", [userEmail]);

    if (fetchErr) throw fetchErr;

    if (!allSettings || allSettings.length === 0) {
      return NextResponse.json({ error: "No tienes flujos de automatización configurados en tu cuenta." }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Faltan credenciales maestras del sistema." }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 3. Procesar en Paralelo para cada Agencia
    const broadcastPromises = allSettings.map(async (adminSetting) => {
      const adminId = adminSetting.user_id;

      try {
        const finalUrl = body.imageUrl; // Reutilizamos directamente la imagen del moderador
        
        if (!finalUrl) {
          throw new Error("No se proporcionó la URL de la imagen del moderador.");
        }

        // G. Redactar el Copy Perfectamente Adaptado
        const voice = adminSetting.brand_voice || "dinámico y persuasivo";
        const copyInstruction = `Eres social media manager experto. Escribe un copy extremadamente persuasivo pero corto para esta campaña usando un tono: "${voice}". 
No expliques nada, entrega sólo el copy final con 2-3 hashtags. Contexto de la imagen generada: "${imagePrompt}"`;

        const copyCompletion = await openai.chat.completions.create({
          messages: [{ role: "system", content: copyInstruction }],
          model: "gpt-4o-mini",
          temperature: 0.8,
          max_tokens: 300,
        });

        const generatedCaption = copyCompletion.choices[0]?.message?.content?.trim() || "¡Nueva imagen increíble!";

        // H. PUBLICAR A LA COLA
        await createPost({
          user_id: adminId, 
          caption: generatedCaption,
          image_url: finalUrl,
          image_prompt: imagePrompt,
          status: "approved", 
          platform: adminSetting.moderator_target_network || adminSetting.default_platform || "facebook"
        });

        return { success: true, adminId };

      } catch (err: any) {
        console.error(`[Falló Broadcast para ${adminId}]:`, err.message);
        return { success: false, adminId, error: err.message };
      }
    });

    // 4. Ejecutar la ola simultánea
    const results = await Promise.allSettled(broadcastPromises);
    
    const succeeded = results.filter(r => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - succeeded;

    console.log(`[BROADCAST SUMMARY] Prompt: "${imagePrompt.slice(0,20)}..." | Éxito: ${succeeded} | Fallos (Reembolsados): ${failed}`);

    return NextResponse.json({ 
      success: true, 
      message: `El Broadcaster desplegó tu imagen a ${succeeded} agencias. Hubo ${failed} fallos recuperados.`,
      succeeded,
      failed
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error auto-broadcast masivo:", error);
    return NextResponse.json(
      { error: "Rastreamos un problema procesando el broadcaster masivo." },
      { status: 500 }
    );
  }
}
