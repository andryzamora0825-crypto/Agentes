import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

// GET: List codes created by this operator
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const meta = user.publicMetadata as any;
    if (meta?.role !== "operator") {
      return NextResponse.json({ error: "No eres un operador autorizado." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, codes: data || [] });
  } catch (error: any) {
    console.error("Error obteniendo códigos del operador:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

// POST: Create a new code, deducting from operator inventory
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const meta = user.publicMetadata as any;
    if (meta?.role !== "operator") {
      return NextResponse.json({ error: "No eres un operador autorizado." }, { status: 403 });
    }

    const { code, reward_type, reward_value, combo_credits, stock } = await request.json();
    if (!code || !reward_type || !reward_value) {
      return NextResponse.json({ error: "Faltan parámetros requeridos." }, { status: 400 });
    }

    const client = await clerkClient();
    // Re-fetch fresh inventory
    const freshUser = await client.users.getUser(user.id);
    const inventory = (freshUser.publicMetadata as any)?.operatorInventory || { vipTokens: 0, credits: 0 };

    // Calculate cost based on reward type
    let vipCost = 0;
    let creditsCost = 0;
    const qty = Number(stock);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "El Stock (cantidad de usos máxima) es OBLIGATORIO para operadores." }, { status: 400 });
    }

    if (reward_type === "vip_days") {
      vipCost = qty;
    } else if (reward_type === "credits") {
      creditsCost = Number(reward_value) * qty;
    } else if (reward_type === "combo") {
      vipCost = qty;
      creditsCost = (Number(combo_credits) || 0) * qty;
    }

    // Validate inventory
    if (inventory.vipTokens < vipCost) {
      return NextResponse.json({ error: `Inventario insuficiente. Necesitas ${vipCost} Token(s) VIP, tienes ${inventory.vipTokens}.` }, { status: 400 });
    }
    if (inventory.credits < creditsCost) {
      return NextResponse.json({ error: `Inventario insuficiente. Necesitas ${creditsCost} Créditos, tienes ${inventory.credits}.` }, { status: 400 });
    }

    // Deduct from inventory
    const newInventory = {
      vipTokens: inventory.vipTokens - vipCost,
      credits: inventory.credits - creditsCost
    };

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const insertPayload: any = {
      code: code.toUpperCase().replace(/\s+/g, ''),
      reward_type,
      reward_value: Number(reward_value),
      stock: qty,
      expires_at: expiresAt.toISOString(),
      used_count: 0,
      created_by: user.id
    };

    if (reward_type === 'combo' && combo_credits) {
      insertPayload.combo_credits = Number(combo_credits);
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: "El código ya existe." }, { status: 400 });
      }
      throw error;
    }

    // Update operator inventory in Clerk
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: { operatorInventory: newInventory }
    });

    return NextResponse.json({ success: true, code: data, updatedInventory: newInventory });
  } catch (error: any) {
    console.error("Error creando código del operador:", error);
    return NextResponse.json({ error: "Error al crear el código." }, { status: 500 });
  }
}

// DELETE: Delete an unused code and refund inventory
export async function DELETE(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const meta = user.publicMetadata as any;
    if (meta?.role !== "operator") {
      return NextResponse.json({ error: "No eres un operador autorizado." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

    // Find the code and verify ownership
    const { data: codeData, error: fetchErr } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("id", id)
      .eq("created_by", user.id)
      .single();

    if (fetchErr || !codeData) {
      return NextResponse.json({ error: "Código no encontrado o no te pertenece." }, { status: 404 });
    }

    // Calculate refund (only for unused units)
    const unusedStock = codeData.stock ? Math.max(0, codeData.stock - codeData.used_count) : (codeData.used_count === 0 ? 1 : 0);

    let vipRefund = 0;
    let creditsRefund = 0;

    if (codeData.reward_type === "vip_days") {
      vipRefund = unusedStock;
    } else if (codeData.reward_type === "credits") {
      creditsRefund = codeData.reward_value * unusedStock;
    } else if (codeData.reward_type === "combo") {
      vipRefund = unusedStock;
      creditsRefund = (codeData.combo_credits || 0) * unusedStock;
    }

    // Delete the code
    const { error: delErr } = await supabase
      .from("promo_codes")
      .delete()
      .eq("id", id);

    if (delErr) throw delErr;

    // Refund to operator inventory
    if (vipRefund > 0 || creditsRefund > 0) {
      const client = await clerkClient();
      const freshUser = await client.users.getUser(user.id);
      const inventory = (freshUser.publicMetadata as any)?.operatorInventory || { vipTokens: 0, credits: 0 };

      await client.users.updateUserMetadata(user.id, {
        publicMetadata: {
          operatorInventory: {
            vipTokens: inventory.vipTokens + vipRefund,
            credits: inventory.credits + creditsRefund
          }
        }
      });
    }

    return NextResponse.json({ success: true, refunded: { vipTokens: vipRefund, credits: creditsRefund } });
  } catch (error: any) {
    console.error("Error eliminando código del operador:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
