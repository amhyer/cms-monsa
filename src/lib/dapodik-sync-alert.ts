/**
 * Dapodik Sync Health — pencatatan run sinkronisasi + alert kegagalan/staleness.
 *
 * Dua fungsi publik (lihat docs/superpowers/specs/2026-10-04-dapodik-sync-health-design.md):
 *   - recordSyncRun(input) — dipanggil SEMUA jalur sync (manual, auto-scheduler,
 *     ingest jembatan, archive). Menulis DapodikSyncLog, memangkas lama,
 *     meng-update lastSyncAt/lastSyncBy di DapodikConfig saat sukses, dan
 *     mengirim alert WhatsApp/Telegram/Email saat gagal (dedupe: satu alert
 *     per periode kegagalan, reset saat sync sukses).
 *   - checkSyncFreshness() — dipakai cron harian /api/cron/dapodik-sync-alert.
 *     Menutup mode gagal senyap (PC sekolah mati / tunnel putus = tidak ada
 *     error di CMS, cuma data basi).
 *
 * Pola dedupe & state singleton dimirror dari src/lib/storage-alert.ts:
 * state tahan cold-start Vercel (bukan variabel in-memory), dan state disimpan
 * SETELAH kirim — bila update gagal, alert bisa terulang (duplikat ringan)
 * daripada hilang diam-diam.
 *
 * Environment:
 *   DAPODIK_SYNC_STALE_HOURS   — override ambang staleness (jam, > 0).
 *   DAPODIK_SYNC_ALERT_ENABLED — "0" mematikan alert (default aktif).
 */
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { logger } from "@/lib/logger";
import { notifyAdmin } from "@/lib/notifications";
import { describeIngestError } from "@/lib/dapodik-ingest-error";

// ---------------------------------------------------------------------------
// Konstanta & tipe
// ---------------------------------------------------------------------------

/** Riwayat sync yang disimpan — sisanya dihapus setiap insert. */
export const MAX_SYNC_LOG_ROWS = 200;
/** Ambang staleness untuk mode manual-only (tanpa auto-sync). */
export const MANUAL_ONLY_STALE_HOURS = 168;
/** Batas bawah ambang staleness mode auto (2 × interval, minimal ini). */
export const DEFAULT_AUTO_STALE_MIN_HOURS = 48;

export type SyncRunMode = "AUTO" | "MANUAL" | "INGEST" | "ARCHIVE";
export type SyncRunStatus = "OK" | "ERROR";

export interface SyncRunCounts {
  sekolah?: number;
  gtk?: number;
  rombel?: number;
  siswa?: number;
}

export interface SyncRunInput {
  mode: SyncRunMode;
  /** Untuk INGEST per-modul: sekolah | gtk | rombel | peserta_didik | archive. */
  dataType?: string;
  status: SyncRunStatus;
  /** userId, atau "bridge" / "scheduler" / "cron". */
  actor?: string;
  counts?: SyncRunCounts;
  durationMs?: number;
  /** Error mentah — disanitasi di sini sebelum masuk log/pesan. */
  error?: unknown;
}

export type FreshnessResult = {
  /** Alasan alert tidak diproses — null berarti cek berjalan penuh. */
  skipped: string | null;
  reason: "sync-error" | "stale" | null;
  notified: boolean;
  /** True bila state open di-reset karena kondisi sehat. */
  reset: boolean;
  thresholdHours: number | null;
  /** Umur data (jam) — null bila belum pernah sync sukses. */
  dataAgeHours: number | null;
  notifiedChannels: { whatsapp: boolean; telegram: boolean; email: boolean };
};

// ---------------------------------------------------------------------------
// Sanitasi & ambang
// ---------------------------------------------------------------------------

/**
 * Sanitasi error untuk log & pesan alert. Menerima Error mentah (via
 * describeIngestError — pesan operator aman / pesan generik untuk error
 * Prisma, pesan >400 char jatuh ke generik) ATAU string tersimpan
 * (autoSyncLastError di DB sudah berupa teks pesan). Selalu: redaksi defensif
 * connection string & token, lalu potong ke maxLen.
 */
export function sanitizeSyncError(err: unknown, maxLen = 500): string | null {
  if (err == null) return null;
  const message = typeof err === "string" ? err : describeIngestError(err).error;
  const redacted = message
    .replace(/postgres(ql)?:\/\/\S+/gi, "<redacted>")
    .replace(/\b(bearer|token|secret|password)\s+\S+/gi, "$1 <redacted>");
  return redacted.slice(0, maxLen);
}

/**
 * Ambang staleness dalam jam:
 *   1. env DAPODIK_SYNC_STALE_HOURS (angka > 0) menang;
 *   2. auto-sync aktif → max(2 × autoSyncIntervalHours, 48);
 *   3. mode manual-only → 168 (7 hari).
 */
export function stalenessThresholdHours(cfg: {
  autoSyncEnabled: boolean;
  autoSyncIntervalHours: number;
}): number {
  const raw = (process.env.DAPODIK_SYNC_STALE_HOURS ?? "").trim();
  if (raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (!cfg.autoSyncEnabled) return MANUAL_ONLY_STALE_HOURS;
  return Math.max(2 * cfg.autoSyncIntervalHours, DEFAULT_AUTO_STALE_MIN_HOURS);
}

// ---------------------------------------------------------------------------
// Pesan alert
// ---------------------------------------------------------------------------

function witaTime(now: Date): string {
  return now.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SYNC_HINT = [
  "Cek: PC sekolah menyala? Aplikasi Dapodik + Web Service aktif?",
  "Service cloudflared berjalan?",
].join(" ");

function modeLabel(mode: SyncRunMode, dataType?: string): string {
  const base =
    mode === "AUTO"
      ? "AUTO (scheduler)"
      : mode === "INGEST"
        ? "INGEST (jembatan)"
        : mode === "ARCHIVE"
          ? "ARCHIVE (arsip)"
          : "MANUAL (dashboard)";
  return dataType ? `${base} · ${dataType}` : base;
}

function buildErrorAlertMessage(opts: {
  mode: SyncRunMode;
  dataType?: string;
  error: string;
  now: Date;
}): string {
  return [
    "🚨 *Sync Dapodik GAGAL*",
    "",
    `Mode   : ${modeLabel(opts.mode, opts.dataType)}`,
    `Waktu  : ${witaTime(opts.now)} WITA`,
    `Error  : ${opts.error.slice(0, 300)}`,
    "",
    SYNC_HINT,
    "",
    "— CMS MONSA",
  ].join("\n");
}

function buildStaleAlertMessage(opts: {
  reason: "sync-error" | "stale";
  dataAgeHours: number | null;
  lastSyncAt: Date | null;
  thresholdHours: number;
  lastError: string | null;
  now: Date;
}): string {
  const head =
    opts.reason === "sync-error"
      ? "🚨 *Sync Dapodik GAGAL (terdeteksi cron)*"
      : "⚠️ *Data Dapodik BASI*";
  const umur =
    opts.dataAgeHours === null
      ? "belum pernah sync sukses"
      : `${Math.floor(opts.dataAgeHours)} hari · terakhir ${witaTime(opts.lastSyncAt ?? opts.now)} WITA`;
  const lines = [
    head,
    "",
    `Umur data : ${umur}`,
    `Ambang    : ${opts.thresholdHours} jam`,
  ];
  if (opts.lastError) lines.push(`Error     : ${opts.lastError.slice(0, 300)}`);
  lines.push("", SYNC_HINT, "", "— CMS MONSA");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// recordSyncRun — dipanggil semua jalur sync (sukses & gagal)
// ---------------------------------------------------------------------------

/**
 * Catat satu run sync. TIDAK PERNAH melempar — kegagalan pencatatan tidak
 * boleh menggagalkan sync yang sedang berjalan (semua di-wrap try/catch).
 */
export async function recordSyncRun(
  input: SyncRunInput,
  now: Date = new Date()
): Promise<void> {
  try {
    const error = sanitizeSyncError(input.error);

    await withDbRetry(() =>
      db.dapodikSyncLog.create({
        data: {
          mode: input.mode,
          dataType: input.dataType ?? null,
          status: input.status,
          actor: input.actor ?? null,
          sekolahCount: input.counts?.sekolah ?? 0,
          gtkCount: input.counts?.gtk ?? 0,
          rombelCount: input.counts?.rombel ?? 0,
          siswaCount: input.counts?.siswa ?? 0,
          durationMs: input.durationMs ?? null,
          error,
        },
      })
    );

    // Prune: sisakan MAX_SYNC_LOG_ROWS terbaru (updateMany/deleteMany murah,
    // tidak butuh cron terpisah).
    const staleRows = await withDbRetry(() =>
      db.dapodikSyncLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: MAX_SYNC_LOG_ROWS,
        take: 500,
        select: { id: true },
      })
    );
    if (staleRows.length > 0) {
      await withDbRetry(() =>
        db.dapodikSyncLog.deleteMany({
          where: { id: { in: staleRows.map((r) => r.id) } },
        })
      );
    }

    if (input.status === "OK") {
      // updateMany (bukan update) — tidak melempar bila config belum ada.
      await withDbRetry(() =>
        db.dapodikConfig.updateMany({
          where: { id: "singleton" },
          data: { lastSyncAt: now, lastSyncBy: input.actor ?? null },
        })
      );
      // Pulih → reset state alert (idempoten: hanya baris yang open).
      await withDbRetry(() =>
        db.dapodikSyncAlertState.updateMany({
          where: { id: "singleton" },
          data: { alertOpen: false, reason: null, detail: null },
        })
      );
      return;
    }

    // status ERROR — dedupe: kirim hanya bila state tertutup ATAU reason
    // berganti (mis. alert stale terlanjur terkirim lalu muncul error nyata).
    const state = await withDbRetry(() =>
      db.dapodikSyncAlertState.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", alertOpen: false },
        update: {},
      })
    );
    if (state.alertOpen && state.reason === "sync-error") {
      logger.warn(
        { mode: input.mode, dataType: input.dataType },
        "[dapodik-sync-alert] gagal berulang — alert sudah terkirim, tidak diulang"
      );
      return;
    }

    const message = buildErrorAlertMessage({
      mode: input.mode,
      dataType: input.dataType,
      error: error ?? "Gagal sinkronisasi Dapodik.",
      now,
    });
    const channels = await notifyAdmin(message);
    logger.info(
      { mode: input.mode, dataType: input.dataType, channels },
      "[dapodik-sync-alert] alert kegagalan terkirim"
    );
    // Simpan state SETELAH kirim (mirror storage-alert: duplikat ringan lebih
    // baik daripada alert hilang diam-diam).
    await withDbRetry(() =>
      db.dapodikSyncAlertState.update({
        where: { id: "singleton" },
        data: {
          alertOpen: true,
          reason: "sync-error",
          detail: (error ?? "Gagal sinkronisasi Dapodik.").slice(0, 300),
          lastAlertedAt: now,
        },
      })
    );
  } catch (e) {
    logger.error({ err: e }, "[dapodik-sync-alert] gagal mencatat run sync");
  }
}

// ---------------------------------------------------------------------------
// checkSyncFreshness — cron harian (backstop mode gagal senyap)
// ---------------------------------------------------------------------------

/**
 * Cek kesegaran data Dapodik + status error terakhir, dan kirim alert bila
 * perlu. Menutup mode gagal yang TIDAK meninggalkan error di CMS: PC sekolah
 * mati / Aplikasi Dapodik tertutup / service cloudflared berhenti — satu-
 * satunya gejalanya adalah lastSyncAt yang tidak pernah maju.
 *
 * Tabel kebenaran (spec):
 *   konfigurasi kosong / env off / alert sudah terkirim (dedupe) → tidak kirim;
 *   autoSyncLastStatus=ERROR tanpa sync sukses setelahnya → alert sync-error
 *     (backstop bila push langsung gagal terkirim);
 *   lastSyncAt melewati ambang → alert stale;
 *   sehat → reset state open (tanpa notifikasi).
 */
export async function checkSyncFreshness(
  now: Date = new Date()
): Promise<FreshnessResult> {
  const noop: FreshnessResult = {
    skipped: null,
    reason: null,
    notified: false,
    reset: false,
    thresholdHours: null,
    dataAgeHours: null,
    notifiedChannels: { whatsapp: false, telegram: false, email: false },
  };

  const cfg = await withDbRetry(() =>
    db.dapodikConfig.findUnique({ where: { id: "singleton" } })
  );
  if (!cfg || !cfg.npsn.trim() || !cfg.token.trim()) {
    return { ...noop, skipped: "no-config" };
  }

  if ((process.env.DAPODIK_SYNC_ALERT_ENABLED ?? "").trim() === "0") {
    return { ...noop, skipped: "alert-disabled" };
  }

  const state = await withDbRetry(() =>
    db.dapodikSyncAlertState.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", alertOpen: false },
      update: {},
    })
  );

  const thresholdHours = stalenessThresholdHours({
    autoSyncEnabled: cfg.autoSyncEnabled,
    autoSyncIntervalHours: cfg.autoSyncIntervalHours,
  });

  // Umur data: sejak sync sukses terakhir (lastSyncAt di-update recordSyncRun
  // saat OK — manual/auto/ingest apa pun). Belum pernah sync + auto-sync
  // aktif = stale (ada ekspektasi jadwal); mode manual-only tanpa sync = belum
  // ada ekspektasi → tidak dianggap basi.
  const dataAgeHours =
    cfg.lastSyncAt === null
      ? null
      : (now.getTime() - cfg.lastSyncAt.getTime()) / (60 * 60 * 1000);
  const isStale =
    cfg.lastSyncAt === null ? cfg.autoSyncEnabled : dataAgeHours! > thresholdHours;

  // Kegagalan auto yang belum pulih: status ERROR dan TIDAK ada sync sukses
  // setelahnya (sync sukses manapun menulis lastSyncAt yang lebih baru).
  const failureUnrecovered =
    cfg.autoSyncLastStatus === "ERROR" &&
    (cfg.lastSyncAt === null ||
      cfg.autoSyncLastRunAt === null ||
      cfg.lastSyncAt.getTime() < cfg.autoSyncLastRunAt.getTime());

  const healthy = !failureUnrecovered && !isStale;

  if (state.alertOpen && healthy) {
    // updateMany: idempoten (0 baris bila state sudah tertutup di antara cek).
    await withDbRetry(() =>
      db.dapodikSyncAlertState.updateMany({
        where: { id: "singleton" },
        data: { alertOpen: false, reason: null, detail: null },
      })
    );
    return { ...noop, reset: true, thresholdHours, dataAgeHours };
  }

  if (state.alertOpen || healthy) {
    // Sudah diberi tahu (dedupe) atau memang sehat — diam.
    return {
      ...noop,
      skipped: state.alertOpen ? "dedupe-open" : null,
      thresholdHours,
      dataAgeHours,
    };
  }

  const reason: "sync-error" | "stale" = failureUnrecovered ? "sync-error" : "stale";
  const message = buildStaleAlertMessage({
    reason,
    dataAgeHours,
    lastSyncAt: cfg.lastSyncAt,
    thresholdHours,
    lastError:
      reason === "sync-error"
        ? sanitizeSyncError(cfg.autoSyncLastError)
        : null,
    now,
  });
  const channels = await notifyAdmin(message);
  logger.info(
    { reason, dataAgeHours, thresholdHours, channels },
    "[dapodik-sync-alert] alert staleness/kegagalan terkirim (cron)"
  );
  await withDbRetry(() =>
    db.dapodikSyncAlertState.update({
      where: { id: "singleton" },
      data: {
        alertOpen: true,
        reason,
        detail:
          reason === "sync-error"
            ? (sanitizeSyncError(cfg.autoSyncLastError) ?? "sync error").slice(0, 300)
            : `data basi ${dataAgeHours === null ? "(belum pernah sync)" : `${Math.floor(dataAgeHours)} jam`}`,
        lastAlertedAt: now,
      },
    })
  );

  return {
    skipped: null,
    reason,
    notified: true,
    reset: false,
    thresholdHours,
    dataAgeHours,
    notifiedChannels: channels,
  };
}
