import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { getBalance, ensureSeeded } from "@/lib/credits";

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Fuente de verdad: Supabase credit_balances (si existe). Fallback: publicMetadata.
    const clerkCredits = Number(user.publicMetadata?.credits || 0);

    // Siembra one-time: si el user tiene saldo en Clerk pero no en Supabase, lo migra.
    await ensureSeeded(user.id, clerkCredits);

    let currentCredits: number | undefined = undefined;
    try {
      const bal = await getBalance(user.id);
      if (typeof bal === "number") currentCredits = bal;
    } catch {
      // Si la tabla aún no existe, caer al metadata
    }

    if (typeof currentCredits !== "number") {
      currentCredits = clerkCredits;
    } else if (clerkCredits > currentCredits) {
      // 🚨 LEDGER HEALING: Clerk has more credits than Supabase.
      // This happens if an Operator assigned credits before Supabase integration
      // or if someone manually edited Clerk metadata. We honor Clerk and add the difference.
      const discrepancy = clerkCredits - currentCredits;
      const { earnCredits } = await import("@/lib/credits");
      try {
        await earnCredits({
          userId: user.id,
          amount: discrepancy,
          relatedId: "ledger_heal",
          note: `Ledger heal: Clerk had ${clerkCredits}, Supabase had ${currentCredits}`
        });
        currentCredits = clerkCredits;
      } catch (e) {
        console.error("Failed to heal ledger:", e);
      }
    } else if (currentCredits > clerkCredits) {
      // 🚨 LEDGER HEALING: Supabase has more credits than Clerk.
      // This happens if Clerk metadata update failed previously.
      // We update Clerk to match the source of truth (Supabase).
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: { credits: currentCredits }
        });
      } catch (e) {
        console.error("Failed to heal clerk metadata:", e);
      }
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
