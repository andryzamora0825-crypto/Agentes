import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const user = await currentUser();
    // Protección absoluta: Solo Admin
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado. Solo administrador." }, { status: 403 });
    }

    const client = await clerkClient();
    
    // Obtenemos lista de usuarios de Clerk (limite por defecto 100-500)
    const response = await client.users.getUserList({
      orderBy: "-created_at",
      limit: 100
    });
    
    // Mapear los datos que nos interesan para el escudo de Admin
    const users = response.data.map(u => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Desconocido',
      email: u.emailAddresses[0]?.emailAddress || 'Sin Email',
      avatar: u.imageUrl,
      credits: u.publicMetadata?.credits,
      plan: u.publicMetadata?.plan || 'VIP',
      whatsappSettings: u.publicMetadata?.whatsappSettings || { isUnlocked: false, providerConfig: { apiUrl: "", idInstance: "", apiTokenInstance: "" } },
      createdAt: u.createdAt
    }));

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("Error cargando usuarios en Admin Panel:", error);
    return NextResponse.json({ error: "Error consultando el Clerk Cloud." }, { status: 500 });
  }
}
