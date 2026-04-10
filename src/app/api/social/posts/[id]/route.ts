// ══════════════════════════════════════════════
// /api/social/posts/[id] — Update & Delete a post
// PATCH: Edit caption, approve, reject, reschedule
// DELETE: Remove a post (if not published)
// ══════════════════════════════════════════════

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { updatePost, deletePost, getPost } from "@/lib/services/social-posts.service";
import { logSocialAction } from "@/lib/utils/logger";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    if (userEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate status transitions
    if (body.status) {
      const existing = await getPost(id, user.id);
      if (!existing) {
        return NextResponse.json({ error: "Post no encontrado." }, { status: 404 });
      }

      const validTransitions: Record<string, string[]> = {
        pending: ["approved", "rejected"],
        approved: ["pending", "published", "rejected"],
        rejected: ["pending"],
        failed: ["pending", "approved"],
        published: [], // Can't change published status
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `No se puede cambiar de '${existing.status}' a '${body.status}'.` },
          { status: 400 }
        );
      }
    }

    const updated = await updatePost(id, user.id, body);

    // Log the action
    const action = body.status === "approved" ? "approve" 
                 : body.status === "rejected" ? "reject" 
                 : "edit";
    await logSocialAction(action, { changes: Object.keys(body) }, id, user.id);

    return NextResponse.json({ success: true, post: updated });

  } catch (error: any) {
    console.error("[SOCIAL] Error actualizando post:", error);
    return NextResponse.json(
      { error: error?.message || "Error actualizando post." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    if (userEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
    }

    const { id } = await params;

    await deletePost(id, user.id);
    await logSocialAction("delete", {}, id, user.id);

    return NextResponse.json({ success: true, message: "Post eliminado." });

  } catch (error: any) {
    console.error("[SOCIAL] Error eliminando post:", error);
    return NextResponse.json(
      { error: error?.message || "Error eliminando post." },
      { status: 500 }
    );
  }
}
