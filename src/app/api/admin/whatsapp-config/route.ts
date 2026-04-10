import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Protección absoluta: Solo Admin
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado. Solo administrador." }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, isUnlocked, providerConfig } = body;

    if (!targetUserId) {
        return NextResponse.json({ error: "Falta targetUserId" }, { status: 400 });
    }

    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    
    const oldMeta = targetUser.publicMetadata?.whatsappSettings as any || {};

    // Actualiza la publicMetadata inyectando los campos del admin
    await client.users.updateUser(targetUserId, {
      publicMetadata: {
        ...targetUser.publicMetadata,
        whatsappSettings: {
          ...oldMeta,
          isUnlocked: !!isUnlocked,
          providerConfig: providerConfig || { apiUrl: "", idInstance: "", apiTokenInstance: "" }
        }
      }
    });

    return NextResponse.json({ success: true, message: "WhatsApp AI actualizado para este cliente" });
  } catch (error: any) {
    console.error("Error guardando config WhatsApp Admin:", error);
    return NextResponse.json({ error: "No se pudo guardar la configuración técnica" }, { status: 500 });
  }
}
