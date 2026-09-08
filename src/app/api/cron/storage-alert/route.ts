import { NextResponse } from "next/server";
import { checkStorageAlert } from "@/lib/storage-alert";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// 2 query agregat + 1 findMany + 1 upsert + kirim notifikasi (maks 2 kanal × 10s).
export const maxDuration = 60;

/**
 * Peringatan harian pemakaian storage upload (tabel UploadedFile — backend
 * db di Vercel). Dipanggil Vercel Cron (`vercel.json` → "0 19 * * *" =
 * 03.00 WITA, setelah cron cleanup-uploads). Mengirim notifikasi
 * WhatsApp/Telegram ke admin SEKALI saat pemakaian melewati ambang persen
 * dari kuota; state dedup tersimpan di tabel StorageAlertState.
 *
 * Environment variables:
 *   CRON_SECRET — token otorisasi. Vercel Cron mengirim header
 *                 `Authorization: Bearer $CRON_SECRET` otomatis bila diset.
 *   NEON_STORAGE_QUOTA_MB — kuota storage (MB); WAJIB untuk menghitung persen.
 *   STORAGE_ALERT_THRESHOLD_PCT — (opsional) ambang persen; default 80.
 *   STORAGE_ALERT_HYSTERESIS_PCT — (opsional) selisih reset; default 10.
 *   ADMIN_PHONE / FONNTE_TOKEN / TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID —
 *                 kanal notifikasi (semua opsional; yang diset akan dipakai).
 *
 * Test manual:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<project>.vercel.app/api/cron/storage-alert
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error("[cron:storage-alert] CRON_SECRET belum di-set — alert nonaktif.");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET belum dikonfigurasi." },
      { status: 503 }
    );
  }

  // Vercel Cron mengirim `Authorization: Bearer $CRON_SECRET` otomatis.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await checkStorageAlert();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (e) {
    logger.error({ err: e }, "[cron:storage-alert] Error");
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}