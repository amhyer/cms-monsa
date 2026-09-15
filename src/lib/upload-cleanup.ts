/**
 * Pembersihan otomatis file upload lama (tabel UploadedFile).
 *
 * Latar belakang: di Vercel, upload disimpan di database (bytea Neon) karena
 * filesystem serverless ephemeral — lihat src/lib/file-storage.ts. Kuota
 * storage Neon gratis terbatas, jadi upload yang tidak lagi dipakai harus
 * dibersihkan berkala. Job ini dijalankan harian oleh Vercel Cron
 * (/api/cron/cleanup-uploads) dan idempotent — aman dipanggil kapan pun.
 *
 * Tradeoff: file dihapus berdasarkan umur (createdAt), bukan referensi.
 * URL /uploads/<filename> pada konten lama (berita, galeri, dokumen BOS,
 * dll.) akan 404 setelah file kedaluwarsa — default 90 hari cukup panjang
 * untuk konten yang masih relevan.
 */
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { logger } from "@/lib/logger";

/** Umur maksimum upload (hari) sebelum dihapus otomatis. */
export const DEFAULT_UPLOAD_RETENTION_DAYS = 90;

/**
 * Umur retensi upload dalam hari dari env UPLOAD_RETENTION_DAYS.
 * Kosong / tidak valid → default 90. Nilai <= 0 → cleanup nonaktif (0).
 * Catatan: env kosong ("") DIANGGAP tidak diset — jangan sampai
 * `Number("")` = 0 menonaktifkan cleanup secara diam-diam.
 */
export function uploadRetentionDays(): number {
  const raw = (process.env.UPLOAD_RETENTION_DAYS ?? "").trim();
  if (raw === "") return DEFAULT_UPLOAD_RETENTION_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_UPLOAD_RETENTION_DAYS;
  return Math.floor(Math.max(0, n));
}

/**
 * Titik potong waktu — file dengan `createdAt` sebelum cutoff dianggap lama.
 * Satu-satunya tempat yang menghitung cutoff; dipakai oleh cleanup dan
 * statistik (upload-stats) agar semantik retensi tidak terpecah.
 */
export function retentionCutoff(retentionDays: number, now = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export type UploadCleanupResult = {
  /** true bila cleanup dinonaktifkan lewat UPLOAD_RETENTION_DAYS <= 0. */
  disabled: boolean;
  retentionDays: number;
  deleted: number;
  /** Total ukuran file yang dihapus (bytes) — perkiraan storage yang dibebaskan. */
  freedBytes: number;
  cutoffAt: string | null;
};

/**
 * Hapus upload yang lebih tua dari retensi. Idempotent; memakai withDbRetry
 * karena cron ini sering jadi request pertama setelah cold-start Vercel
 * (pool Prisma bisa kehabisan koneksi saat Neon baru bangun).
 */
export async function cleanupOldUploads(now = new Date()): Promise<UploadCleanupResult> {
  const retentionDays = uploadRetentionDays();
  if (retentionDays <= 0) {
    return { disabled: true, retentionDays, deleted: 0, freedBytes: 0, cutoffAt: null };
  }

  const cutoffAt = retentionCutoff(retentionDays, now);
  const expired = await withDbRetry(() =>
    db.uploadedFile.findMany({
      where: { createdAt: { lt: cutoffAt } },
      select: { id: true, size: true },
    })
  );
  if (expired.length === 0) {
    return { disabled: false, retentionDays, deleted: 0, freedBytes: 0, cutoffAt: cutoffAt.toISOString() };
  }

  const freedBytes = expired.reduce((sum, r) => sum + r.size, 0);
  const deleted = await withDbRetry(() =>
    db.uploadedFile.deleteMany({ where: { createdAt: { lt: cutoffAt } } })
  );

  logger.info(
    { deleted: deleted.count, freedBytes, retentionDays },
    "[upload-cleanup] upload lama dihapus"
  );
  return {
    disabled: false,
    retentionDays,
    deleted: deleted.count,
    freedBytes,
    cutoffAt: cutoffAt.toISOString(),
  };
}