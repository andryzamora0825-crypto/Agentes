import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Protección estricta: Solo el administrador maestro
    if (!user || user.primaryEmailAddress?.emailAddress !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "Permiso denegado. Operación bloqueada." }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, newCredits, newPlan, action } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "Faltan parámetros de seguridad." }, { status: 400 });
    }

    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);

    const updateData: any = {};
    if (newCredits !== undefined) updateData.credits = newCredits;
    
    if (action === "renew_vip") {
      updateData.plan = "VIP";
      const currentExpiry = targetUser.publicMetadata?.vipExpiresAt as number | undefined;
      const now = Date.now();
      if (currentExpiry && currentExpiry > now) {
        // Stack: it's not expired yet, add 30 days to the remaining time.
        updateData.vipExpiresAt = currentExpiry + (30 * 24 * 60 * 60 * 1000);
      } else {
        // Expired or null context: start 30 days from right now.
        updateData.vipExpiresAt = now + (30 * 24 * 60 * 60 * 1000);
      }
    } else if (newPlan !== undefined) {
      updateData.plan = newPlan;
      if (newPlan === "VIP") {
        updateData.vipExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 días en milisegundos
      } else {
        updateData.vipExpiresAt = null; // Borramos el contador si pasa a FREE
      }
    }
    // Inyectar o remover créditos y planes
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: updateData
    });

    return NextResponse.json({ success: true, updatedBalance: newCredits });
  } catch (error: any) {
    console.error("Fallo al inyectar economía admin:", error);
    return NextResponse.json({ error: "Error conectando al panel central de Clerk." }, { status: 500 });
  }
}
