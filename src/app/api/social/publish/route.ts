// ══════════════════════════════════════════════
// POST /api/social/publish — Publish approved posts
// Triggered by: Cron job (every 30 min) or manual admin trigger
// Queries approved posts with reached scheduled_at time
// Publishes via Meta Graph API (or mock)
// ══════════════════════════════════════════════

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getPublishablePosts } from "@/lib/services/social-posts.service";
import { publishPost } from "@/lib/services/meta-publisher.service";
import { logSocialAction } from "@/lib/utils/logger";
import { supabase } from "@/lib/supabase";
import { validateCronAuth } from "@/lib/services/cron-auth.service";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";
const MAX_RETRIES = 3;

export async function POST(request: Request) {
  try {
    let isAuthorized = false;

    // Auth: Either admin user or cron secret
    const user = await currentUser();
    if (user) {
      const userEmail = user.primaryEmailAddress?.emailAddress;
      const isUnlocked = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
      isAuthorized = userEmail === ADMIN_EMAIL || isUnlocked;
    } else {
      isAuthorized = validateCronAuth(request);
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await logSocialAction("cron_trigger", { endpoint: "publish" });

    // Get all publishable posts
    const posts = await getPublishablePosts();

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay posts pendientes de publicación.",
        published: 0,
      });
    }

    const results = [];

    for (const post of posts) {
      try {
        const result = await publishPost(post);

        if (result.success) {
          // Mark as published
          await supabase
            .from("social_posts")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              meta_post_id: result.postUrl || result.metaPostId || null,
            })
            .eq("id", post.id);

          await logSocialAction("publish", {
            metaPostId: result.metaPostId,
            platform: post.platform,
          }, post.id, post.user_id);

          results.push({ id: post.id, status: "published", metaPostId: result.metaPostId });
        } else {
          // Handle failure
          const newRetryCount = (post.retry_count || 0) + 1;
          const shouldFail = newRetryCount >= MAX_RETRIES;

          await supabase
            .from("social_posts")
            .update({
              status: shouldFail ? "failed" : "approved", // Keep approved for retry
              retry_count: newRetryCount,
              last_error: result.error || "Error desconocido",
            })
            .eq("id", post.id);

          await logSocialAction(
            shouldFail ? "publish_failed" : "retry",
            { error: result.error, retryCount: newRetryCount },
            post.id,
            post.user_id
          );

          results.push({
            id: post.id,
            status: shouldFail ? "failed" : "retrying",
            error: result.error,
            retryCount: newRetryCount,
          });
        }
      } catch (err: any) {
        // Catch individual post errors so other posts can still process
        await logSocialAction("error", { error: err.message }, post.id, post.user_id);
        results.push({ id: post.id, status: "error", error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error en publish cron:", error);
    await logSocialAction("error", { endpoint: "publish", error: error?.message });
    return NextResponse.json(
      { error: "Error procesando publicaciones." },
      { status: 500 }
    );
  }
}
