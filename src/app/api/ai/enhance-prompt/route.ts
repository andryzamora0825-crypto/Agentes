import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { prompt, keyword } = body;

    if (!prompt?.trim() || !keyword?.trim()) {
      return NextResponse.json({ error: "Faltan datos requeridos (prompt y palabra clave)" }, { status: 400 });
    }

    const aiSettings: any = user.publicMetadata?.aiSettings || {};
    
    const systemInstruction = `
Eres un experto director creativo y diseñador visual.
Tu objetivo es tomar una idea básica de un usuario y convertirla en un prompt maestro de generación de imágenes.

Contexto de la marca del usuario:
- Nombre: ${aiSettings.agencyName || 'Agencia'}
- Estilo: ${aiSettings.agencyDesc || 'Profesional'}
- Colores: ${aiSettings.primaryColor || ''}, ${aiSettings.secondaryColor || ''}

Palabras clave de contexto obligatorias a incluir/respetar: "${keyword}"

REGLAS PARA EL PROMPT MEJORADO:
1. El resultado DEBE estar en español.
2. Escribe un solo párrafo descriptivo, dinámico y muy visual.
3. Especifica iluminación, composición, ángulos y ambiente.
4. Solo devuelve el prompt final. NO incluyas introducciones, ni "Aquí tienes el prompt:", ni notas adicionales. Solo el texto listo para enviar al generador.
`;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Falta OPENAI_API_KEY en las variables de entorno.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `Prompt original del usuario a mejorar: "${prompt}"` }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Error en la API de OpenAI");
    }

    const enhancedPrompt = data.choices[0]?.message?.content?.trim();

    if (!enhancedPrompt) {
      throw new Error("Respuesta vacía de ChatGPT");
    }

    return NextResponse.json({ success: true, enhancedPrompt });

  } catch (error: any) {
    console.error("Error mejorando prompt con ChatGPT:", error);
    return NextResponse.json({ error: error.message || "Error al mejorar el prompt" }, { status: 500 });
  }
}
