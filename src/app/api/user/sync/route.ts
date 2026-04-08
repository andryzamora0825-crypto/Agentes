import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Revisar si ya tiene asignados los créditos en su metadata
    const currentCredits = user.publicMetadata?.credits;

    // 2. Control de Rango (VIP / FREE) y Expiración
    let currentPlan = user.publicMetadata?.plan || 'FREE';
    let vipExpiresAt = user.publicMetadata?.vipExpiresAt as number | undefined | null;
    let daysLeft = 0;

    const client = await clerkClient();

    if (currentPlan === 'VIP' && vipExpiresAt) {
      if (Date.now() > vipExpiresAt) {
        // BAJAMOS A FREE Automáticamente
        currentPlan = 'FREE';
        vipExpiresAt = null;
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: {
            plan: 'FREE',
            vipExpiresAt: null
          }
        });
      } else {
        // Calcular días restantes
        const msLeft = vipExpiresAt - Date.now();
        daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      }
    }

    // 3. Si es su primera vez, inicia en 0 créditos (el bono de 10,000 se entrega al activar VIP)
    if (typeof currentCredits === 'undefined') {
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: {
          credits: 0,
          plan: 'FREE'
        }
      });
      return NextResponse.json({ success: true, credits: 0, isNew: true, plan: 'FREE', daysLeft: 0 });
    }

    // Retorno normal
    const hasWhatsappBot = !!(user.publicMetadata as any)?.whatsappSettings?.isUnlocked;
    
    return NextResponse.json({ 
      success: true, 
      credits: Number(currentCredits), 
      isNew: false, 
      plan: currentPlan,
      daysLeft: daysLeft,
      hasWhatsappBot
    });

  } catch (error: any) {
    console.error("Error sincronizando usuario:", error);
    return NextResponse.json({ error: "Fallo interno al validar economía." }, { status: 500 });
  }
}
