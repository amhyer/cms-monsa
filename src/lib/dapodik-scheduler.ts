/**
 * Sinkronisasi Dapodik otomatis (jadwal berkala).
 *
 * Scheduler berjalan di dalam proses server (via src/instrumentation.ts) dan
 * mengecek setiap menit apakah sudah waktunya menarik data Dapodik sesuai
 * interval yang dikonfigurasi (autoSyncIntervalHours). Berjalan tanpa perlu
 * klik manual di dashboard.
 *
 * Catatan: ini butuh proses server tetap hidup (self-hosted). Kalau server
 * mati saat jadwal tiba, sinkronisasi akan berjalan pada tick berikutnya
 * setelah server kembali menyala (interval dihitung sejak sync terakhir).
 */
import { db } from "@/lib/db";
import { runSync } from "@/lib/dapodik-sync";
import { logger } from "@/lib/logger";

// Rentang interval yang diizinkan (jam).
export const MIN_INTERVAL_HOURS = 1;
export const MAX_INTERVAL_HOURS = 24 * 30; // 30 hari
export const DEFAULT_INTERVAL_HOURS = 24;

const TICK_MS = 60_000; // cek jadwal setiap 1 menit
const FIRST_TICK_DELAY_MS = 30_000; // tunggu server settle sebelum cek pertama

// ---------------------------------------------------------------------------
// Helper murni (di-unit-test tanpa DB)
// ---------------------------------------------------------------------------

/** Bulatkan + jepit interval ke rentang yang diizinkan. */
export function sanitizeIntervalHours(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL_HOURS;
  return Math.min(MAX_INTERVAL_HOURS, Math.max(MIN_INTERVAL_HOURS, Math.round(value)));
}

/**
 * Apakah sudah waktunya auto-sync? Ya jika: diaktifkan DAN interval sejak
 * sinkronisasi terakhir (data apa pun, manual/otomatis) sudah lewat — atau
 * belum pernah sync sama sekali.
 */
export function isAutoSyncDue(opts: {
  enabled: boolean;
  lastSyncAt: Date | null;
  intervalHours: number;
  now?: Date;
}): boolean {
  if (!opts.enabled) return false;
  const now = opts.now ?? new Date();
  if (!opts.lastSyncAt) return true;
  const intervalMs = sanitizeIntervalHours(opts.intervalHours) * 60 * 60 * 1000;
  return now.getTime() - opts.lastSyncAt.getTime() >= intervalMs;
}

// ---------------------------------------------------------------------------
// Status & pengaturan (dipakai API + UI)
// ---------------------------------------------------------------------------

export type AutoSyncStatus = {
  enabled: boolean;
  intervalHours: number;
  lastSyncAt: Date | null;
  lastSyncBy: string | null;
  autoSyncLastRunAt: Date | null;
  autoSyncLastStatus: "OK" | "ERROR" | null;
  autoSyncLastError: string | null;
  nextRunAt: Date | null;
};

/**
 * Titik acuan jadwal = sinkronisasi TERAKHIR (sukses atau percobaan otomatis).
 * Dipakai agar kegagalan tidak memicu retry tiap menit — percobaan berikutnya
 * baru dijadwalkan satu interval penuh setelah upaya terakhir.
 */
export function scheduleBase(cfg: {
  lastSyncAt: Date | null;
  autoSyncLastRunAt: Date | null;
}): Date | null {
  const a = cfg.lastSyncAt?.getTime() ?? 0;
  const b = cfg.autoSyncLastRunAt?.getTime() ?? 0;
  if (!a && !b) return null;
  return new Date(Math.max(a, b));
}

function toStatus(cfg: {
  autoSyncEnabled: boolean;
  autoSyncIntervalHours: number;
  lastSyncAt: Date | null;
  lastSyncBy: string | null;
  autoSyncLastRunAt: Date | null;
  autoSyncLastStatus: string | null;
  autoSyncLastError: string | null;
}): AutoSyncStatus {
  const intervalMs = sanitizeIntervalHours(cfg.autoSyncIntervalHours) * 60 * 60 * 1000;
  const base = scheduleBase(cfg);
  return {
    enabled: cfg.autoSyncEnabled,
    intervalHours: cfg.autoSyncIntervalHours,
    lastSyncAt: cfg.lastSyncAt,
    lastSyncBy: cfg.lastSyncBy,
    autoSyncLastRunAt: cfg.autoSyncLastRunAt,
    autoSyncLastStatus: cfg.autoSyncLastStatus === "OK" ? "OK" : cfg.autoSyncLastStatus === "ERROR" ? "ERROR" : null,
    autoSyncLastError: cfg.autoSyncLastError,
    nextRunAt: cfg.autoSyncEnabled && base ? new Date(base.getTime() + intervalMs) : null,
  };
}

const EMPTY_STATUS: AutoSyncStatus = {
  enabled: false,
  intervalHours: DEFAULT_INTERVAL_HOURS,
  lastSyncAt: null,
  lastSyncBy: null,
  autoSyncLastRunAt: null,
  autoSyncLastStatus: null,
  autoSyncLastError: null,
  nextRunAt: null,
};

/** Baca status auto-sync (konfigurasi default bila belum pernah disimpan). */
export async function getAutoSyncStatus(): Promise<AutoSyncStatus> {
  const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!cfg) return EMPTY_STATUS;
  return toStatus(cfg);
}

/** Simpan pengaturan auto-sync. Meng-merge ke config singleton yang ada. */
export async function setAutoSyncSettings(opts: {
  enabled: boolean;
  intervalHours: number;
}): Promise<AutoSyncStatus> {
  const intervalHours = sanitizeIntervalHours(opts.intervalHours);
  await db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      npsn: "",
      token: "",
      host: "localhost",
      port: 5774,
      protocol: "http",
      autoSyncEnabled: opts.enabled,
      autoSyncIntervalHours: intervalHours,
    },
    update: {
      autoSyncEnabled: opts.enabled,
      autoSyncIntervalHours: intervalHours,
    },
  });
  return getAutoSyncStatus();
}

// ---------------------------------------------------------------------------
// Scheduler (satu instance per proses server)
// ---------------------------------------------------------------------------

type SchedulerState = {
  started: boolean;
  running: boolean;
  timer: ReturnType<typeof setInterval> | null;
};

const g = globalThis as unknown as { __dapodikScheduler?: SchedulerState };

function schedulerState(): SchedulerState {
  if (!g.__dapodikScheduler) {
    g.__dapodikScheduler = { started: false, running: false, timer: null };
  }
  return g.__dapodikScheduler;
}

async function tick() {
  const st = schedulerState();
  if (st.running) return; // masih ada sinkronisasi berjalan — jangan dobel
  st.running = true;
  try {
    const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
    // Hanya jalan kalau: ada config, auto-sync aktif, dan kredensial terisi.
    if (!cfg || !cfg.autoSyncEnabled || !cfg.npsn.trim() || !cfg.token.trim()) return;
    // Acuan jadwal = sync terakhir sukses ATAU percobaan terakhir (sukses/gagal),
    // supaya kegagalan tidak menimbulkan retry tiap menit.
    const base = scheduleBase(cfg);
    if (
      !isAutoSyncDue({
        enabled: true,
        lastSyncAt: base,
        intervalHours: cfg.autoSyncIntervalHours,
      })
    ) {
      return; // belum waktunya
    }

    logger.info("[dapodik-auto-sync] mulai menarik data…");
    try {
      const result = await runSync("commit");
      const c = result.siswa;
      const g = result.gtk;
      const r = result.rombel;
      logger.info(
        { siswa: `${c.updated}+${c.created} (${c.errors} err)`, guru: `${g.updated}+${g.created} (${g.errors} err)`, rombel: `${r.updated}+${r.created} (${r.errors} err)` },
        "[dapodik-auto-sync] selesai"
      );
      await db.dapodikConfig.update({
        where: { id: "singleton" },
        data: { autoSyncLastRunAt: new Date(), autoSyncLastStatus: "OK", autoSyncLastError: null },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal sinkronisasi otomatis";
      logger.error({ message }, "[dapodik-auto-sync] GAGAL");
      await db.dapodikConfig
        .update({
          where: { id: "singleton" },
          data: { autoSyncLastRunAt: new Date(), autoSyncLastStatus: "ERROR", autoSyncLastError: message },
        })
        .catch((e) => {
          logger.error({ err: e }, "[dapodik-auto-sync] Failed to persist sync status");
        });
    }
  } finally {
    st.running = false;
  }
}

/**
 * Mulai scheduler. Idempotent: dipanggil dari instrumentation register()
 * yang bisa terpanggil berulang (dev HMR) — hanya satu timer per proses.
 */
export function startDapodikScheduler(): void {
  const st = schedulerState();
  if (st.started) return;
  st.started = true;

  setTimeout(() => {
    tick().catch((e) => { logger.error({ err: e }, "[dapodik-scheduler] Initial tick failed"); });
    st.timer = setInterval(() => {
      tick().catch((e) => { logger.error({ err: e }, "[dapodik-scheduler] Scheduled tick failed"); });
    }, TICK_MS);
  }, FIRST_TICK_DELAY_MS);
}

