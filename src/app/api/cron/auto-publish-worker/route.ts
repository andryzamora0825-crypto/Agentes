import { NextResponse } from 'next/server';
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from '@/lib/supabase';
import { generateFullPost } from '@/lib/services/ai-content.service';
import { createPost } from '@/lib/services/social-posts.service';
import { publishPost } from '@/lib/services/meta-publisher.service';
import { spendCredits, refundCredits, ensureSeeded, InsufficientCreditsError } from "@/lib/credits";

export const maxDuration = 300; // 5 minutos permitidos en Vercel Pro

const AUTO_POST_COST = 100;       // Créditos por post auto generado
const AUTO_DAILY_LIMIT = 20;      // Máx posts auto/día/agencia (anti-runaway)

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

    // ── TOPE DIARIO POR AGENCIA: máximo 20 posts auto/día ──
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase.from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayStart.toISOString());
    if ((todayCount || 0) >= AUTO_DAILY_LIMIT) {
      console.warn(`[Worker ${userId}] 🛑 Tope diario alcanzado (${todayCount}/${AUTO_DAILY_LIMIT})`);
      return NextResponse.json({ error: "Tope diario alcanzado", todayCount }, { status: 429 });
    }

    // ── COBRO DE CRÉDITOS: si la agencia no tiene saldo, auto-pausar ──
    await ensureSeeded(userId, Number(targetUserClerk.publicMetadata?.credits || 0));
    let chargedLedgerId: string | null = null;
    try {
      const r = await spendCredits({
        userId,
        amount: AUTO_POST_COST,
        relatedId: `auto_publish_${Date.now()}`,
        idempotencyKey: `auto_publish_${userId}_${Date.now()}`,
        note: "Post auto generado por cron",
      });
      chargedLedgerId = r.ledgerId;
    } catch (e: any) {
      if (e instanceof InsufficientCreditsError) {
        // Sin saldo → pausar auto_generate para evitar drenarte a ti
        await supabase.from("social_settings")
          .update({ auto_generate: false })
          .eq("user_id", userId);
        console.warn(`[Worker ${userId}] 💸 Sin saldo (${e.have}/${AUTO_POST_COST}). auto_generate pausado.`);
        return NextResponse.json({ error: "Sin créditos suficientes, auto-publicación pausada", have: e.have }, { status: 402 });
      }
      throw e;
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
    let caption: string, imageUrl: string, imagePrompt: string;
    try {
      const result = await generateFullPost(
        {
          topic: finalTopic,
          brandVoice: brandVoice,
          platform: "facebook",
          imageFormat: "square"
        },
        userId,
        aiSettings
      );
      caption = result.caption;
      imageUrl = result.imageUrl;
      imagePrompt = result.imagePrompt;
    } catch (genErr: any) {
      // Reembolso si la generación falló
      if (chargedLedgerId) {
        try {
          await refundCredits({
            userId,
            amount: AUTO_POST_COST,
            relatedId: chargedLedgerId,
            idempotencyKey: `refund_${chargedLedgerId}`,
            note: `refund: ${String(genErr?.message || "auto gen failure").slice(0, 120)}`,
          });
        } catch {}
      }
      throw genErr;
    }

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
