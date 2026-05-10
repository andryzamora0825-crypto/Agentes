import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ isAdmin: false });

    const { data } = await supabase
      .from("admins")
      .select("email")
      .eq("email", email)
      .single();

    return NextResponse.json({ isAdmin: !!data });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
