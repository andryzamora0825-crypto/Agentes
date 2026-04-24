import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { currentUser } from "@clerk/nextjs";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Validar que sea admin (asumiendo que andryzamora0825@gmail.com es el admin)
    const email = user?.emailAddresses[0]?.emailAddress;
    if (email !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    // Revalidar el tag global de partidos
    revalidateTag("sports-matches");

    return NextResponse.json({ success: true, message: "Caché de partidos revalidada con éxito." });
  } catch (error: any) {
    console.error("[ADMIN_SPORTS_REFRESH] Error:", error);
    return NextResponse.json({ error: error.message || "Error interno." }, { status: 500 });
  }
}
