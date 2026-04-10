import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

// GET — Listar recargas del agente autenticado
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    let query = supabase
      .from("whatsapp_recargas")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error("Error listando recargas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — Actualizar estado de una recarga
export async function PATCH(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id, status } = await request.json();

    if (!id || !["completed", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { error, data: updated } = await supabase
      .from("whatsapp_recargas")
      .update({ status })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select();

    if (error) throw error;

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Recarga no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error actualizando recarga:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
