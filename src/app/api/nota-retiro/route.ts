import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { auth, currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString("base64");
    const mimeType = file.type;

    const openai = new OpenAI({ apiKey: (process.env.OPENAI_API_KEY || "").trim() });
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analiza esta imagen de una nota de retiro u operación. Extrae ÚNICAMENTE:
1. El número de "Nota de retiro" (campo "nota")
2. La "clave" o código secreto (campo "clave")

Devuelve SOLO un objeto JSON válido con exactamente estas dos claves: {"nota": "...", "clave": "..."}
No incluyas texto extra, markdown ni explicaciones. Si no encuentras algún valor, usa null.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0,
    });

    const aiContent = result.choices[0]?.message?.content || "{}";

    let parsed: { nota: string | null; clave: string | null } = { nota: null, clave: null };
    try {
      const cleaned = aiContent.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Error parsing AI response:", aiContent);
    }

    return NextResponse.json({ nota: parsed.nota, clave: parsed.clave });
  } catch (error: any) {
    console.error("Error en nota-retiro:", error);
    return NextResponse.json({ error: "Error interno al procesar la imagen." }, { status: 500 });
  }
}
