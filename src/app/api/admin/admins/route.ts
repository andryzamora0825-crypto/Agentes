import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

// Helper: check if current user is admin
async function isAdmin(email: string): Promise<boolean> {
  const { data } = await supabase.from("admins").select("email").eq("email", email).single();
  return !!data;
}

// GET: List all admins
export async function GET() {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || !(await isAdmin(email))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data, error } = await supabase.from("admins").select("*").order("created_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ success: true, admins: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Add a new admin
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || !(await isAdmin(email))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { newAdminEmail } = body;

    if (!newAdminEmail?.trim() || !newAdminEmail.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const { error } = await supabase.from("admins").insert({
      email: newAdminEmail.toLowerCase().trim(),
      added_by: email,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Este email ya es administrador" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove an admin
export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || !(await isAdmin(email))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { targetEmail } = body;

    // Cannot remove yourself
    if (targetEmail?.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json({ error: "No puedes removerte a ti mismo" }, { status: 400 });
    }

    const { error } = await supabase.from("admins").delete().eq("email", targetEmail.toLowerCase());
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
