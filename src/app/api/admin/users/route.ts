import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

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
    const { data: imgData } = await supabase.from("ai_images").select("author_id");
    const imgCounts: Record<string, number> = {};
    if (imgData) {
      imgData.forEach(row => {
        const mail = row.author_id?.toLowerCase();
        if (mail) imgCounts[mail] = (imgCounts[mail] || 0) + 1;
      });
    }

    // Mapear los datos que nos interesan para el escudo de Admin
    const users = response.data.map(u => {
      const email = u.emailAddresses[0]?.emailAddress || 'Sin Email';
      return {
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Desconocido',
        email: email,
        avatar: u.imageUrl,
        credits: u.publicMetadata?.credits,
        plan: u.publicMetadata?.plan || 'FREE',
        vipExpiresAt: u.publicMetadata?.vipExpiresAt,
        whatsappSettings: u.publicMetadata?.whatsappSettings || { isUnlocked: false, providerConfig: { apiUrl: "", idInstance: "", apiTokenInstance: "" } },
        createdAt: u.createdAt,
        generationCount: imgCounts[email.toLowerCase()] || 0
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("Error cargando usuarios en Admin Panel:", error);
    return NextResponse.json({ error: "Error consultando el Clerk Cloud." }, { status: 500 });
  }
}
