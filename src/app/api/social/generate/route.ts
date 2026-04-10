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

export const maxDuration = 300; // 5 min timeout for AI generation

// Admin email (same as used across the app)
const ADMIN_EMAIL = "andryzamora0825@gmail.com";

export async function POST(request: Request) {
  try {
    let userId: string;
    let isAuthorized = false;

    // Auth: Either Clerk user (admin) or cron secret
    const user = await currentUser();
    
    if (user) {
      userId = user.id;
      const userEmail = user.primaryEmailAddress?.emailAddress;
      isAuthorized = userEmail === ADMIN_EMAIL;
      
      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Solo el administrador puede generar contenido." },
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
    } = body;

    if (!topic?.trim()) {
      return NextResponse.json({ error: "Falta el tema/topic del post" }, { status: 400 });
    }

    await logSocialAction("generate", { topic, platform, imageFormat }, null, userId);

    // Extract aiSettings from the user object if available
    const aiSettings = user?.publicMetadata?.aiSettings;

    // Generate content with AI (Nano Banana)
    const { caption, imageUrl, imagePrompt, model } = await generateFullPost(
      { topic, brandVoice, platform, imageFormat },
      userId,
      aiSettings
    );

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
