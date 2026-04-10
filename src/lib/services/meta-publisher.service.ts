// ══════════════════════════════════════════════
// Meta Publisher Service — Facebook & Instagram Publishing
// Includes mock mode for development and real Meta Graph API integration
// Retry logic with exponential backoff
// ══════════════════════════════════════════════

import type { SocialPost, PublishResult } from "@/lib/types/social.types";
import { supabase } from "@/lib/supabase";

const MAX_RETRIES = 3;
const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

/**
 * Check if we're in mock mode (no real Meta credentials configured)
 */
function isMockMode(): boolean {
  return !process.env.META_APP_ID || process.env.META_APP_ID === "your-meta-app-id";
}

/**
 * Mock publish — simulates a successful publish for development
 */
async function mockPublish(post: SocialPost): Promise<PublishResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  const mockPostId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[SOCIAL][MOCK] Published post ${post.id} → ${mockPostId}`);
  
  return {
    success: true,
    metaPostId: mockPostId,
  };
}

/**
 * Publish to Facebook Page via Graph API
 */
async function publishToFacebook(
  pageId: string,
  accessToken: string,
  caption: string,
  imageUrl?: string | null
): Promise<PublishResult> {
  try {
    let endpoint: string;
    let body: Record<string, string>;

    if (imageUrl) {
      // Photo post
      endpoint = `${META_GRAPH_URL}/${pageId}/photos`;
      body = {
        url: imageUrl,
        caption,
        access_token: accessToken,
      };
    } else {
      // Text-only post
      endpoint = `${META_GRAPH_URL}/${pageId}/feed`;
      body = {
        message: caption,
        access_token: accessToken,
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `Facebook API error: ${response.status}`,
      };
    }

    const metaPostId = data.id || data.post_id;
    return {
      success: true,
      metaPostId,
      postUrl: `https://facebook.com/${metaPostId}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error de red al publicar en Facebook",
    };
  }
}

/**
 * Publish to Instagram via Graph API (2-step process)
 */
async function publishToInstagram(
  igUserId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<PublishResult> {
  try {
    // Step 1: Create media container
    const containerRes = await fetch(`${META_GRAPH_URL}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    });

    const containerData = await containerRes.json();
    if (!containerRes.ok) {
      return {
        success: false,
        error: containerData.error?.message || "Error creando container de Instagram",
      };
    }

    const containerId = containerData.id;

    // Step 2: Publish the container
    const publishRes = await fetch(`${META_GRAPH_URL}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok) {
      return {
        success: false,
        error: publishData.error?.message || "Error publicando en Instagram",
      };
    }

    // Step 3: Fetch the dynamic permalink from Meta
    let postUrl: string | undefined;
    try {
      const permalinkRes = await fetch(`${META_GRAPH_URL}/${publishData.id}?fields=permalink&access_token=${accessToken}`);
      if (permalinkRes.ok) {
        const permalinkData = await permalinkRes.json();
        postUrl = permalinkData.permalink;
      }
    } catch (e) {
      console.warn("[SOCIAL] No se pudo obtener el permalink de Instagram", e);
    }

    return {
      success: true,
      metaPostId: publishData.id,
      postUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Error de red al publicar en Instagram",
    };
  }
}

/**
 * Get user's social settings (Meta tokens, etc.)
 */
async function getUserSettings(userId: string) {
  const { data } = await supabase
    .from("social_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  return data;
}

/**
 * Main publish function — handles mock mode, retries, and platform routing
 */
export async function publishPost(post: SocialPost): Promise<PublishResult> {
  // Get user settings for Meta tokens
  const settings = await getUserSettings(post.user_id);
  
  // Determine if we should use mock mode:
  // Mock if no user-level tokens AND no global env tokens
  const hasUserTokens = !!settings?.meta_page_access_token;
  const hasGlobalTokens = !!process.env.META_APP_ID && process.env.META_APP_ID !== "your-meta-app-id";
  
  if (!hasUserTokens && !hasGlobalTokens) {
    return mockPublish(post);
  }

  if (!hasUserTokens) {
    return {
      success: false,
      error: "No se encontraron credenciales de Meta. Ve a Configuración de Redes y configura tu Page Access Token.",
    };
  }

  let result: PublishResult = { success: false, error: "Plataforma no soportada" };

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (post.platform === "facebook" || post.platform === "both") {
        result = await publishToFacebook(
          settings.meta_page_id!,
          settings.meta_page_access_token!,
          post.caption,
          post.image_url
        );
        if (!result.success && attempt < MAX_RETRIES) {
          await delay(attempt * 2000); // 2s, 4s, 6s backoff
          continue;
        }
      }

      if (post.platform === "instagram" || post.platform === "both") {
        if (!post.image_url) {
          result = { success: false, error: "Instagram requiere una imagen" };
        } else if (settings.meta_ig_user_id) {
          result = await publishToInstagram(
            settings.meta_ig_user_id,
            settings.meta_page_access_token!,
            post.caption,
            post.image_url
          );
        } else {
          result = { success: false, error: "No se encontró el ID de Instagram" };
        }
      }

      // If success, break out of retry loop
      if (result.success) break;

    } catch (err: any) {
      result = { success: false, error: err.message };
      if (attempt < MAX_RETRIES) {
        await delay(attempt * 2000);
      }
    }
  }

  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
