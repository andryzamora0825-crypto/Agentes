import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("audio") as Blob | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No se proporcionó audio" }, { status: 400 });
    }

    // OpenAI whisper expects a file object with a name and extension.
    // We convert the Blob to a File-like object and enforce the extension based on MIME type or default to webm
    const extension = file.type.includes('mp4') ? 'mp4' : 'webm';
    const audioFile = new File([file], `audio.${extension}`, { type: file.type || `audio/${extension}` });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "es", // Optimize for Spanish as per app context
    });

    return NextResponse.json({ success: true, text: transcription.text });
  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json({ success: false, error: "Error procesando el audio" }, { status: 500 });
  }
}
