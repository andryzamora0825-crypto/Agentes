import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Protección absoluta: Solo Admin
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado. Solo administrador." }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, isUnlocked, meta_page_id, meta_page_access_token, meta_ig_user_id, auto_generate } = body;

    if (!targetUserId) {
        return NextResponse.json({ error: "Falta targetUserId" }, { status: 400 });
    }

    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    
    const oldMeta = targetUser.publicMetadata?.socialMediaSettings as any || {};

    // Actualiza la publicMetadata inyectando el flag de acceso a Social Media y RESPALDANDO los tokens por seguridad
    await client.users.updateUser(targetUserId, {
      publicMetadata: {
        ...targetUser.publicMetadata,
        socialMediaSettings: {
          ...oldMeta,
          isUnlocked: !!isUnlocked,
          meta_page_id: meta_page_id || oldMeta.meta_page_id || "",
          meta_page_access_token: meta_page_access_token || oldMeta.meta_page_access_token || "",
          meta_ig_user_id: meta_ig_user_id || oldMeta.meta_ig_user_id || "",
          auto_generate: !!auto_generate,
        }
      }
    });

    // Guardar los tokens en Supabase para el cliente
    const { data: existing } = await supabase
      .from("social_settings")
      .select("id")
      .eq("user_id", targetUserId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("social_settings")
        .update({
          meta_page_id: meta_page_id || null,
          meta_page_access_token: meta_page_access_token || null,
          meta_ig_user_id: meta_ig_user_id || null,
          auto_generate: !!auto_generate,
        })
        .eq("user_id", targetUserId);
        
      if (error) console.error("Error actualizando Supabase:", error);
    } else {
      const { error } = await supabase
        .from("social_settings")
        .insert({
          user_id: targetUserId,
          meta_page_id: meta_page_id || null,
          meta_page_access_token: meta_page_access_token || null,
          meta_ig_user_id: meta_ig_user_id || null,
          auto_generate: !!auto_generate,
        });

      if (error) console.error("Error insertando Supabase:", error);
    }

    return NextResponse.json({ success: true, message: "Social Media actualizado para este cliente" });
  } catch (error: any) {
    console.error("Error guardando config Social Media Admin:", error);
    return NextResponse.json({ error: "No se pudo guardar la configuración" }, { status: 500 });
  }
}
