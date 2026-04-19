import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { createPost } from "@/lib/services/social-posts.service";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 120; // 2 min máximo para evitar Timeouts durante el Broadcasting

const NANO_BANANA_2 = "gemini-3.1-flash-image-preview"; // FIX: Modelo correcto de imágenes
const COST_PER_AGENCY = 150;

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ isModerator: false });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    
    // Si tiene agencias conectadas a él en Supabase
    const { data, error } = await supabase
      .from("social_settings")
      .select("id")
      .contains("moderators_list", [userEmail])
      .limit(1)
      .single();

    if (!error && data) {
      return NextResponse.json({ isModerator: true });
    }

    return NextResponse.json({ isModerator: false });
  } catch (error) {
    return NextResponse.json({ isModerator: false });
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado. Sistema bloqueado." }, { status: 401 });

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const body = await request.json();
    const { imagePrompt } = body;

    if (!imagePrompt) {
      return NextResponse.json({ error: "Falta la señal del Prompt." }, { status: 400 });
    }

    // 1. Encontrar a todos los administradores (agencias) que tienen a este moderador
    const { data: allSettings, error: fetchErr } = await supabase
      .from("social_settings")
      .select("*")
      .contains("moderators_list", [userEmail]);

    if (fetchErr) throw fetchErr;

    if (!allSettings || allSettings.length === 0) {
      return NextResponse.json({ error: "No tienes flujos de automatización configurados en tu cuenta." }, { status: 403 });
    }

    // 2. Configurar APIs
    if (!process.env.GEMINI_API_KEY || !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Faltan credenciales maestras del sistema." }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const client = await clerkClient();

    // 3. Procesar en Paralelo para cada Agencia para evitar Timeout
    const broadcastPromises = allSettings.map(async (adminSetting) => {
      let deducted = false;
      const adminId = adminSetting.user_id;

      try {
        // A. Consultar la cartera del Cliente Administrador (Clerk)
        const adminUser = await client.users.getUser(adminId);
        const adminCredits = Number(adminUser.publicMetadata?.credits || 0);
        const aiSettings: any = adminUser.publicMetadata?.aiSettings || {};

        if (adminCredits < COST_PER_AGENCY) {
          throw new Error(`Créditos insuficientes para el Admin ID: ${adminId}`);
        }

        // B. Rebanada de Créditos Defensiva (Pagar por adelantado)
        await client.users.updateUserMetadata(adminId, {
          publicMetadata: { credits: adminCredits - COST_PER_AGENCY },
        });
        deducted = true; // Dinero ya descontado

        // C. Construir el Prompt Individual de la Agencia
        let finalPrompt = imagePrompt;
        const contents: any[] = [];
        
        // Inyectar Personalidad de la Agencia si la tiene configurada
        if (aiSettings.logoUrl) {
          try {
            const logoRes = await fetch(aiSettings.logoUrl);
            if (!logoRes.ok) throw new Error("Error al descargar logo: HTTP " + logoRes.status);
            const arrayBuffer = await logoRes.arrayBuffer();
            const mimeType = logoRes.headers.get('content-type') || "image/png";
            
            // Verificación extra para evitar colapsar a Gemini con un logo que en realidad es HTML
            if (mimeType.includes("image")) {
              contents.push({
                inlineData: {
                  mimeType: mimeType,
                  data: Buffer.from(arrayBuffer).toString("base64"),
                },
              });
              finalPrompt += `\n[INSTRUCCIÓN VITAL]: Incluye de manera hiperrealista o natural este logotipo dentro de la composición gráfica.`;
            }
          } catch(e: any) { 
            console.warn("Error leyendo logo de la agencia para broadcast", e.message); 
          }
        }

        contents.unshift({ text: finalPrompt });

        // D. Generar con Gemini usando AbortController fuerte anti-timeout
        const abortController = new AbortController();
        const geminiTimeout = setTimeout(() => abortController.abort(), 60_000); // 60s
        let response;
        try {
          response = await ai.models.generateContent({
            model: NANO_BANANA_2,
            contents,
            config: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          });
        } finally {
          clearTimeout(geminiTimeout);
        }

        // E. Extraer Imagen
        let imageBase64 = null;
        let imageMimeType = "image/png";

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if ((part as any).inlineData) {
            imageBase64 = (part as any).inlineData.data;
            imageMimeType = (part as any).inlineData.mimeType || "image/png";
            break;
          }
        }

        if (!imageBase64) {
          throw new Error("El Modelo respondió con error de censura o fallo y no entregó una imagen.");
        }

        // F. Subir Imagen a Supabase (INMORTALIZAR)
        const imageBuffer = Buffer.from(imageBase64, "base64");
        const ext = imageMimeType.includes("jpeg") ? "jpg" : "png";
        const fileName = `broadcast_${adminId}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("ai-generations") // Bucket asumido de tu sistema
          .upload(fileName, imageBuffer, { contentType: imageMimeType });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("ai-generations")
          .getPublicUrl(fileName);
        const finalUrl = publicUrlData.publicUrl;

        // G. Redactar el Copy Perfectamente Adaptado
        const voice = adminSetting.brand_voice || "dinámico y persuasivo";
        const copyInstruction = `Eres social media manager experto. Escribe un copy extremadamente persuasivo pero corto para esta campaña usando un tono: "${voice}". 
No expliques nada, entrega sólo el copy final con 2-3 hashtags. Contexto de la imagen generada: "${imagePrompt}"`;

        const copyCompletion = await openai.chat.completions.create({
          messages: [{ role: "system", content: copyInstruction }],
          model: "gpt-4o-mini",
          temperature: 0.8,
          max_tokens: 300,
        });

        const generatedCaption = copyCompletion.choices[0]?.message?.content?.trim() || "¡Nueva imagen increíble!";

        // H. PUBLICAR A LA COLA
        await createPost({
          user_id: adminId, 
          caption: generatedCaption,
          image_url: finalUrl,
          image_prompt: imagePrompt,
          status: "approved", 
          platform: adminSetting.moderator_target_network || adminSetting.default_platform || "facebook"
        });

        return { success: true, adminId };

      } catch (err: any) {
        console.error(`[Falló Broadcast para ${adminId}]:`, err.message);

        // I. MECANISMO DE REEMBOLSO (SAFEGUARD DE CRÉDITOS)
        if (deducted) {
          try {
            const adminUserRefund = await client.users.getUser(adminId);
            const backCredits = Number(adminUserRefund.publicMetadata?.credits || 0) + COST_PER_AGENCY;
            await client.users.updateUserMetadata(adminId, {
              publicMetadata: { credits: backCredits },
            });
            console.log(`[REEMBOLSO EJECUTADO] Se devolvieron ${COST_PER_AGENCY} créditos al usuario ${adminId}.`);
          } catch(refundErr) {
             console.error("[¡ERROR CRÍTICO EN REEMBOLSO!]", refundErr);
          }
        }
        
        return { success: false, adminId, error: err.message };
      }
    });

    // 4. Ejecutar la ola simultánea
    const results = await Promise.allSettled(broadcastPromises);
    
    const succeeded = results.filter(r => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - succeeded;

    console.log(`[BROADCAST SUMMARY] Prompt: "${imagePrompt.slice(0,20)}..." | Éxito: ${succeeded} | Fallos (Reembolsados): ${failed}`);

    return NextResponse.json({ 
      success: true, 
      message: `El Broadcaster desplegó tu imagen a ${succeeded} agencias. Hubo ${failed} fallos recuperados.`,
      succeeded,
      failed
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error auto-broadcast masivo:", error);
    return NextResponse.json(
      { error: "Rastreamos un problema procesando el broadcaster masivo." },
      { status: 500 }
    );
  }
}
