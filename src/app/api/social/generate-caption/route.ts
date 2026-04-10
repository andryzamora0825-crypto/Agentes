import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { logSocialAction } from "@/lib/utils/logger";
import OpenAI from "openai";

export const maxDuration = 60; // 1 min timeout

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Validar autorización básica
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { imageUrl, platform = "facebook", customTemplate } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "Se requiere una imagen para analizar" }, { status: 400 });
    }

    await logSocialAction("generate_caption_start", { platform }, null, user.id);

    const platformInstructions: Record<string, string> = {
      facebook: "para Facebook. Usa un tono conversacional, incluye emojis relevantes, y mantén el texto entre 150-300 caracteres. Agrega un llamado a la acción (CTA) discreto.",
      instagram: "para Instagram. Crea un texto visual y aspiracional, emojis fluidos, y añade 5-10 hashtags relevantes al final. Mantén entre 150-400 caracteres.",
      both: "que funcione perfecto tanto para Facebook como Instagram. Tono profesional pero dinámico, añade emojis y termina con 3-5 hashtags estratégicos.",
    };

    // Construimos el system prompt basado en la configuración
    const aiSettings = user.publicMetadata?.aiSettings as any;
    const brandVoice = aiSettings?.agencyDesc || "profesional y persuasivo";
    const agencyName = aiSettings?.agencyName || "nuestra agencia";

    const systemPrompt = customTemplate || `Eres un experto en Social Media Marketing y Copywriting para la empresa "${agencyName}".
Tu tono de marca debe ser: ${brandVoice}.
Analiza la siguiente imagen y genera SOLO el texto (caption) que acompañará dicha imagen ${platformInstructions[platform] || platformInstructions.facebook}.

REGLAS:
- Extrae el contexto principal de la imagen (de qué trata visualmente, producto, paisaje, anuncio, etc) para basar tu texto.
- NO incluyas textos como "Caption:", "Aquí tienes el texto:" ni comillas alrededor.
- El texto debe entregarse 100% puro y listo para publicarse.`;

    // Usamos ChatGPT 4o-mini con capacidad de Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analiza esta imagen y crea el caption."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "auto"
              }
            }
          ]
        }
      ],
      max_tokens: 400,
      temperature: 0.7
    });

    const generatedCaption = response.choices[0]?.message?.content?.trim();

    if (!generatedCaption) {
      throw new Error("ChatGPT no devolvió ningún texto.");
    }

    await logSocialAction("generate_caption_success", { preview: generatedCaption.slice(0, 50) }, null, user.id);

    return NextResponse.json({
      success: true,
      caption: generatedCaption,
    });

  } catch (error: any) {
    console.error("[SOCIAL] Error generando caption con ChatGPT Vision:", error?.message || error);
    await logSocialAction("error", { 
      endpoint: "generate-caption", 
      error: error?.message || "Unknown error" 
    });
    
    return NextResponse.json(
      { error: error?.message || "Error al analizar imagen con ChatGPT." },
      { status: 500 }
    );
  }
}
