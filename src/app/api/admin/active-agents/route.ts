import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Verificar si es administrador
    const isAdmin = user.primaryEmailAddress?.emailAddress === "andryzamora0825@gmail.com";
    if (!isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const client = await clerkClient();
    
    // Alerta: Para gran escala esto requiere paginación, pero para prototipo 500 es suficiente
    const users = await client.users.getUserList({ limit: 500 });
    
    // Filtrar usuarios que tienen el bot desbloqueado y configurado
    const activeAgents = users.data.filter(u => {
      const waSettings = (u.publicMetadata?.whatsappSettings as any) || {};
      const hasBotUnlocked = waSettings.isUnlocked === true;
      const isActive = waSettings.isActive === true;
      const hasCreds = waSettings.providerConfig?.idInstance && waSettings.providerConfig?.apiTokenInstance;
      
      // Tiene el bot comprado, está encendido y vinculado a Green API
      return hasBotUnlocked && isActive && hasCreds;
    }).map(u => {
      const waSettings = u.publicMetadata.whatsappSettings as any;
      const aiSettings = u.publicMetadata.aiSettings as any || {};
      
      return {
        id: u.id,
        email: u.primaryEmailAddress?.emailAddress,
        name: u.fullName || u.firstName || "Agente",
        aiPersona: waSettings.aiPersona || "",
        agencyDesc: aiSettings.agencyDesc || "Estándar, amigable y profesional",
        primaryColor: aiSettings.primaryColor || "#FFDE00",
        secondaryColor: aiSettings.secondaryColor || "#000000",
        providerConfig: waSettings.providerConfig
      };
    });

    return NextResponse.json({ success: true, agents: activeAgents });

  } catch (error: any) {
    console.error("Error trayendo agentes activos:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
