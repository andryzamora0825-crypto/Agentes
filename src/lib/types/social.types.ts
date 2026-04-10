// ══════════════════════════════════════════════
// Social Media Automation System — TypeScript Types
// Mirrors Supabase schema for social_posts, social_logs, social_settings
// ══════════════════════════════════════════════

export type PostStatus = 'pending' | 'approved' | 'published' | 'failed' | 'rejected';
export type Platform = 'facebook' | 'instagram' | 'both';

export interface SocialPost {
  id: string;
  user_id: string;
  caption: string;
  image_url: string | null;
  image_prompt: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  platform: Platform;
  meta_post_id: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialLog {
  id: string;
  post_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface SocialSettings {
  id: string;
  user_id: string;
  meta_page_id: string | null;
  meta_page_access_token: string | null;
  meta_ig_user_id: string | null;
  brand_voice: string;
  default_platform: Platform;
  auto_generate: boolean;
  daily_post_count: number;
  custom_prompt_template: string | null;
  created_at: string;
  updated_at: string;
}

// DTO para crear un post
export interface CreatePostDTO {
  user_id: string;
  caption: string;
  image_url?: string | null;
  image_prompt?: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
  platform?: Platform;
}

// DTO para actualizar un post
export interface UpdatePostDTO {
  caption?: string;
  image_url?: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
  platform?: Platform;
}

// Resultado de publicación
export interface PublishResult {
  success: boolean;
  metaPostId?: string;
  postUrl?: string; // NUEVO: URL directa al post publicado
  error?: string;
}

// Parámetros para generar contenido
export interface GenerateContentParams {
  topic: string;
  brandVoice?: string;
  platform?: Platform;
  imageFormat?: string;
  useAgencyIdentity?: boolean;
  customTemplate?: string;
}
