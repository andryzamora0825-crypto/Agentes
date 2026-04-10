// ══════════════════════════════════════════════
// Meta Publisher Service — Facebook & Instagram Publishing
// Includes mock mode for development and real Meta Graph API integration
// Retry logic with exponential backoff
// ══════════════════════════════════════════════

import type { SocialPost, PublishResult } from "@/lib/types/social.types";
import { supabase } from "@/lib/supabase";
import { clerkClient } from "@clerk/nextjs/server";

const MAX_RETRIES = 3;
const META_GRAPH_URL = "https://graph.facebook.com/v25.0";

/**
 * CRITICAL FIX: Exchanges a User Token for a Page Token.
 * The "publish_actions is deprecated" error happens when you use a User Token
 * instead of a Page Token. This function asks Meta: "give me the real Page Token
 * for this Page ID using my User Token", which is what Facebook actually requires.
 * If the token is ALREADY a Page Token, the exchange still works (returns itself).
 */
async function getPageAccessToken(pageId: string, userOrPageToken: string): Promise<string> {
  try {
    const res = await fetch(
      `${META_GRAPH_URL}/${pageId}?fields=access_token&access_token=${userOrPageToken}`
    );
    const data = await res.json();

    if (data.access_token) {
      console.log(`[META] ✅ Page Token obtenido exitosamente para Page ${pageId}`);
      return data.access_token; // This is the REAL Page Token
    }

    // If we can't exchange, fall back to the original token and let it fail naturally
    console.warn(`[META] ⚠️ No se pudo intercambiar token para Page ${pageId}:`, data.error?.message || "Unknown");
    return userOrPageToken;
  } catch (err) {
    console.warn(`[META] ⚠️ Error en intercambio de token, usando token original:`, err);
    return userOrPageToken;
  }
}

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
    // CRITICAL: Exchange the token for a real Page Token BEFORE publishing.
    // This is the fix for "publish_actions is deprecated" — that error means
    // a User Token was sent instead of a Page Token.
    const pageToken = await getPageAccessToken(pageId, accessToken);

    let endpoint: string;
    let body: Record<string, string>;

    if (imageUrl) {
      // Photo post
      endpoint = `${META_GRAPH_URL}/${pageId}/photos`;
      body = {
        url: imageUrl,
        caption,
        access_token: pageToken,
      };
    } else {
      // Text-only post
      endpoint = `${META_GRAPH_URL}/${pageId}/feed`;
      body = {
        message: caption,
        access_token: pageToken,
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
    // Same fix as Facebook: exchange for Page Token first
    const pageToken = await getPageAccessToken(igUserId, accessToken);

    // Step 1: Create media container
    const containerRes = await fetch(`${META_GRAPH_URL}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: pageToken,
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
        access_token: pageToken,
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
      const permalinkRes = await fetch(`${META_GRAPH_URL}/${publishData.id}?fields=permalink&access_token=${pageToken}`);
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

  const settings = data || {};

  // OBTENER FALLBACK DE CLERK (Problema de migración de DB actual)
  if (!settings.meta_page_access_token) {
    try {
      const client = await clerkClient();
      const userClerk = await client.users.getUser(userId);
      const sm = userClerk.publicMetadata?.socialMediaSettings as any;
      if (sm) {
         settings.meta_page_id = settings.meta_page_id || sm.meta_page_id;
         settings.meta_page_access_token = settings.meta_page_access_token || sm.meta_page_access_token;
         settings.meta_ig_user_id = settings.meta_ig_user_id || sm.meta_ig_user_id;
      }
    } catch (error) {
      console.warn("No fallback data in clerk for", userId);
    }
  }

  return settings;
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

  if (!settings.meta_page_id || settings.meta_page_id.trim() === "" || settings.meta_page_id.toLowerCase() === "me") {
    return {
      success: false,
      error: "Page ID inválido. No puedes usar cuentas personales (User ID) o 'me' debido a regulaciones de Meta API."
    };
  }

  let result: PublishResult = { success: false, error: "Plataforma no soportada" };
  
  let fbSuccess = post.platform === "instagram"; // Only require FB if asking for FB or both
  let igSuccess = post.platform === "facebook"; // Only require IG if asking for IG or both
  let metaPostId = "";

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if ((post.platform === "facebook" || post.platform === "both") && !fbSuccess) {
        const fbResult = await publishToFacebook(
          settings.meta_page_id!,
          settings.meta_page_access_token!,
          post.caption,
          post.image_url
        );
        if (fbResult.success) {
          fbSuccess = true;
          metaPostId = fbResult.metaPostId!;
          result = fbResult;
        } else {
          result = fbResult;
        }
      }

      if ((post.platform === "instagram" || post.platform === "both") && !igSuccess) {
        if (!post.image_url) {
          result = { success: false, error: "Instagram requiere una imagen" };
        } else if (settings.meta_ig_user_id) {
          const igResult = await publishToInstagram(
            settings.meta_ig_user_id,
            settings.meta_page_access_token!,
            post.caption,
            post.image_url
          );
          if (igResult.success) {
            igSuccess = true;
            if (!metaPostId) metaPostId = igResult.metaPostId!;
            result = igResult;
          } else {
            result = igResult;
          }
        } else {
          result = { success: false, error: "No se encontró el ID de Instagram. Configúralo en los ajustes." };
        }
      }

      // If both required platforms are successful, break out of retry loop
      if (fbSuccess && igSuccess) {
        result.success = true;
        result.metaPostId = metaPostId; // Return at least one valid meta ID
        break;
      }

      // If we haven't succeeded on required platforms and still have retries remaining, delay and retry
      if (attempt < MAX_RETRIES) {
        await delay(attempt * 2000);
      }
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
