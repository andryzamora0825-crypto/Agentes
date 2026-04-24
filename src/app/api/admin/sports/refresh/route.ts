import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    // Validar que sea admin (asumiendo que andryzamora0825@gmail.com es el admin)
    const email = user?.emailAddresses[0]?.emailAddress;
    if (email !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    // Revalidar el tag global de partidos (Next.js 16 requiere un perfil de cacheLife)
    revalidateTag("sports-matches", "max");

    // Limpiar también la caché en memoria (Protección Anti-Ban)
    const globalStore = globalThis as any;
    if (globalStore._sportsCache) {
      globalStore._sportsCache = {};
    }

    // Limpiar caché en disco físico (si existe)
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const tmpDir = os.tmpdir();
      
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        if (file.startsWith('sports_cache_') && file.endsWith('.json')) {
          fs.unlinkSync(path.join(tmpDir, file));
        }
      }
    } catch (e) {
      console.error("[ADMIN_SPORTS_REFRESH] Error limpiando FS cache:", e);
    }

    return NextResponse.json({ success: true, message: "Caché de partidos revalidada con éxito." });
  } catch (error: any) {
    console.error("[ADMIN_SPORTS_REFRESH] Error:", error);
    return NextResponse.json({ error: error.message || "Error interno." }, { status: 500 });
  }
}
