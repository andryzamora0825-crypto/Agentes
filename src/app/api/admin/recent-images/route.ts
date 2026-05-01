import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

async function isAdmin(email: string): Promise<boolean> {
  const { data } = await supabase.from("admins").select("email").eq("email", email).single();
  return !!data;
}

export async function GET() {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || !(await isAdmin(email))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Get the last 15 images across ALL users
    const { data, error } = await supabase
      .from("ai_images")
      .select("id, prompt, image_url, author_id, author_name, author_avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) throw error;

    return NextResponse.json({ success: true, images: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
