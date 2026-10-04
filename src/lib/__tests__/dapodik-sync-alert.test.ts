import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    dapodikSyncLog: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
    },
    dapodikConfig: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    dapodikSyncAlertState: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  notifyAdmin: vi.fn(() =>
    Promise.resolve({ whatsapp: true, telegram: true, email: true })
  ),
}));

import { db } from "@/lib/db";
import { notifyAdmin } from "@/lib/notifications";
import {
  recordSyncRun,
  checkSyncFreshness,
  stalenessThresholdHours,
  sanitizeSyncError,
} from "@/lib/dapodik-sync-alert";

const logCreate = db.dapodikSyncLog.create as ReturnType<typeof vi.fn>;
const logFindMany = db.dapodikSyncLog.findMany as ReturnType<typeof vi.fn>;
const logDeleteMany = db.dapodikSyncLog.deleteMany as ReturnType<typeof vi.fn>;
const cfgUpdateMany = db.dapodikConfig.updateMany as ReturnType<typeof vi.fn>;
const cfgFindUnique = db.dapodikConfig.findUnique as ReturnType<typeof vi.fn>;
const stateUpsert = db.dapodikSyncAlertState.upsert as ReturnType<typeof vi.fn>;
const stateUpdate = db.dapodikSyncAlertState.update as ReturnType<typeof vi.fn>;
const stateUpdateMany = db.dapodikSyncAlertState
  .updateMany as ReturnType<typeof vi.fn>;
const notify = notifyAdmin as ReturnType<typeof vi.fn>;

const HOUR = 60 * 60 * 1000;

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

const CLOSED_STATE = { alertOpen: false, reason: null, detail: null };
const OPEN_SYNC_ERROR = { alertOpen: true, reason: "sync-error", detail: "gagal" };
const OPEN_STALE = { alertOpen: true, reason: "stale", detail: "basi" };

function stubConfig(cfg: Record<string, unknown> | null) {
  cfgFindUnique.mockResolvedValue(cfg);
}

function stubState(state: Record<string, unknown>) {
  stateUpsert.mockResolvedValue(state);
  stateUpdate.mockResolvedValue(state);
}

const HEALTHY_CFG = {
  id: "singleton",
  npsn: "40313912",
  token: "token-rahasia",
  autoSyncEnabled: true,
  autoSyncIntervalHours: 24,
  autoSyncLastStatus: "OK",
  autoSyncLastError: null,
  lastSyncAt: new Date(Date.now() - 1 * HOUR),
  autoSyncLastRunAt: new Date(Date.now() - 1 * HOUR),
};

beforeEach(() => {
  logCreate.mockReset();
  logCreate.mockResolvedValue({});
  logFindMany.mockReset();
  logFindMany.mockResolvedValue([]);
  logDeleteMany.mockReset();
  logDeleteMany.mockResolvedValue({ count: 0 });
  cfgUpdateMany.mockReset();
  cfgUpdateMany.mockResolvedValue({ count: 1 });
  cfgFindUnique.mockReset();
  cfgFindUnique.mockResolvedValue(null);
  stateUpsert.mockReset();
  stateUpsert.mockResolvedValue({ ...CLOSED_STATE });
  stateUpdate.mockReset();
  stateUpdate.mockResolvedValue({ ...CLOSED_STATE });
  stateUpdateMany.mockReset();
  stateUpdateMany.mockResolvedValue({ count: 1 });
  notify.mockReset();
  notify.mockResolvedValue({ whatsapp: true, telegram: true, email: true });
});

afterEach(() => {
  setEnv("DAPODIK_SYNC_STALE_HOURS", undefined);
  setEnv("DAPODIK_SYNC_ALERT_ENABLED", undefined);
});

describe("stalenessThresholdHours", () => {
  it("env override valid menang", () => {
    setEnv("DAPODIK_SYNC_STALE_HOURS", "72");
    expect(
      stalenessThresholdHours({ autoSyncEnabled: true, autoSyncIntervalHours: 24 })
    ).toBe(72);
  });

  it("env override tidak valid → fallback ke aturan interval", () => {
    setEnv("DAPODIK_SYNC_STALE_HOURS", "-1");
    expect(
      stalenessThresholdHours({ autoSyncEnabled: true, autoSyncIntervalHours: 12 })
    ).toBe(48);
    setEnv("DAPODIK_SYNC_STALE_HOURS", "abc");
    expect(
      stalenessThresholdHours({ autoSyncEnabled: true, autoSyncIntervalHours: 30 })
    ).toBe(60);
  });

  it("auto-sync aktif → max(2 × interval, 48)", () => {
    expect(
      stalenessThresholdHours({ autoSyncEnabled: true, autoSyncIntervalHours: 24 })
    ).toBe(48);
    expect(
      stalenessThresholdHours({ autoSyncEnabled: true, autoSyncIntervalHours: 12 })
    ).toBe(48);
    expect(
      stalenessThresholdHours({ autoSyncEnabled: true, autoSyncIntervalHours: 30 })
    ).toBe(60);
  });

  it("mode manual-only → 168 jam (7 hari)", () => {
    expect(
      stalenessThresholdHours({ autoSyncEnabled: false, autoSyncIntervalHours: 24 })
    ).toBe(168);
  });
});

describe("sanitizeSyncError", () => {
  it("connection string disanitasi", () => {
    const out = sanitizeSyncError(
      new Error("gagal koneksi ke postgresql://mons:mons@localhost:5432/db")
    );
    expect(out).not.toContain("mons@localhost");
    expect(out).toContain("<redacted>");
  });

  it("token/bearer disanitasi", () => {
    const out = sanitizeSyncError(
      new Error("auth gagal dengan Bearer abc123secretkey")
    );
    expect(out).not.toContain("abc123secretkey");
  });

  it("pesan >400 char → diganti pesan generik (bukan pass-through penuh)", () => {
    const out = sanitizeSyncError(new Error("x".repeat(800)));
    expect(out).toBe("Gagal memproses data Dapodik.");
  });

  it("pesan ≤400 char tanpa newline → dipertahankan", () => {
    const msg = "Tarik data dari server Dapodik gagal: koneksi ditolak";
    expect(sanitizeSyncError(new Error(msg))).toBe(msg);
  });

  it("input null/undefined → null", () => {
    expect(sanitizeSyncError(undefined)).toBeNull();
  });
});

describe("recordSyncRun", () => {
  it("status OK → log dibuat, lastSyncAt & lastSyncBy diperbarui", async () => {
    await recordSyncRun({
      mode: "MANUAL",
      status: "OK",
      actor: "user-1",
      counts: { siswa: 12, gtk: 3 },
      durationMs: 2500,
    });
    expect(logCreate).toHaveBeenCalledTimes(1);
    const data = logCreate.mock.calls[0][0].data;
    expect(data.mode).toBe("MANUAL");
    expect(data.status).toBe("OK");
    expect(data.siswaCount).toBe(12);
    expect(data.durationMs).toBe(2500);
    expect(cfgUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "singleton" },
        data: expect.objectContaining({ lastSyncBy: "user-1" }),
      })
    );
    expect(cfgUpdateMany.mock.calls[0][0].data.lastSyncAt).toBeInstanceOf(Date);
  });

  it("prune: baris di luar 200 terakhir dihapus", async () => {
    logFindMany.mockResolvedValue([{ id: "old-1" }, { id: "old-2" }]);
    await recordSyncRun({ mode: "AUTO", status: "OK" });
    expect(logFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, skip: 200 })
    );
    expect(logDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-1", "old-2"] } },
    });
  });

  it("status ERROR + state tertutup → alert terkirim sekali, state dibuka", async () => {
    stubState({ ...CLOSED_STATE });
    await recordSyncRun({
      mode: "AUTO",
      status: "ERROR",
      error: new Error("Tarik data gagal: koneksi ditolak"),
    });
    expect(notify).toHaveBeenCalledTimes(1);
    const msg = notify.mock.calls[0][0] as string;
    expect(msg).toContain("Sync Dapodik GAGAL");
    expect(msg).toContain("AUTO");
    expect(stateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "singleton" },
        data: expect.objectContaining({ alertOpen: true, reason: "sync-error" }),
      })
    );
    const logged = logCreate.mock.calls[0][0].data;
    expect(logged.error).toContain("Tarik data gagal");
    expect((logged.error as string).length).toBeLessThanOrEqual(500);
  });

  it("dedupe: state sudah open dengan reason sama → TIDAK kirim ulang", async () => {
    stubState({ ...OPEN_SYNC_ERROR });
    await recordSyncRun({
      mode: "AUTO",
      status: "ERROR",
      error: new Error("gagal lagi"),
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("reason berganti (stale → sync-error) → kirim ulang", async () => {
    stubState({ ...OPEN_STALE });
    await recordSyncRun({
      mode: "INGEST",
      dataType: "peserta_didik",
      status: "ERROR",
      error: new Error("ingest gagal"),
    });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(stateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: "sync-error" }),
      })
    );
  });

  it("sukses setelah gagal → reset state (alertOpen false)", async () => {
    stubState({ ...OPEN_SYNC_ERROR });
    await recordSyncRun({ mode: "MANUAL", status: "OK" });
    expect(stateUpdateMany).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { alertOpen: false, reason: null, detail: null },
    });
  });

  it("kegagalan pencatatan tidak pernah melempar (sync aman)", async () => {
    logCreate.mockRejectedValue(new Error("db down"));
    await expect(
      recordSyncRun({ mode: "MANUAL", status: "OK" })
    ).resolves.toBeUndefined();
  });
});

describe("checkSyncFreshness", () => {
  it("tanpa konfigurasi → skipped no-config", async () => {
    stubConfig(null);
    const r = await checkSyncFreshness();
    expect(r.skipped).toBe("no-config");
    expect(r.notified).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it("alert dimatikan via env → skipped alert-disabled", async () => {
    stubConfig(HEALTHY_CFG);
    setEnv("DAPODIK_SYNC_ALERT_ENABLED", "0");
    const r = await checkSyncFreshness();
    expect(r.skipped).toBe("alert-disabled");
    expect(notify).not.toHaveBeenCalled();
  });

  it("sehat → tidak kirim, tanpa reset", async () => {
    stubConfig(HEALTHY_CFG);
    stubState({ ...CLOSED_STATE });
    const r = await checkSyncFreshness();
    expect(r.skipped).toBeNull();
    expect(r.notified).toBe(false);
    expect(r.reset).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it("data basi (lastSyncAt 72 jam, ambang 48) → alert stale terkirim", async () => {
    stubConfig({ ...HEALTHY_CFG, lastSyncAt: new Date(Date.now() - 72 * HOUR) });
    stubState({ ...CLOSED_STATE });
    const r = await checkSyncFreshness();
    expect(r.notified).toBe(true);
    expect(r.reason).toBe("stale");
    expect(r.dataAgeHours).toBeGreaterThan(70);
    const msg = notify.mock.calls[0][0] as string;
    expect(msg).toContain("BASI");
    expect(stateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ alertOpen: true, reason: "stale" }),
      })
    );
  });

  it("belum pernah sync + auto-sync aktif → stale", async () => {
    stubConfig({ ...HEALTHY_CFG, lastSyncAt: null, autoSyncLastRunAt: null });
    stubState({ ...CLOSED_STATE });
    const r = await checkSyncFreshness();
    expect(r.notified).toBe(true);
    expect(r.reason).toBe("stale");
  });

  it("belum pernah sync + mode manual (auto off) → sehat, tidak alert", async () => {
    stubConfig({
      ...HEALTHY_CFG,
      lastSyncAt: null,
      autoSyncLastRunAt: null,
      autoSyncEnabled: false,
    });
    stubState({ ...CLOSED_STATE });
    const r = await checkSyncFreshness();
    expect(r.notified).toBe(false);
    expect(r.skipped).toBeNull();
  });

  it("backstop: autoSyncLastStatus ERROR tanpa pulih + state tertutup → alert sync-error", async () => {
    const runAt = new Date(Date.now() - 5 * HOUR);
    stubConfig({
      ...HEALTHY_CFG,
      autoSyncLastStatus: "ERROR",
      autoSyncLastError: "Tarik data gagal: PC mati",
      autoSyncLastRunAt: runAt,
      lastSyncAt: new Date(runAt.getTime() - 2 * HOUR),
    });
    stubState({ ...CLOSED_STATE });
    const r = await checkSyncFreshness();
    expect(r.notified).toBe(true);
    expect(r.reason).toBe("sync-error");
    expect(notify.mock.calls[0][0] as string).toContain("PC mati");
  });

  it("ERROR lalu sync sukses manual lebih baru → dianggap pulih (tidak alert)", async () => {
    const runAt = new Date(Date.now() - 5 * HOUR);
    stubConfig({
      ...HEALTHY_CFG,
      autoSyncLastStatus: "ERROR",
      autoSyncLastError: "gagal",
      autoSyncLastRunAt: runAt,
      lastSyncAt: new Date(Date.now() - 1 * HOUR),
    });
    stubState({ ...CLOSED_STATE });
    const r = await checkSyncFreshness();
    expect(r.notified).toBe(false);
    expect(r.skipped).toBeNull();
  });

  it("dedupe: state open + masih tidak sehat → tidak kirim ulang", async () => {
    stubConfig({ ...HEALTHY_CFG, lastSyncAt: new Date(Date.now() - 72 * HOUR) });
    stubState({ ...OPEN_STALE });
    const r = await checkSyncFreshness();
    expect(r.notified).toBe(false);
    expect(r.skipped).toBe("dedupe-open");
    expect(notify).not.toHaveBeenCalled();
  });

  it("pulih: state open + kondisi sehat → reset tanpa notifikasi", async () => {
    stubConfig(HEALTHY_CFG);
    stubState({ ...OPEN_STALE });
    const r = await checkSyncFreshness();
    expect(r.reset).toBe(true);
    expect(r.notified).toBe(false);
    expect(stateUpdateMany).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { alertOpen: false, reason: null, detail: null },
    });
  });
});
