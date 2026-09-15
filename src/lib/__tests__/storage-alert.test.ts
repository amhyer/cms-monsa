import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    uploadedFile: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    storageAlertState: {
      upsert: vi.fn(),
      update: vi.fn(),
      // getUploadStorageStats kini membaca status alert (readAlertState) —
      // di-stub null agar cepat; logika alert sendiri tak memakainya.
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  notifyAdmin: vi.fn(() => Promise.resolve({ whatsapp: true, telegram: true })),
}));

import { db } from "@/lib/db";
import { notifyAdmin } from "@/lib/notifications";
import {
  checkStorageAlert,
  storageAlertThresholdPct,
  storageAlertHysteresisPct,
} from "@/lib/storage-alert";

const aggregate = db.uploadedFile.aggregate as ReturnType<typeof vi.fn>;
const groupBy = db.uploadedFile.groupBy as ReturnType<typeof vi.fn>;
const findMany = db.uploadedFile.findMany as ReturnType<typeof vi.fn>;
const queryRawUnsafe = db.$queryRawUnsafe as ReturnType<typeof vi.fn>;
const upsert = db.storageAlertState.upsert as ReturnType<typeof vi.fn>;
const update = db.storageAlertState.update as ReturnType<typeof vi.fn>;
const notify = notifyAdmin as ReturnType<typeof vi.fn>;

const MB = 1024 * 1024;

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function resetAll() {
  aggregate.mockReset();
  groupBy.mockReset();
  findMany.mockReset();
  upsert.mockReset();
  update.mockReset();
  notify.mockReset();
  notify.mockResolvedValue({ whatsapp: true, telegram: true });
}

/**
 * Stub statistik: pemakaian = `usedMB` MB dari kuota `quotaMB` MB.
 * UPLOAD_RETENTION_DAYS=0 agar getUploadStorageStats tidak memanggil
 * findMany/queryRawUnsafe (jalur kandidat tidak relevan di sini).
 */
function stubStats(usedMB: number) {
  aggregate.mockResolvedValue({
    _count: { _all: 5 },
    _sum: { size: usedMB * MB },
  });
  groupBy.mockResolvedValue([]);
  findMany.mockResolvedValue([]);
  queryRawUnsafe.mockResolvedValue([]);
}

describe("storageAlertThresholdPct", () => {
  afterEach(() => setEnv("STORAGE_ALERT_THRESHOLD_PCT", undefined));

  it("default 80 bila env tidak diset atau kosong", () => {
    expect(storageAlertThresholdPct()).toBe(80);
    setEnv("STORAGE_ALERT_THRESHOLD_PCT", "");
    expect(storageAlertThresholdPct()).toBe(80);
  });

  it("memakai nilai valid, invalid → default", () => {
    setEnv("STORAGE_ALERT_THRESHOLD_PCT", "60");
    expect(storageAlertThresholdPct()).toBe(60);
    setEnv("STORAGE_ALERT_THRESHOLD_PCT", "abc");
    expect(storageAlertThresholdPct()).toBe(80);
  });

  it("nilai <= 0 menonaktifkan alert (0)", () => {
    setEnv("STORAGE_ALERT_THRESHOLD_PCT", "0");
    expect(storageAlertThresholdPct()).toBe(0);
  });
});

describe("storageAlertHysteresisPct", () => {
  afterEach(() => setEnv("STORAGE_ALERT_HYSTERESIS_PCT", undefined));

  it("default 10; memakai nilai valid", () => {
    expect(storageAlertHysteresisPct(80)).toBe(10);
    setEnv("STORAGE_ALERT_HYSTERESIS_PCT", "20");
    expect(storageAlertHysteresisPct(80)).toBe(20);
  });

  it("dijepit di bawah ambang agar state selalu bisa ter-reset", () => {
    setEnv("STORAGE_ALERT_HYSTERESIS_PCT", "500");
    expect(storageAlertHysteresisPct(80)).toBe(79);
    expect(storageAlertHysteresisPct(1)).toBe(0);
  });
});

describe("checkStorageAlert", () => {
  afterEach(() => {
    setEnv("NEON_STORAGE_QUOTA_MB", undefined);
    setEnv("STORAGE_ALERT_THRESHOLD_PCT", undefined);
    setEnv("STORAGE_ALERT_HYSTERESIS_PCT", undefined);
    setEnv("UPLOAD_RETENTION_DAYS", undefined);
  });

  it("dilewati bila kuota belum dikonfigurasi", async () => {
    resetAll();
    const result = await checkStorageAlert();
    expect(result.skipped).toBe("quota-not-configured");
    expect(result.notified).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("dilewati bila ambang dinonaktifkan (<= 0)", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    setEnv("STORAGE_ALERT_THRESHOLD_PCT", "0");
    const result = await checkStorageAlert();
    expect(result.skipped).toBe("alert-disabled");
    expect(notify).not.toHaveBeenCalled();
  });

  it("tidak mengirim saat pemakaian di bawah ambang", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(50);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: false });

    const result = await checkStorageAlert();

    expect(result.skipped).toBeNull();
    expect(result.usagePercent).toBe(50);
    expect(result.notified).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("mengirim notifikasi SEKALI saat ambang dilampaui (persilangan pertama)", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(85);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: false });

    const result = await checkStorageAlert();

    expect(result.notified).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    const message = String(notify.mock.calls[0][0]);
    expect(message).toContain("PERINGATAN STORAGE");
    expect(message).toContain("85");
    expect(message).toContain("80");
    expect(message).toContain("/api/storage-usage");
    // state disimpan agar tidak terulang
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "singleton" },
        data: expect.objectContaining({ aboveThreshold: true }),
      })
    );
    expect(result.notifiedChannels).toEqual({ whatsapp: true, telegram: true });
  });

  it("TIDAK mengirim ulang selama masih di atas ambang", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(90);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: true });

    const result = await checkStorageAlert();

    expect(result.notified).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("diam di pita hysteresis (di bawah ambang tapi belum cukup turun)", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(75); // 75 < 80 tapi 75 >= 70 (ambang − hysteresis)
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: true });

    const result = await checkStorageAlert();

    expect(result.notified).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("me-reset state saat turun di bawah ambang − hysteresis", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(60);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: true });
    update.mockResolvedValue({ id: "singleton", aboveThreshold: false });

    const result = await checkStorageAlert();

    expect(result.notified).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "singleton" },
        data: { aboveThreshold: false },
      })
    );
  });

  it("mengirim lagi setelah reset dan melampaui ambang kembali", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(85);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: false });

    await checkStorageAlert();
    expect(notify).toHaveBeenCalledTimes(1);

    // naik lagi setelah reset → notifikasi baru
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: false });
    await checkStorageAlert();
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("tetap melaporkan notified walaupun penyimpanan state gagal (duplikat ringan)", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(85);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: false });
    update.mockImplementation(() => {
      throw new Error("connection pool timeout");
    });

    const result = await checkStorageAlert();

    expect(result.notified).toBe(true);
    expect(result.aboveThreshold).toBe(true);
  });

  it("mencatat hasil kirim per kanal di state (lastSendAt + kanal)", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(85);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: false });
    update.mockResolvedValue({ id: "singleton" });
    notify.mockResolvedValue({ whatsapp: true, telegram: false });

    const result = await checkStorageAlert();

    expect(result.notifiedChannels).toEqual({ whatsapp: true, telegram: false });
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0].data;
    expect(payload.aboveThreshold).toBe(true);
    expect(payload.lastSendAt).toBeInstanceOf(Date);
    expect(payload.lastChannelsWhatsapp).toBe(true);
    expect(payload.lastChannelsTelegram).toBe(false);
  });

  it("attempt gagal (semua kanal false) tetap tercatat di state", async () => {
    resetAll();
    setEnv("NEON_STORAGE_QUOTA_MB", "100");
    stubStats(85);
    upsert.mockResolvedValue({ id: "singleton", aboveThreshold: false });
    update.mockResolvedValue({ id: "singleton" });
    notify.mockResolvedValue({ whatsapp: false, telegram: false });

    const result = await checkStorageAlert();

    expect(result.notifiedChannels).toEqual({ whatsapp: false, telegram: false });
    const payload = update.mock.calls[0][0].data;
    expect(payload.lastSendAt).toBeInstanceOf(Date);
    expect(payload.lastChannelsWhatsapp).toBe(false);
    expect(payload.lastChannelsTelegram).toBe(false);
  });
});