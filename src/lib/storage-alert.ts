/**
 * Peringatan otomatis pemakaian storage upload (tabel UploadedFile).
 *
 * Dipicu harian oleh Vercel Cron /api/cron/storage-alert (vercel.json,
 * 03.00 WITA — setelah cron cleanup-uploads). Membaca statistik dari
 * getUploadStorageStats (kuota + persen pemakaian) dan mengirim notifikasi
 * WhatsApp/Telegram ke admin saat pemakaian MELEWATI ambang persen.
 *
 * Dedup: notifikasi dikirim SEKALI per persilangan (crossing), bukan setiap
 * cron selama pemakaian masih di atas ambang. State disimpan di tabel
 * StorageAlertState (singleton) — durabel lintas cold-start Vercel, tidak
 * seperti variabel in-memory yang hilang tiap instance baru.
 *
 * Hysteresis: pemakaian harus TURUN di bawah (ambang − hysteresis) sebelum
 * status "di atas ambang" di-reset — mencegah notifikasi berkedip saat
 * pemakaian naik-turun tipis di sekitar ambang.
 *
 * Environment:
 *   NEON_STORAGE_QUOTA_MB      — kuota (MB); wajib, tanpa ini alert tak jalan.
 *   STORAGE_ALERT_THRESHOLD_PCT— ambang persen (default 80; <= 0 nonaktif).
 *   STORAGE_ALERT_HYSTERESIS_PCT — selisih reset (default 10).
 *   ADMIN_PHONE / FONNTE_TOKEN / TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID —
 *                                kanal notifikasi (lihat src/lib/notifications.ts).
 */
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { logger } from "@/lib/logger";
import { getUploadStorageStats, storageQuotaBytes } from "@/lib/upload-stats";
import { notifyAdmin } from "@/lib/notifications";
import { getSiteBaseUrl } from "@/lib/site-url";

export const DEFAULT_ALERT_THRESHOLD_PCT = 80;
export const DEFAULT_ALERT_HYSTERESIS_PCT = 10;

/**
 * Ambang alert dalam persen dari env STORAGE_ALERT_THRESHOLD_PCT.
 * Kosong / tidak valid → default 80. Nilai <= 0 → alert nonaktif (0).
 */
export function storageAlertThresholdPct(): number {
  const raw = (process.env.STORAGE_ALERT_THRESHOLD_PCT ?? "").trim();
  if (raw === "") return DEFAULT_ALERT_THRESHOLD_PCT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_ALERT_THRESHOLD_PCT;
  return n <= 0 ? 0 : n;
}

/**
 * Hysteresis dalam persen dari env STORAGE_ALERT_HYSTERESIS_PCT.
 * Default 10. Dijepit ke [0, ambang − 1) — hysteresis >= ambang membuat
 * status tak pernah ter-reset (butuh 0% untuk memicu ulang).
 */
export function storageAlertHysteresisPct(thresholdPct: number): number {
  const raw = (process.env.STORAGE_ALERT_HYSTERESIS_PCT ?? "").trim();
  const n = raw === "" ? DEFAULT_ALERT_HYSTERESIS_PCT : Number(raw);
  const base = Number.isFinite(n) ? n : DEFAULT_ALERT_HYSTERESIS_PCT;
  if (thresholdPct <= 1) return 0;
  return Math.max(0, Math.min(base, thresholdPct - 1));
}

/** MB dengan 1 desimal (untuk pesan notifikasi). */
function mbLabel(bytes: number): string {
  return `${Math.round(bytes / 1024 / 102.4) / 10}`;
}

function buildAlertMessage(opts: {
  usagePercent: number;
  thresholdPct: number;
  quotaBytes: number;
  fileCount: number;
  totalBytes: number;
}): string {
  const detailUrl = `${getSiteBaseUrl()}/api/storage-usage`;
  return [
    "🚨 *PERINGATAN STORAGE UPLOAD*",
    "",
    `Pemakaian storage upload melewati ambang *${opts.thresholdPct}%* dari kuota.`,
    "",
    `• Pemakaian saat ini: *${opts.usagePercent}%* dari ${mbLabel(opts.quotaBytes)} MB`,
    `• Terpakai: ${mbLabel(opts.totalBytes)} MB`,
    `• File tersimpan: ${opts.fileCount}`,
    "",
    `Cek detail: ${detailUrl}`,
  ].join("\n");
}

export type StorageAlertResult = {
  /** Alasan alert tidak dijalankan — null berarti alert diproses. */
  skipped: string | null;
  thresholdPct: number | null;
  usagePercent: number | null;
  quotaBytes: number | null;
  /** Status state setelah cek: true = sedang di atas ambang. */
  aboveThreshold: boolean;
  /** Apakah notifikasi dikirim pada cek ini (persilangan baru). */
  notified: boolean;
  notifiedChannels: { whatsapp: boolean; telegram: boolean };
};

/**
 * Catat hasil uji manual jalur alert admin (tombol "Uji Kirim Alert").
 *
 * Dua catatan terpisah, paralel dengan catatan milik cron:
 *   - lastTestSendAt + lastTestChannels* — SETIAP percobaan uji, apa pun
 *     hasilnya (kartu kesehatan "Uji manual terakhir").
 *   - lastTestedAt — hanya saat minimal satu kanal benar-benar terkirim
 *     (penanda "Diuji: …" di panel Storage Upload).
 *
 * Fail-soft: kegagalan pencatatan tidak boleh menggagalkan response uji
 * kirim; juga saat tabel/kolom belum bermigrasi.
 */
export async function markStorageAlertTested(
  channels: { whatsapp: boolean; telegram: boolean },
  now = new Date()
): Promise<void> {
  const success = channels.whatsapp || channels.telegram;
  try {
    await withDbRetry(() =>
      db.storageAlertState.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          lastTestSendAt: now,
          lastTestChannelsWhatsapp: channels.whatsapp,
          lastTestChannelsTelegram: channels.telegram,
          ...(success ? { lastTestedAt: now } : {}),
        },
        update: {
          lastTestSendAt: now,
          lastTestChannelsWhatsapp: channels.whatsapp,
          lastTestChannelsTelegram: channels.telegram,
          ...(success ? { lastTestedAt: now } : {}),
        },
      })
    );
  } catch (e) {
    logger.warn(
      { err: e },
      "[storage-alert] gagal mencatat hasil uji manual alert"
    );
  }
}

/**
 * Cek pemakaian storage dan kirim notifikasi bila ambang baru dilampaui.
 * Idempotent per status: sekali per persilangan. Memakai withDbRetry untuk
 * pembacaan DB — cron ini sering jadi request pertama setelah cold-start.
 */
export async function checkStorageAlert(now = new Date()): Promise<StorageAlertResult> {
  const quotaBytes = storageQuotaBytes();
  if (quotaBytes === null) {
    logger.warn("[storage-alert] NEON_STORAGE_QUOTA_MB belum di-set — alert nonaktif.");
    return {
      skipped: "quota-not-configured",
      thresholdPct: null,
      usagePercent: null,
      quotaBytes: null,
      aboveThreshold: false,
      notified: false,
      notifiedChannels: { whatsapp: false, telegram: false },
    };
  }

  const thresholdPct = storageAlertThresholdPct();
  if (thresholdPct <= 0) {
    return {
      skipped: "alert-disabled",
      thresholdPct: 0,
      usagePercent: null,
      quotaBytes,
      aboveThreshold: false,
      notified: false,
      notifiedChannels: { whatsapp: false, telegram: false },
    };
  }

  const stats = await getUploadStorageStats(now);
  const usagePercent = stats.usagePercent;
  if (usagePercent === null) {
    return {
      skipped: "usage-unavailable",
      thresholdPct,
      usagePercent: null,
      quotaBytes,
      aboveThreshold: false,
      notified: false,
      notifiedChannels: { whatsapp: false, telegram: false },
    };
  }

  // Baca state (singleton) — upsert dengan update kosong = get-or-create.
  const state = await withDbRetry(() =>
    db.storageAlertState.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", aboveThreshold: false },
      update: {},
    })
  );

  const hysteresisPct = storageAlertHysteresisPct(thresholdPct);
  const shouldAlert = usagePercent >= thresholdPct && !state.aboveThreshold;
  const shouldReset = usagePercent < thresholdPct - hysteresisPct && state.aboveThreshold;

  if (shouldAlert) {
    const message = buildAlertMessage({
      usagePercent,
      thresholdPct,
      quotaBytes,
      fileCount: stats.fileCount,
      totalBytes: stats.totalBytes,
    });
    const channels = await notifyAdmin(message);
    logger.info(
      { usagePercent, thresholdPct, channels },
      "[storage-alert] Notifikasi terkirim (ambang dilampaui)"
    );
    // Simpan state SETELAH kirim: bila update gagal, cron berikutnya
    // mengirim ulang (duplikat ringan) — lebih baik daripada alert yang
    // hilang diam-diam karena state tersimpan padahal pesan gagal.
    // Attempt gagal (semua kanal false) pun dicatat — kartu kesehatan
    // "Alert Admin" di Pengaturan perlu melihat percobaan yang gagal.
    try {
      await withDbRetry(() =>
        db.storageAlertState.update({
          where: { id: "singleton" },
          data: {
            aboveThreshold: true,
            lastAlertedAt: now,
            lastUsagePercent: usagePercent,
            lastSendAt: now,
            lastChannelsWhatsapp: channels.whatsapp,
            lastChannelsTelegram: channels.telegram,
          },
        })
      );
    } catch (e) {
      logger.warn({ err: e }, "[storage-alert] Gagal menyimpan state — alert bisa terulang");
    }
    return {
      skipped: null,
      thresholdPct,
      usagePercent,
      quotaBytes,
      aboveThreshold: true,
      notified: true,
      notifiedChannels: channels,
    };
  }

  if (shouldReset) {
    try {
      await withDbRetry(() =>
        db.storageAlertState.update({
          where: { id: "singleton" },
          data: { aboveThreshold: false },
        })
      );
    } catch (e) {
      logger.warn({ err: e }, "[storage-alert] Gagal me-reset state");
    }
    return {
      skipped: null,
      thresholdPct,
      usagePercent,
      quotaBytes,
      aboveThreshold: false,
      notified: false,
      notifiedChannels: { whatsapp: false, telegram: false },
    };
  }

  // Masih di atas ambang (sudah diberi tahu) atau di pita hysteresis — diam.
  return {
    skipped: null,
    thresholdPct,
    usagePercent,
    quotaBytes,
    aboveThreshold: state.aboveThreshold,
    notified: false,
    notifiedChannels: { whatsapp: false, telegram: false },
  };
}