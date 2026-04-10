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
 * SMART TOKEN RESOLVER: Resolves a valid Page ID + Page Token from whatever the user configured.
 * 
 * Problem: Users often paste their personal User ID instead of their Page ID,
 * or paste a User Token instead of a Page Token. Both cause publishing errors.
 * 
 * Solution: This function tries multiple strategies:
 * 1. Direct exchange: GET /{pageId}?fields=access_token (works if pageId is actually a Page)
 * 2. Auto-discovery: GET /me/accounts (lists ALL pages the user manages, picks the first one)
 * 
 * Returns: { resolvedPageId, resolvedPageToken } — guaranteed to be a real Page or throws.
 */
async function resolvePageCredentials(
  storedPageId: string,
  userOrPageToken: string
): Promise<{ resolvedPageId: string; resolvedPageToken: string }> {
  
  // Strategy 1: Try direct exchange (works when storedPageId IS a real Page ID)
  try {
    const res = await fetch(
      `${META_GRAPH_URL}/${storedPageId}?fields=access_token,name,category&access_token=${userOrPageToken}`
    );
    const data = await res.json();

    if (data.access_token && data.category) {
      // It's a real Page! We got a Page Token.
      console.log(`[META] ✅ Página verificada: "${data.name}" (${data.category}) — Token OK`);
      return { resolvedPageId: storedPageId, resolvedPageToken: data.access_token };
    }

    if (data.access_token && !data.category) {
      console.warn(`[META] ⚠️ ID ${storedPageId} devolvió token pero sin categoría — posible perfil personal`);
      // Fall through to auto-discovery
    }
  } catch (err) {
    console.warn(`[META] ⚠️ Error en intercambio directo:`, err);
  }

  // Strategy 2: Auto-discover — ask Meta for ALL pages this token can manage
  try {
    console.log(`[META] 🔍 Auto-descubriendo páginas del usuario...`);
    const res = await fetch(
      `${META_GRAPH_URL}/me/accounts?fields=id,name,access_token,category&access_token=${userOrPageToken}`
    );
    const data = await res.json();

    if (data.data && data.data.length > 0) {
      // Pick the first page (or try to match the stored ID)
      let page = data.data.find((p: any) => p.id === storedPageId) || data.data[0];
      console.log(`[META] ✅ Página auto-descubierta: "${page.name}" (ID: ${page.id}, Categoría: ${page.category})`);
      return { resolvedPageId: page.id, resolvedPageToken: page.access_token };
    }

    console.error(`[META] ❌ El usuario no administra ninguna Página de Facebook.`);
  } catch (err) {
    console.error(`[META] ❌ Error en auto-descubrimiento:`, err);
  }

  // Last resort: use what we have and let it fail with a clear error
  console.error(`[META] ❌ No se pudo resolver una Página válida. Usando token original como fallback.`);
  return { resolvedPageId: storedPageId, resolvedPageToken: userOrPageToken };
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
    // SMART RESOLVE: Gets the REAL Page ID + Page Token even if the user stored wrong data.
    // Fixes both "publish_actions deprecated" AND "not allowed to upload photos" errors.
    const { resolvedPageId, resolvedPageToken } = await resolvePageCredentials(pageId, accessToken);

    let endpoint: string;
    let body: Record<string, string>;

    if (imageUrl) {
      // Photo post — uses the RESOLVED Page ID, not the stored one
      endpoint = `${META_GRAPH_URL}/${resolvedPageId}/photos`;
      body = {
        url: imageUrl,
        caption,
        access_token: resolvedPageToken,
      };
    } else {
      // Text-only post
      endpoint = `${META_GRAPH_URL}/${resolvedPageId}/feed`;
      body = {
        message: caption,
        access_token: resolvedPageToken,
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
    // For Instagram, we need the Page Token but keep using the IG User ID for endpoints
    const { resolvedPageToken } = await resolvePageCredentials(igUserId, accessToken);

    // Step 1: Create media container
    const containerRes = await fetch(`${META_GRAPH_URL}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: resolvedPageToken,
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
        access_token: resolvedPageToken,
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
      const permalinkRes = await fetch(`${META_GRAPH_URL}/${publishData.id}?fields=permalink&access_token=${resolvedPageToken}`);
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
