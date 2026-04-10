// ══════════════════════════════════════════════
// /api/social/posts — List & Create social posts
// GET: List posts for current user (admin)
// POST: Create a manual post
// ══════════════════════════════════════════════

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { listPosts, createPost, getStatusCounts } from "@/lib/services/social-posts.service";
import { logSocialAction } from "@/lib/utils/logger";
import type { PostStatus } from "@/lib/types/social.types";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const isUnlocked = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
    if (userEmail !== ADMIN_EMAIL && !isUnlocked) {
      return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PostStatus | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const { posts, total } = await listPosts(user.id, {
      status: status || undefined,
      page,
      limit,
    });

    // Also fetch status counts for the filter tabs
    const counts = await getStatusCounts(user.id);

    return NextResponse.json({
      success: true,
      posts,
      total,
      counts,
      page,
      limit,
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error listando posts:", error);
    return NextResponse.json({ error: "Error cargando posts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const isUnlocked = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
    if (userEmail !== ADMIN_EMAIL && !isUnlocked) {
      return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
    }

    const body = await request.json();
    const { caption, image_url, platform = "facebook", scheduled_at = null } = body;

    if (!caption?.trim()) {
      return NextResponse.json({ error: "El caption es obligatorio." }, { status: 400 });
    }

    const post = await createPost({
      user_id: user.id,
      caption: caption.trim(),
      image_url: image_url || null,
      platform,
      scheduled_at,
      status: "pending",
    });

    await logSocialAction("generate", { source: "manual", caption: caption.slice(0, 100) }, post.id, user.id);

    return NextResponse.json({ success: true, post });

  } catch (error: any) {
    console.error("[SOCIAL] Error creando post:", error);
    return NextResponse.json({ error: "Error creando post." }, { status: 500 });
  }
}
