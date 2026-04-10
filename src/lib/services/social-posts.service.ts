// ══════════════════════════════════════════════
// Social Posts Service — CRUD operations on social_posts
// All queries scoped by user_id for multi-tenant isolation
// ══════════════════════════════════════════════

import { supabase } from "@/lib/supabase";
import type { SocialPost, CreatePostDTO, UpdatePostDTO, PostStatus } from "@/lib/types/social.types";

interface ListPostsFilters {
  status?: PostStatus;
  page?: number;
  limit?: number;
}

/**
 * List posts for a user, with optional status filter and pagination
 */
export async function listPosts(
  userId: string,
  filters: ListPostsFilters = {}
): Promise<{ posts: SocialPost[]; total: number }> {
  const { status, page = 1, limit = 20 } = filters;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("social_posts")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { posts: (data || []) as SocialPost[], total: count || 0 };
}

/**
 * Get a single post by ID (scoped by user)
 */
export async function getPost(id: string, userId: string): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as SocialPost;
}

/**
 * Create a new post
 */
export async function createPost(dto: CreatePostDTO): Promise<SocialPost> {
  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      user_id: dto.user_id,
      caption: dto.caption,
      image_url: dto.image_url || null,
      image_prompt: dto.image_prompt || null,
      status: dto.status || "pending",
      scheduled_at: dto.scheduled_at || null,
      platform: dto.platform || "facebook",
    })
    .select()
    .single();

  if (error) throw error;
  return data as SocialPost;
}

/**
 * Update a post (edit caption, change status, reschedule, etc.)
 */
export async function updatePost(
  id: string,
  userId: string,
  dto: UpdatePostDTO
): Promise<SocialPost> {
  const updateData: Record<string, unknown> = {};
  if (dto.caption !== undefined) updateData.caption = dto.caption;
  if (dto.image_url !== undefined) updateData.image_url = dto.image_url;
  if (dto.status !== undefined) updateData.status = dto.status;
  if (dto.scheduled_at !== undefined) updateData.scheduled_at = dto.scheduled_at;
  if (dto.platform !== undefined) updateData.platform = dto.platform;

  const { data, error } = await supabase
    .from("social_posts")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as SocialPost;
}

/**
 * Delete a post (only if not published)
 */
export async function deletePost(id: string, userId: string): Promise<void> {
  // First verify the post exists and isn't published
  const post = await getPost(id, userId);
  if (!post) throw new Error("Post no encontrado");
  if (post.status === "published") throw new Error("No puedes eliminar un post ya publicado");

  // Delete image from storage if exists
  if (post.image_url) {
    try {
      const url = new URL(post.image_url);
      const storagePath = url.pathname.split("/object/public/ai-generations/")[1];
      if (storagePath) {
        await supabase.storage.from("ai-generations").remove([storagePath]);
      }
    } catch (e) {
      console.error("Error eliminando imagen de storage (no crítico):", e);
    }
  }

  const { error } = await supabase
    .from("social_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Get all publishable posts (approved + scheduled time reached)
 */
export async function getPublishablePosts(): Promise<SocialPost[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("status", "approved")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  return (data || []) as SocialPost[];
}

/**
 * Get post counts grouped by status for a user
 */
export async function getStatusCounts(userId: string): Promise<Record<string, number>> {
  const statuses: PostStatus[] = ['pending', 'approved', 'published', 'failed', 'rejected'];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const { count, error } = await supabase
      .from("social_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", status);

    if (!error) counts[status] = count || 0;
  }

  return counts;
}
