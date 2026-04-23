import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const meta = user.publicMetadata as any;
    if (meta?.role !== "operator") {
      return NextResponse.json({ error: "No eres un operador autorizado." }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, action, creditsDelta } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId requerido." }, { status: 400 });
    }

    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    const targetMeta = targetUser.publicMetadata as any;

    // Security: verify the target is linked to THIS operator
    if (targetMeta?.linkedOperatorId !== user.id) {
      return NextResponse.json({ error: "Este usuario no pertenece a tu agencia." }, { status: 403 });
    }

    // Refresh operator's own metadata for atomic inventory reads
    const operatorFresh = await client.users.getUser(user.id);
    const operatorMeta = operatorFresh.publicMetadata as any;
    const inventory = operatorMeta?.operatorInventory || { vipTokens: 0, credits: 0 };

    const targetUpdate: any = {};
    const operatorUpdate: any = {};
    let logType = "";
    let logDetails = "";

    // ── ACTION: Assign VIP (costs 1 vipToken) ──
    if (action === "assign_vip") {
      if (inventory.vipTokens <= 0) {
        return NextResponse.json({ error: "No tienes Tokens VIP en tu inventario. Contacta al Admin para recargar." }, { status: 400 });
      }

      targetUpdate.plan = "VIP";
      const currentExpiry = targetMeta?.vipExpiresAt as number | undefined;
      const now = Date.now();
      if (currentExpiry && currentExpiry > now) {
        targetUpdate.vipExpiresAt = currentExpiry + (30 * 24 * 60 * 60 * 1000);
      } else {
        targetUpdate.vipExpiresAt = now + (30 * 24 * 60 * 60 * 1000);
      }

      // Deduct 1 token from operator
      operatorUpdate.operatorInventory = {
        ...inventory,
        vipTokens: inventory.vipTokens - 1
      };

      logType = "VIP";
      logDetails = `Plan VIP asignado por Operador ${operatorMeta.affiliateCode} (+30 días)`;
    }

    // ── ACTION: Modify Credits ──
    if (action === "modify_credits") {
      const delta = Number(creditsDelta);
      if (isNaN(delta) || delta === 0) {
        return NextResponse.json({ error: "creditsDelta inválido." }, { status: 400 });
      }

      const { earnCredits, spendCredits, getBalance, ensureSeeded } = await import("@/lib/credits");
      
      // Ensure target is seeded before modifying credits
      await ensureSeeded(targetUserId, Number(targetMeta?.credits || 0));
      
      let targetCurrentCredits = 0;
      try {
        targetCurrentCredits = await getBalance(targetUserId);
      } catch (e) {
        targetCurrentCredits = Number(targetMeta?.credits) || 0;
      }

      if (delta > 0) {
        // GIVING credits: operator must have enough
        if (inventory.credits < delta) {
          return NextResponse.json({ error: `Inventario insuficiente. Tienes ${inventory.credits} créditos, intentas dar ${delta}.` }, { status: 400 });
        }
        
        await earnCredits({
          userId: targetUserId,
          amount: delta,
          relatedId: user.id,
          note: `Asignado por Operador ${operatorMeta.affiliateCode}`
        });

        targetUpdate.credits = targetCurrentCredits + delta;
        operatorUpdate.operatorInventory = {
          ...inventory,
          credits: inventory.credits - delta
        };
        logType = "CREDITS";
        logDetails = `Operador ${operatorMeta.affiliateCode} entregó +${delta} créditos (Balance: ${targetCurrentCredits}→${targetCurrentCredits + delta})`;
      } else {
        // REMOVING credits: reintegrate to operator inventory
        const absAmount = Math.abs(delta);
        const actualRemoved = Math.min(absAmount, targetCurrentCredits);
        const newTargetCredits = targetCurrentCredits - actualRemoved;

        if (actualRemoved > 0) {
          await spendCredits({
            userId: targetUserId,
            amount: actualRemoved,
            relatedId: user.id,
            note: `Retirado por Operador ${operatorMeta.affiliateCode}`
          });
        }

        targetUpdate.credits = newTargetCredits;
        operatorUpdate.operatorInventory = {
          ...inventory,
          credits: inventory.credits + actualRemoved
        };
        logType = "CREDITS";
        logDetails = `Operador ${operatorMeta.affiliateCode} retiró -${actualRemoved} créditos (Balance: ${targetCurrentCredits}→${newTargetCredits})`;
      }
    }

    // Apply activity log to the target user
    if (logType) {
      const existingLogs = (targetMeta?.activityLogs as any[]) || [];
      const newLog = { type: logType, details: logDetails, timestamp: Date.now() };
      targetUpdate.activityLogs = [newLog, ...existingLogs].slice(0, 30);
    }

    // Atomic dual update: target user + operator inventory
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: targetUpdate
    });

    if (Object.keys(operatorUpdate).length > 0) {
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: operatorUpdate
      });
    }

    return NextResponse.json({
      success: true,
      updatedInventory: operatorUpdate.operatorInventory || inventory
    });

  } catch (error: any) {
    console.error("Error en operación del operador:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
