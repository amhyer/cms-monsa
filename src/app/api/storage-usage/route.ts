import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getUploadStorageStats } from "@/lib/upload-stats";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Laporkan pemakaian storage tabel UploadedFile (backend db di Vercel) —
 * untuk memantau kuota storage Neon tanpa membuka console Neon.
 *
 * Hanya SUPER_ADMIN. Hasil: jumlah file, total byte, rincian per mimeType,
 * pemakaian kuota (bila NEON_STORAGE_QUOTA_MB diset), dan kandidat cleanup
 * (file yang akan dihapus cron cleanup-uploads berikutnya).
 */
export async function GET() {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const stats = await getUploadStorageStats();
    return NextResponse.json({ ok: true, ...stats, timestamp: new Date().toISOString() });
  } catch (e) {
    logger.error({ err: e }, "[storage-usage] gagal membaca statistik upload");
    return NextResponse.json(
      { ok: false, error: "Gagal membaca statistik upload." },
      { status: 502 }
    );
  }
}