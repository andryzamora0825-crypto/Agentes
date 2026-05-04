import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateCronAuth } from "@/lib/services/cron-auth.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Limpieza automática de caché:
// 1. Borra archivos de Storage en el bucket "ai-generations" cuyo registro en BD ya no existe (huérfanos por dbError o eliminaciones parciales).
// 2. Borra registros en BD de imágenes cuyo archivo ya no existe en Storage (referencias rotas).
// 3. Borra archivos generados con más de N días que NO tengan registro en BD.
// Nota: NO toca la carpeta agency-assets/ (logos oficiales y assets permanentes).

const ORPHAN_MAX_AGE_DAYS = 1; // archivos sin registro en BD que tengan más de 1 día → borrar
const PROTECTED_PREFIX = "agency-assets/"; // nunca tocar

async function listAllStorageFiles(): Promise<{ name: string; created_at?: string }[]> {
  const all: { name: string; created_at?: string }[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage
      .from("ai-generations")
      .list("", { limit, offset, sortBy: { column: "created_at", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const f of data) {
      if (!f.name) continue;
      if (f.name.startsWith(PROTECTED_PREFIX)) continue;
      // Si es carpeta (sin id), saltamos
      if ((f as any).id == null && (f as any).metadata == null) continue;
      all.push({ name: f.name, created_at: (f as any).created_at });
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

export async function GET(request: Request) {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const startedAt = Date.now();
  const stats = {
    storageFilesScanned: 0,
    dbRecordsScanned: 0,
    orphanFilesDeleted: 0,
    brokenRecordsDeleted: 0,
    errors: [] as string[],
  };

  try {
    const [storageFiles, { data: dbRecords, error: dbErr }] = await Promise.all([
      listAllStorageFiles().catch((e) => {
        stats.errors.push(`list storage: ${e.message}`);
        return [] as { name: string; created_at?: string }[];
      }),
      supabase.from("ai_images").select("id, image_url"),
    ]);

    if (dbErr) {
      stats.errors.push(`db select: ${dbErr.message}`);
    }

    stats.storageFilesScanned = storageFiles.length;
    stats.dbRecordsScanned = dbRecords?.length || 0;

    // Mapa de filenames presentes en BD
    const dbFilenames = new Set<string>();
    const recordsByFilename = new Map<string, string>(); // filename -> record id
    for (const r of dbRecords || []) {
      try {
        const u = new URL(r.image_url);
        const path = u.pathname.split("/object/public/ai-generations/")[1];
        if (path) {
          dbFilenames.add(path);
          recordsByFilename.set(path, r.id);
        }
      } catch {
        // URL inválida — registro roto, lo borramos abajo
        stats.brokenRecordsDeleted += 1;
        await supabase.from("ai_images").delete().eq("id", r.id).then(() => {}, () => {});
      }
    }

    // 1. Archivos huérfanos (en Storage pero NO en BD) más antiguos que ORPHAN_MAX_AGE_DAYS
    const cutoff = Date.now() - ORPHAN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const toDelete: string[] = [];
    for (const f of storageFiles) {
      if (dbFilenames.has(f.name)) continue;
      const created = f.created_at ? new Date(f.created_at).getTime() : 0;
      if (created && created < cutoff) {
        toDelete.push(f.name);
      }
    }

    // Borrar en lotes de 100
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error } = await supabase.storage.from("ai-generations").remove(batch);
      if (error) {
        stats.errors.push(`remove batch: ${error.message}`);
      } else {
        stats.orphanFilesDeleted += batch.length;
      }
    }

    // 2. Registros en BD cuyo archivo ya no existe (referencias rotas)
    const storageNames = new Set(storageFiles.map((f) => f.name));
    const brokenIds: string[] = [];
    for (const [filename, id] of recordsByFilename.entries()) {
      if (!storageNames.has(filename)) brokenIds.push(id);
    }
    for (let i = 0; i < brokenIds.length; i += 100) {
      const batch = brokenIds.slice(i, i + 100);
      const { error } = await supabase.from("ai_images").delete().in("id", batch);
      if (error) {
        stats.errors.push(`delete broken records: ${error.message}`);
      } else {
        stats.brokenRecordsDeleted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      ...stats,
    });
  } catch (e: any) {
    console.error("[CLEANUP-CACHE] error:", e);
    return NextResponse.json({
      success: false,
      error: e.message,
      durationMs: Date.now() - startedAt,
      ...stats,
    }, { status: 500 });
  }
}
