import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { cleanupOldUploads } from "@/lib/upload-cleanup";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// Satu deleteMany + satu findMany — jauh di bawah 60s bahkan untuk ribuan file.
export const maxDuration = 60;

/**
 * Pembersihan harian upload lama (tabel UploadedFile — backend db di Vercel).
 * Dipanggil Vercel Cron (`vercel.json` → "30 18 * * *" = 02.30 WITA).
 *
 * Environment variables:
 *   CRON_SECRET — token otorisasi. Vercel Cron mengirim header
 *                 `Authorization: Bearer $CRON_SECRET` otomatis bila diset.
 *   UPLOAD_RETENTION_DAYS — (opsional) umur maksimum upload dalam hari.
 *                 Default 90; nilai <= 0 menonaktifkan cleanup.
 *
 * Test manual:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<project>.vercel.app/api/cron/cleanup-uploads
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error("[cron:cleanup-uploads] CRON_SECRET belum di-set — cleanup nonaktif.");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET belum dikonfigurasi." },
      { status: 503 }
    );
  }

  // Vercel Cron mengirim `Authorization: Bearer $CRON_SECRET` otomatis.
  const auth = req.headers.get("authorization");
  if (!bearerMatches(auth, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await cleanupOldUploads();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (e) {
    logger.error({ err: e }, "[cron:cleanup-uploads] Error");
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}