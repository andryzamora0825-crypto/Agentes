import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();

    // The entire settings object we want to store in clerk's publicMetadata using deep merge
    // Clerk uses shallow update on the top level keys. So we update an entirely new object `aiSettings`
    
    const client = await clerkClient();
    
    // Merge existing metadata
    const existingMetadata = user.publicMetadata || {};

    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...existingMetadata,
        aiSettings: body // { agencyName, agencyDescription, refImages, ... }
      }
    });

    return NextResponse.json({ success: true, message: "Ajustes de IA guardados." });

  } catch (error: any) {
    console.error("Error guardando ai-settings:", error);
    return NextResponse.json({ error: "Error al guardar en Clerk" }, { status: 500 });
  }
}
