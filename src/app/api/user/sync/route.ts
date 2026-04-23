import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { getBalance } from "@/lib/credits";

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Fuente de verdad: Supabase credit_balances (si existe). Fallback: publicMetadata.
    let currentCredits: number | undefined = undefined;
    try {
      const bal = await getBalance(user.id);
      if (typeof bal === "number") currentCredits = bal;
    } catch {
      // Si la tabla aún no existe, caer al metadata
    }
    if (typeof currentCredits !== "number") {
      currentCredits = user.publicMetadata?.credits as number | undefined;
    }

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
    const hasSocialMedia = !!(user.publicMetadata as any)?.socialMediaSettings?.isUnlocked;
    
    return NextResponse.json({ 
      success: true, 
      credits: Number(currentCredits), 
      isNew: false, 
      plan: currentPlan,
      daysLeft: daysLeft,
      hasWhatsappBot,
      hasSocialMedia
    });

  } catch (error: any) {
    console.error("Error sincronizando usuario:", error);
    return NextResponse.json({ error: "Fallo interno al validar economía." }, { status: 500 });
  }
}
