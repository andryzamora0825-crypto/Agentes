import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // El owner_id es el id de Clerk
    const ownerId = user.id;

    // Eliminar el historial de chats del usuario
    const { error: errorChats } = await supabase
      .from("whatsapp_chats")
      .delete()
      .eq("owner_id", ownerId);

    if (errorChats) {
      console.error("Error borrando whatsapp_chats:", errorChats);
      throw new Error("No se pudo borrar el historial de chats");
    }

    // Eliminar las pausas activas del usuario
    const { error: errorPauses } = await supabase
      .from("whatsapp_pauses")
      .delete()
      .eq("owner_id", ownerId);

    if (errorPauses) {
      console.error("Error borrando whatsapp_pauses:", errorPauses);
      throw new Error("No se pudo borrar las pausas activas");
    }

    return NextResponse.json({ success: true, message: "Historial y pausas eliminados correctamente." });

  } catch (error: any) {
    console.error("Error reseteando bot:", error);
    return NextResponse.json({ error: "Error interno al resetear" }, { status: 500 });
  }
}
