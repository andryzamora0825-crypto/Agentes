import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

// Permitir recuperar la configuración o guardarla
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const settings = user.publicMetadata?.whatsappSettings || {};
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("Error trayendo config WhatsApp:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { isActive, aiPersona, knowledgeBase, banksInfo, banksList, rechargeSteps, withdrawSteps, greetingMenu } = body;
    
    // Extraer metadata antigua para no sobreescribir isUnlocked ni providerConfig
    const oldMeta = user.publicMetadata?.whatsappSettings as any || {};

    // Si no está desbloqueado, no puede guardar nada
    if (!oldMeta.isUnlocked) {
      return NextResponse.json({ error: "Módulo bloqueado. Requiere compra." }, { status: 403 });
    }

    const client = await clerkClient();
    // Actualiza la publicMetadata preservando los campos técnicos del Admin
    await client.users.updateUser(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        whatsappSettings: {
          ...oldMeta,
          isActive: !!isActive,
          aiPersona: aiPersona || "",
          knowledgeBase: knowledgeBase || "",
          banksInfo: banksInfo || "",
          banksList: banksList || [],
          rechargeSteps: rechargeSteps || "",
          withdrawSteps: withdrawSteps || "",
          greetingMenu: greetingMenu || "",
        }
      }
    });

    return NextResponse.json({ success: true, message: "Entrenamiento guardado exitosamente" });
  } catch (error: any) {
    console.error("Error guardando entrenamiento WhatsApp:", error);
    return NextResponse.json({ error: "No se pudo guardar la configuración" }, { status: 500 });
  }
}
