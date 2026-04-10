// ══════════════════════════════════════════════
// /api/social/settings — Manage social media settings
// GET: Retrieve current settings
// POST: Save/update Meta tokens and preferences
// ══════════════════════════════════════════════

import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { logSocialAction } from "@/lib/utils/logger";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const isUnlocked = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
    if (userEmail !== ADMIN_EMAIL && !isUnlocked) {
      return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("social_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    return NextResponse.json({
      success: true,
      settings: data || null,
      hasMeta: !!data?.meta_page_access_token,
    });
  } catch (error: any) {
    console.error("[SOCIAL] Error obteniendo settings:", error);
    return NextResponse.json({ error: "Error cargando configuración." }, { status: 500 });
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
    const {
      meta_page_id,
      meta_page_access_token,
      meta_ig_user_id,
      brand_voice,
      default_platform,
      auto_generate,
      daily_post_count,
      custom_prompt_template,
    } = body;

    // Upsert settings (insert or update)
    const { data: existing } = await supabase
      .from("social_settings")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let result;
    if (existing) {
      // Update
      const { data, error } = await supabase
        .from("social_settings")
        .update({
          meta_page_id: meta_page_id ?? null,
          meta_page_access_token: meta_page_access_token ?? null,
          meta_ig_user_id: meta_ig_user_id ?? null,
          brand_voice: brand_voice ?? "profesional",
          default_platform: default_platform ?? "facebook",
          auto_generate: auto_generate ?? false,
          daily_post_count: daily_post_count ?? 1,
          custom_prompt_template: custom_prompt_template ?? null,
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from("social_settings")
        .insert({
          user_id: user.id,
          meta_page_id: meta_page_id ?? null,
          meta_page_access_token: meta_page_access_token ?? null,
          meta_ig_user_id: meta_ig_user_id ?? null,
          brand_voice: brand_voice ?? "profesional",
          default_platform: default_platform ?? "facebook",
          auto_generate: auto_generate ?? false,
          daily_post_count: daily_post_count ?? 1,
          custom_prompt_template: custom_prompt_template ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    await logSocialAction("edit", { section: "settings" }, null, user.id);

    return NextResponse.json({ success: true, settings: result });
  } catch (error: any) {
    console.error("[SOCIAL] Error guardando settings:", error);
    return NextResponse.json({ error: "Error guardando configuración." }, { status: 500 });
  }
}
