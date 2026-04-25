// ══════════════════════════════════════════════
// POST /api/social/generate — Generate content with AI
// Triggered by: Admin dashboard OR cron job
// Uses Gemini (Nano Banana) — same tech as Estudio IA
// ══════════════════════════════════════════════

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { generateFullPost } from "@/lib/services/ai-content.service";
import { createPost } from "@/lib/services/social-posts.service";
import { validateCronAuth } from "@/lib/services/cron-auth.service";
import { logSocialAction } from "@/lib/utils/logger";
import { spendCredits, refundCredits, ensureSeeded, InsufficientCreditsError } from "@/lib/credits";
import { supabase } from "@/lib/supabase";

export const maxDuration = 300; // 5 min timeout for AI generation

// Admin email (same as used across the app)
const ADMIN_EMAIL = "andryzamora0825@gmail.com";
const SOCIAL_GEN_COST = 100;          // Créditos por imagen
const SOCIAL_DAILY_LIMIT = 20;         // Tope de imágenes auto/día/usuario

export async function POST(request: Request) {
  try {
    let userId: string;
    let isAuthorized = false;

    // Auth: Either Clerk user (admin) or cron secret
    const user = await currentUser();
    
    if (user) {
      userId = user.id;
      const userEmail = user.primaryEmailAddress?.emailAddress;
      const isUnlocked = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
      isAuthorized = userEmail === ADMIN_EMAIL || isUnlocked;
      
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "No tienes el módulo de Social Media activado." },
          { status: 403 }
        );
      }
    } else if (validateCronAuth(request)) {
      // Cron job — use admin ID from settings or a system ID
      userId = "system_cron";
      isAuthorized = true;
    } else {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      topic = "Contenido motivacional para emprendedores",
      platform = "facebook",
      imageFormat = "square",
      brandVoice = "profesional y cercano",
      scheduled_at = null,
      targetPlatform = "",
      useAgencyIdentity = true,
      useAgencyCharacter = false,
    } = body;

    if (!topic?.trim()) {
      return NextResponse.json({ error: "Falta el tema/topic del post" }, { status: 400 });
    }

    // ── TOPE DIARIO POR USUARIO (anti-runaway) ──
    if (userId !== "system_cron") {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase.from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", dayStart.toISOString());
      if ((todayCount || 0) >= SOCIAL_DAILY_LIMIT) {
        return NextResponse.json({
          error: `Tope diario alcanzado (${SOCIAL_DAILY_LIMIT} imágenes/día). Vuelve mañana o ajusta tu plan.`,
        }, { status: 429 });
      }
    }

    // ── COBRO DE CRÉDITOS (excepto cron, que cobra en su propio worker) ──
    let chargedLedgerId: string | null = null;
    if (user && userId !== "system_cron") {
      await ensureSeeded(userId, Number(user.publicMetadata?.credits || 0));
      try {
        const r = await spendCredits({
          userId,
          amount: SOCIAL_GEN_COST,
          relatedId: `social_generate_${Date.now()}`,
          idempotencyKey: `social_gen_${userId}_${Date.now()}`,
          note: "Generación social manual",
        });
        chargedLedgerId = r.ledgerId;
      } catch (e: any) {
        if (e instanceof InsufficientCreditsError) {
          return NextResponse.json({
            error: `Créditos insuficientes. Necesitas ${SOCIAL_GEN_COST}, tienes ${e.have}.`,
          }, { status: 402 });
        }
        throw e;
      }
    }

    await logSocialAction("generate", { topic, platform, imageFormat }, null, userId);

    // Extract aiSettings from the user object if available
    const aiSettings = user?.publicMetadata?.aiSettings;

    let caption: string, imageUrl: string, imagePrompt: string, model: string;
    try {
      const result = await generateFullPost(
        { topic, brandVoice, platform, imageFormat, targetPlatform, useAgencyIdentity, useAgencyCharacter },
        userId,
        aiSettings
      );
      caption = result.caption;
      imageUrl = result.imageUrl;
      imagePrompt = result.imagePrompt;
      model = result.model;
    } catch (genErr: any) {
      // Reembolso si la generación falló
      if (chargedLedgerId && user) {
        try {
          await refundCredits({
            userId,
            amount: SOCIAL_GEN_COST,
            relatedId: chargedLedgerId,
            idempotencyKey: `refund_${chargedLedgerId}`,
            note: `refund: ${String(genErr?.message || "social gen failure").slice(0, 120)}`,
          });
        } catch {}
      }
      throw genErr;
    }

    // Save to DB
    const post = await createPost({
      user_id: userId,
      caption,
      image_url: imageUrl,
      image_prompt: imagePrompt,
      status: "pending",
      scheduled_at,
      platform,
    });

    await logSocialAction("generate", { model, caption: caption.slice(0, 100) }, post.id, userId);

    return NextResponse.json({
      success: true,
      post,
      model,
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error generando contenido:", error?.message || error);
    await logSocialAction("error", { 
      endpoint: "generate", 
      error: error?.message || "Unknown error" 
    });
    
    return NextResponse.json(
      { error: error?.message || "Error generando contenido con IA." },
      { status: 500 }
    );
  }
}
