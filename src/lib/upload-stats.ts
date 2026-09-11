/**
 * Statistik pemakaian storage tabel UploadedFile — untuk memantau kuota
 * storage Neon (backend db di Vercel, lihat src/lib/file-storage.ts).
 *
 * Dipakai oleh route /api/storage-usage (dashboard admin) dan script
 * scripts/upload-storage-stats.ts (CLI/local/self-host).
 *
 * Selain jumlah/ukuran, modul ini melaporkan DAMPAK cleanup: dari file
 * kandidat hapus (lewat retensi), berapa yang masih direferensikan oleh
 * konten (berita, galeri, dokumen, dll.) — supaya admin tahu berapa banyak
 * yang akan rusak (404) jika cron cleanup-uploads berjalan.
 */
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { logger } from "@/lib/logger";
import { retentionCutoff, uploadRetentionDays } from "@/lib/upload-cleanup";

export type UploadMimeStat = {
  mimeType: string;
  count: number;
  bytes: number;
};

export type CleanupImpact = {
  /** Jumlah file kandidat yang MASIH direferensikan oleh ≥1 konten. */
  referencedCandidates: number;
  /** Jumlah file kandidat yang tidak direferensikan konten apa pun. */
  safeCandidates: number;
  /** Per jenis konten: berapa file kandidat BERBEDA yang direferensikan. */
  byEntity: Record<string, number>;
};

/** Status alert kuota terakhir (singleton tabel StorageAlertState). */
export type StorageAlertStateInfo = {
  /** true = pemakaian sedang di atas ambang (belum turun melewati hysteresis). */
  aboveThreshold: boolean;
  /** Waktu notifikasi terakhir terkirim — null bila belum pernah alert. */
  lastAlertedAt: string | null;
  /** Pemakaian persen saat alert terakhir dikirim. */
  lastUsagePercent: number | null;
  /** Waktu percobaan kirim terakhir (apa pun hasilnya) — null = belum pernah. */
  lastSendAt: string | null;
  /** Hasil kanal WhatsApp pada percobaan terakhir — null bila belum pernah. */
  lastChannelsWhatsapp: boolean | null;
  /** Hasil kanal Telegram pada percobaan terakhir — null bila belum pernah. */
  lastChannelsTelegram: boolean | null;
  /** Waktu terakhir jalur diuji manual (Uji Kirim Alert, sukses ≥1 kanal). */
  lastTestedAt: string | null;
  /** Percobaan uji manual terakhir (apa pun hasilnya) — null = belum pernah. */
  lastTestSendAt: string | null;
  /** Hasil kanal WhatsApp pada uji manual terakhir. */
  lastTestChannelsWhatsapp: boolean | null;
  /** Hasil kanal Telegram pada uji manual terakhir. */
  lastTestChannelsTelegram: boolean | null;
};

export type UploadStorageStats = {
  /** Jumlah file di tabel UploadedFile. */
  fileCount: number;
  /** Total ukuran seluruh file (bytes). */
  totalBytes: number;
  /** Rincian per mimeType, diurutkan dari yang terbesar. */
  byMimeType: UploadMimeStat[];
  /**
   * Kuota storage dari env NEON_STORAGE_QUOTA_MB (bytes) — null bila tidak
   * diset. Isi sesuai kuota paket Neon Anda (mis. 512 untuk free tier).
   */
  quotaBytes: number | null;
  /** Pemakaian kuota dalam persen (1 desimal) — null bila kuota tidak diset. */
  usagePercent: number | null;
  /**
   * Jumlah file yang sudah lewat retensi dan akan dihapus cron
   * cleanup-uploads berikutnya — null bila cleanup dinonaktifkan.
   */
  cleanupCandidates: number | null;
  /**
   * Dampak cleanup terhadap konten — null bila cleanup dinonaktifkan ATAU
   * pemindaian referensi gagal (statistik tetap dilaporkan).
   */
  impact: CleanupImpact | null;
  /**
   * Status alert kuota terakhir (dipakai cron /api/cron/storage-alert) —
   * null bila tabel StorageAlertState tidak terbaca atau belum pernah
   * diisi cron.
   */
  alertState: StorageAlertStateInfo | null;
};

/** Kuota storage (bytes) dari env NEON_STORAGE_QUOTA_MB. */
export function storageQuotaBytes(): number | null {
  const mb = Number(process.env.NEON_STORAGE_QUOTA_MB);
  if (!Number.isFinite(mb) || mb <= 0) return null;
  return Math.floor(mb * 1024 * 1024);
}

/**
 * Nama file (basename) dari URL apa pun. Query string/fragment dibuang agar
 * `/uploads/abc.jpg?v=1` cocok dengan filename `abc.jpg`. URL eksternal
 * tidak akan cocok dengan filename buatan route upload (timestamp-random).
 */
export function basenameOfUrl(url: string): string {
  return (url.split("?")[0].split("#")[0].split("/").pop() ?? "").trim();
}

/**
 * SQL STATIS (tanpa input user — aman dipakai `$queryRawUnsafe`): semua
 * kolom konten yang menyimpan URL upload. Daftar ini harus selaras dengan
 * prisma/schema.prisma; jika sebuah kolom diganti nama, pemindaian gagal
 * dengan aman (impact jadi null) dan statistik tetap jalan.
 */
const UPLOAD_REFERENCE_SQL = `
SELECT 'News' AS entity, "coverImage" AS url FROM "News" WHERE "coverImage" IS NOT NULL AND "coverImage" <> ''
UNION ALL SELECT 'GalleryItem', "url" FROM "GalleryItem" WHERE "url" IS NOT NULL AND "url" <> ''
UNION ALL SELECT 'GalleryItem', "thumbnail" FROM "GalleryItem" WHERE "thumbnail" IS NOT NULL AND "thumbnail" <> ''
UNION ALL SELECT 'Photo', "url" FROM "Photo" WHERE "url" IS NOT NULL AND "url" <> ''
UNION ALL SELECT 'Photo', "thumbnailUrl" FROM "Photo" WHERE "thumbnailUrl" IS NOT NULL AND "thumbnailUrl" <> ''
UNION ALL SELECT 'Album', "coverUrl" FROM "Album" WHERE "coverUrl" IS NOT NULL AND "coverUrl" <> ''
UNION ALL SELECT 'BosDocument', "fileUrl" FROM "BosDocument" WHERE "fileUrl" IS NOT NULL AND "fileUrl" <> ''
UNION ALL SELECT 'SchoolDocument', "fileUrl" FROM "SchoolDocument" WHERE "fileUrl" IS NOT NULL AND "fileUrl" <> ''
UNION ALL SELECT 'Document', "fileUrl" FROM "Document" WHERE "fileUrl" IS NOT NULL AND "fileUrl" <> ''
UNION ALL SELECT 'SchoolEvent', "imageUrl" FROM "SchoolEvent" WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> ''
UNION ALL SELECT 'SchoolAnnouncement', "imageUrl" FROM "SchoolAnnouncement" WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> ''
UNION ALL SELECT 'SchoolTimeline', "imageUrl" FROM "SchoolTimeline" WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> ''
UNION ALL SELECT 'StudentAchievement', "certificate" FROM "StudentAchievement" WHERE "certificate" IS NOT NULL AND "certificate" <> ''
UNION ALL SELECT 'SiteSetting', "logo" FROM "SiteSetting" WHERE "logo" IS NOT NULL AND "logo" <> ''
UNION ALL SELECT 'SiteSetting', "faviconUrl" FROM "SiteSetting" WHERE "faviconUrl" IS NOT NULL AND "faviconUrl" <> ''
UNION ALL SELECT 'SiteSetting', "principalPhoto" FROM "SiteSetting" WHERE "principalPhoto" IS NOT NULL AND "principalPhoto" <> ''
UNION ALL SELECT 'Teacher', "photo" FROM "Teacher" WHERE "photo" IS NOT NULL AND "photo" <> ''
UNION ALL SELECT 'Teacher', "cvUrl" FROM "Teacher" WHERE "cvUrl" IS NOT NULL AND "cvUrl" <> ''
UNION ALL SELECT 'Student', "photoUrl" FROM "Student" WHERE "photoUrl" IS NOT NULL AND "photoUrl" <> ''
UNION ALL SELECT 'OrgStructure', "photo" FROM "OrgStructure" WHERE "photo" IS NOT NULL AND "photo" <> ''
UNION ALL SELECT 'StarOfMonth', "photoUrl" FROM "StarOfMonth" WHERE "photoUrl" IS NOT NULL AND "photoUrl" <> ''
UNION ALL SELECT 'ParentTestimonial', "photoUrl" FROM "ParentTestimonial" WHERE "photoUrl" IS NOT NULL AND "photoUrl" <> ''
UNION ALL SELECT 'Enrollment', "birthCertUrl" FROM "Enrollment" WHERE "birthCertUrl" IS NOT NULL AND "birthCertUrl" <> ''
UNION ALL SELECT 'Enrollment', "diplomaUrl" FROM "Enrollment" WHERE "diplomaUrl" IS NOT NULL AND "diplomaUrl" <> ''
UNION ALL SELECT 'Enrollment', "photoUrl" FROM "Enrollment" WHERE "photoUrl" IS NOT NULL AND "photoUrl" <> ''
`;

/**
 * Hitung dampak cleanup: dari daftar file kandidat, berapa yang masih
 * direferensikan oleh konten. Fail-soft — bila SQL/DB bermasalah, kembalikan
 * null (statistik utama tetap dilaporkan oleh pemanggil).
 */
export async function scanUploadReferences(
  candidateFilenames: readonly string[]
): Promise<CleanupImpact | null> {
  if (candidateFilenames.length === 0) {
    return { referencedCandidates: 0, safeCandidates: 0, byEntity: {} };
  }
  const candidateSet = new Set(candidateFilenames);

  try {
    const rows = await withDbRetry(() =>
      db.$queryRawUnsafe<Array<{ entity: string; url: string }>>(UPLOAD_REFERENCE_SQL)
    );
    const referenced = new Set<string>();
    const perEntity = new Map<string, Set<string>>();
    for (const row of rows) {
      const base = basenameOfUrl(String(row.url ?? ""));
      if (!base || !candidateSet.has(base)) continue;
      referenced.add(base);
      const set = perEntity.get(row.entity) ?? new Set<string>();
      set.add(base);
      perEntity.set(row.entity, set);
    }
    return {
      referencedCandidates: referenced.size,
      safeCandidates: candidateFilenames.length - referenced.size,
      byEntity: Object.fromEntries(
        [...perEntity.entries()].map(([entity, files]) => [entity, files.size])
      ),
    };
  } catch (e) {
    logger.warn({ err: e }, "[upload-stats] scan referensi cleanup gagal — impact null");
    return null;
  }
}

/**
 * Baca status alert terakhir dari tabel StorageAlertState (singleton).
 * Fail-soft — bila tabel belum bermigrasi/DB bermasalah, kembalikan null
 * (laporan utama tetap terbit). Row belum ada (cron belum pernah jalan)
 * juga null. Diekspor juga untuk /api/notifications/health (kartu Alert
 * Admin di Pengaturan) — modul ini pemilik tunggal pembacaan tabel ini.
 */
export async function readStorageAlertState(): Promise<StorageAlertStateInfo | null> {
  try {
    const row = await withDbRetry(() =>
      db.storageAlertState.findUnique({ where: { id: "singleton" } })
    );
    if (!row) return null;
    return {
      aboveThreshold: row.aboveThreshold,
      lastAlertedAt: row.lastAlertedAt?.toISOString() ?? null,
      lastUsagePercent: row.lastUsagePercent,
      lastSendAt: row.lastSendAt?.toISOString() ?? null,
      lastChannelsWhatsapp: row.lastChannelsWhatsapp,
      lastChannelsTelegram: row.lastChannelsTelegram,
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastTestSendAt: row.lastTestSendAt?.toISOString() ?? null,
      lastTestChannelsWhatsapp: row.lastTestChannelsWhatsapp,
      lastTestChannelsTelegram: row.lastTestChannelsTelegram,
    };
  } catch (e) {
    logger.warn(
      { err: e },
      "[upload-stats] gagal membaca StorageAlertState — alertState null"
    );
    return null;
  }
}

/**
 * Baca pemakaian storage UploadedFile + dampak cleanup. Memakai withDbRetry
 * karena route ini sering jadi request pertama setelah cold-start Vercel.
 */
export async function getUploadStorageStats(now = new Date()): Promise<UploadStorageStats> {
  const [agg, byMime] = await Promise.all([
    withDbRetry(() =>
      db.uploadedFile.aggregate({ _count: { _all: true }, _sum: { size: true } })
    ),
    withDbRetry(() =>
      db.uploadedFile.groupBy({ by: ["mimeType"], _count: { _all: true }, _sum: { size: true } })
    ),
  ]);

  const totalBytes = agg._sum.size ?? 0;
  const quotaBytes = storageQuotaBytes();
  const usagePercent =
    quotaBytes !== null && quotaBytes > 0
      ? Math.round((totalBytes / quotaBytes) * 1000) / 10
      : null;

  const retentionDays = uploadRetentionDays();
  const [candidateRows, alertState] = await Promise.all([
    retentionDays > 0
      ? withDbRetry(() =>
          db.uploadedFile.findMany({
            where: { createdAt: { lt: retentionCutoff(retentionDays, now) } },
            select: { filename: true },
          })
        )
      : Promise.resolve([] as { filename: string }[]),
    readStorageAlertState(),
  ]);
  const candidateFilenames = candidateRows.map((r) => r.filename);

  return {
    fileCount: agg._count._all,
    totalBytes,
    byMimeType: byMime
      .map((r) => ({ mimeType: r.mimeType, count: r._count._all, bytes: r._sum.size ?? 0 }))
      .sort((a, b) => b.bytes - a.bytes),
    quotaBytes,
    usagePercent,
    cleanupCandidates: retentionDays > 0 ? candidateFilenames.length : null,
    impact:
      retentionDays > 0 ? await scanUploadReferences(candidateFilenames) : null,
    alertState,
  };
}