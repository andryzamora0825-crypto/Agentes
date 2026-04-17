import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    const email = user.primaryEmailAddress?.emailAddress;
    const formattedCode = code.toUpperCase().replace(/\s+/g, '');

    // 1. Obtener el código de la BD
    const { data: promoCode, error: fetchError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", formattedCode)
      .single();

    if (fetchError || !promoCode) {
      return NextResponse.json({ error: "Código inválido o inexistente." }, { status: 404 });
    }

    // 2. Verificar caducidad
    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return NextResponse.json({ error: "Este código ha caducado." }, { status: 400 });
    }

    // 3. Verificar stock
    if (promoCode.stock !== null && promoCode.used_count >= promoCode.stock) {
      return NextResponse.json({ error: "Este código ya se ha agotado." }, { status: 400 });
    }

    // 4. Verificar si el usuario ya lo usó
    const { data: redemption, error: checkError } = await supabase
      .from("promo_redemptions")
      .select("id")
      .eq("code_id", promoCode.id)
      .eq("user_email", email)
      .single();

    if (redemption) {
      return NextResponse.json({ error: "Ya has canjeado este código anteriormente." }, { status: 400 });
    }

    // 5. Aplicar la Recompensa en Clerk
    const client = await clerkClient();
    const currentMetadata = user.publicMetadata;
    
    let updateToApply: any = {};
    let successMessage = "";

    if (promoCode.reward_type === "credits") {
      const currentCredits = Number(currentMetadata?.credits) || 0;
      updateToApply.credits = currentCredits + promoCode.reward_value;
      successMessage = `¡Felicidades! Has canjeado ${promoCode.reward_value} créditos exitosamente.`;
    } 
    else if (promoCode.reward_type === "vip_days") {
      const currentPlan = currentMetadata?.plan || 'FREE';
      let currentExpiresAt = currentMetadata?.vipExpiresAt ? Number(currentMetadata.vipExpiresAt) : Date.now();
      
      // Si el plan estaba caducado, reiniciamos desde ahora
      if (currentPlan === 'FREE' || currentExpiresAt < Date.now()) {
        currentExpiresAt = Date.now();
      }

      // Sumar días (en milisegundos)
      const msToAdd = promoCode.reward_value * 24 * 60 * 60 * 1000;
      updateToApply.plan = 'VIP';
      updateToApply.vipExpiresAt = currentExpiresAt + msToAdd;
      successMessage = `¡Felicidades! Has activado ${promoCode.reward_value} días de Plan VIP.`;
    }
    else if (promoCode.reward_type === "combo") {
      // VIP days
      const currentPlan = currentMetadata?.plan || 'FREE';
      let currentExpiresAt = currentMetadata?.vipExpiresAt ? Number(currentMetadata.vipExpiresAt) : Date.now();
      if (currentPlan === 'FREE' || currentExpiresAt < Date.now()) {
        currentExpiresAt = Date.now();
      }
      const msToAdd = promoCode.reward_value * 24 * 60 * 60 * 1000;
      updateToApply.plan = 'VIP';
      updateToApply.vipExpiresAt = currentExpiresAt + msToAdd;

      // Credits
      const comboCredits = Number(promoCode.combo_credits) || 0;
      const currentCredits = Number(currentMetadata?.credits) || 0;
      updateToApply.credits = currentCredits + comboCredits;

      successMessage = `¡Felicidades! Has activado ${promoCode.reward_value} días VIP + ${comboCredits} créditos.`;
    }

    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...currentMetadata,
        ...updateToApply
      }
    });

    // 6. Registrar el canjeo para evitar múltiples usos
    await supabase
      .from("promo_redemptions")
      .insert({
        code_id: promoCode.id,
        user_email: email
      });

    // 7. Aumentar el contador de uso
    await supabase
      .from("promo_codes")
      .update({ used_count: promoCode.used_count + 1 })
      .eq("id", promoCode.id);

    return NextResponse.json({ success: true, message: successMessage });

  } catch (error: any) {
    console.error("Error canjeando código:", error);
    return NextResponse.json({ error: "Hubo un error del sistema al procesar el código." }, { status: 500 });
  }
}
