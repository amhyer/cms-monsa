import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";vi.mock("@/lib/db", () => ({
  db: {
    uploadedFile: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    storageAlertState: {
      findUnique: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  getUploadStorageStats,
  storageQuotaBytes,
  scanUploadReferences,
  basenameOfUrl,
} from "@/lib/upload-stats";

const aggregate = db.uploadedFile.aggregate as ReturnType<typeof vi.fn>;
const groupBy = db.uploadedFile.groupBy as ReturnType<typeof vi.fn>;
const findMany = db.uploadedFile.findMany as ReturnType<typeof vi.fn>;
const queryRawUnsafe = db.$queryRawUnsafe as ReturnType<typeof vi.fn>;
const alertStateFindUnique = db.storageAlertState.findUnique as ReturnType<
  typeof vi.fn
>;

const DAY_MS = 24 * 60 * 60 * 1000;

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("storageQuotaBytes", () => {
  afterEach(() => setEnv("NEON_STORAGE_QUOTA_MB", undefined));

  it("null bila env tidak diset atau tidak valid", () => {
    expect(storageQuotaBytes()).toBeNull();
    setEnv("NEON_STORAGE_QUOTA_MB", "abc");
    expect(storageQuotaBytes()).toBeNull();
    setEnv("NEON_STORAGE_QUOTA_MB", "-5");
    expect(storageQuotaBytes()).toBeNull();
  });

  it("mengonversi MB ke bytes", () => {
    setEnv("NEON_STORAGE_QUOTA_MB", "512");
    expect(storageQuotaBytes()).toBe(512 * 1024 * 1024);
  });
});

describe("basenameOfUrl", () => {
  it("mengambil basename dan membuang query/fragment", () => {
    expect(basenameOfUrl("/uploads/1758-abc.jpg")).toBe("1758-abc.jpg");
    expect(basenameOfUrl("/uploads/1758-abc.jpg?v=1#x")).toBe("1758-abc.jpg");
    expect(basenameOfUrl("1758-abc.png")).toBe("1758-abc.png");
  });
});

describe("scanUploadReferences", () => {
  // CATATAN: mock di-reset INLINE per tes, bukan via beforeEach hook —
  // di vitest v4, hook beforeEach(mockReset) + mock yang melempar error di
  // dalam modul ter-import membuat tes gagal walau error tertangkap penuh.
  it("langsung selesai tanpa query bila tidak ada kandidat", async () => {
    queryRawUnsafe.mockReset();
    const impact = await scanUploadReferences([]);
    expect(impact).toEqual({ referencedCandidates: 0, safeCandidates: 0, byEntity: {} });
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("menghitung file kandidat yang direferensikan, per entity (distinct)", async () => {
    queryRawUnsafe.mockReset();
    queryRawUnsafe.mockResolvedValue([
      { entity: "News", url: "/uploads/a1.jpg" },
      { entity: "News", url: "/uploads/a1.jpg" }, // duplikat dalam entity yang sama
      { entity: "Photo", url: "/uploads/a1.jpg" }, // file sama di entity lain
      { entity: "Photo", url: "/uploads/b2.pdf" },
      { entity: "BosDocument", url: "https://ext.example.com/x.pdf" }, // URL eksternal — tidak cocok
      { entity: "GalleryItem", url: "/uploads/c3.png?w=400" }, // query string dibuang
    ]);

    const impact = await scanUploadReferences(["a1.jpg", "b2.pdf", "c3.png", "d4.jpg"]);

    expect(impact).toEqual({
      referencedCandidates: 3, // a1, b2, c3
      safeCandidates: 1, // d4
      byEntity: { News: 1, Photo: 2, GalleryItem: 1 },
    });
  });

  it("fail-soft: null bila query referensi gagal", async () => {
    queryRawUnsafe.mockReset();
    queryRawUnsafe.mockImplementation(() => {
      throw new Error("relation does not exist");
    });
    const impact = await scanUploadReferences(["a1.jpg"]);
    expect(impact).toBeNull();
  });
});

describe("getUploadStorageStats", () => {
  beforeEach(() => {
    aggregate.mockReset();
    groupBy.mockReset();
    findMany.mockReset();
    queryRawUnsafe.mockReset();
    alertStateFindUnique.mockReset();
  });
  afterEach(() => {
    setEnv("NEON_STORAGE_QUOTA_MB", undefined);
    setEnv("UPLOAD_RETENTION_DAYS", undefined);
  });

  it("menjumlahkan file & byte, mengurutkan mimeType dari terbesar", async () => {
    aggregate.mockResolvedValue({ _count: { _all: 3 }, _sum: { size: 1000 } });
    groupBy.mockResolvedValue([
      { mimeType: "image/jpeg", _count: { _all: 2 }, _sum: { size: 800 } },
      { mimeType: "application/pdf", _count: { _all: 1 }, _sum: { size: 200 } },
    ]);
    findMany.mockResolvedValue([]);
    queryRawUnsafe.mockResolvedValue([]);

    const stats = await getUploadStorageStats();

    expect(stats.fileCount).toBe(3);
    expect(stats.totalBytes).toBe(1000);
    expect(stats.byMimeType).toEqual([
      { mimeType: "image/jpeg", count: 2, bytes: 800 },
      { mimeType: "application/pdf", count: 1, bytes: 200 },
    ]);
    expect(stats.quotaBytes).toBeNull();
    expect(stats.usagePercent).toBeNull();
    expect(stats.cleanupCandidates).toBe(0);
    expect(stats.impact).toEqual({ referencedCandidates: 0, safeCandidates: 0, byEntity: {} });
  });

  it("menghitung persentase kuota (1 desimal)", async () => {
    setEnv("NEON_STORAGE_QUOTA_MB", "1"); // 1 MB kuota
    aggregate.mockResolvedValue({ _count: { _all: 1 }, _sum: { size: 512 * 1024 } }); // 0.5 MB
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValue([]);
    queryRawUnsafe.mockResolvedValue([]);

    const stats = await getUploadStorageStats();

    expect(stats.quotaBytes).toBe(1024 * 1024);
    expect(stats.usagePercent).toBe(50);
  });

  it("cleanupCandidates dan impact null saat retensi nonaktif", async () => {
    setEnv("UPLOAD_RETENTION_DAYS", "0");
    aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { size: null } });
    groupBy.mockResolvedValue([]);

    const stats = await getUploadStorageStats();

    expect(stats.fileCount).toBe(0);
    expect(stats.totalBytes).toBe(0);
    expect(stats.cleanupCandidates).toBeNull();
    expect(stats.impact).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("menghitung kandidat dari now yang sama dan melaporkan dampak", async () => {
    const NOW = new Date("2026-09-08T00:00:00.000Z");
    setEnv("UPLOAD_RETENTION_DAYS", "90");
    aggregate.mockResolvedValue({ _count: { _all: 5 }, _sum: { size: 10 } });
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValue([{ filename: "old1.jpg" }, { filename: "used.jpg" }]);
    queryRawUnsafe.mockResolvedValue([{ entity: "News", url: "/uploads/used.jpg" }]);

    const stats = await getUploadStorageStats(NOW);

    expect(stats.cleanupCandidates).toBe(2);
    // cutoff tepat = now - 90 hari (helper retentionCutoff yang sama dengan cleanup)
    const where = findMany.mock.calls[0][0].where;
    expect(where.createdAt.lt).toEqual(new Date(NOW.getTime() - 90 * DAY_MS));
    expect(findMany.mock.calls[0][0].select).toEqual({ filename: true });
    // dampak: 1 dari 2 kandidat masih dipakai berita
    expect(stats.impact).toEqual({
      referencedCandidates: 1,
      safeCandidates: 1,
      byEntity: { News: 1 },
    });
  });

  it("alertState diisi dari StorageAlertState saat tersedia", async () => {
    aggregate.mockResolvedValue({ _count: { _all: 1 }, _sum: { size: 10 } });
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValue([]);
    queryRawUnsafe.mockResolvedValue([]);
    alertStateFindUnique.mockResolvedValue({
      id: "singleton",
      aboveThreshold: true,
      lastAlertedAt: new Date("2026-09-08T00:00:00.000Z"),
      lastUsagePercent: 95.4,
      lastSendAt: new Date("2026-09-09T03:00:00.000Z"),
      lastChannelsWhatsapp: true,
      lastChannelsTelegram: false,
      lastTestedAt: new Date("2026-09-10T02:30:00.000Z"),
    });

    const stats = await getUploadStorageStats();

    expect(stats.alertState).toEqual({
      aboveThreshold: true,
      lastAlertedAt: "2026-09-08T00:00:00.000Z",
      lastUsagePercent: 95.4,
      lastSendAt: "2026-09-09T03:00:00.000Z",
      lastChannelsWhatsapp: true,
      lastChannelsTelegram: false,
      lastTestedAt: "2026-09-10T02:30:00.000Z",
    });
  });

  it("alertState null bila row belum ada / tabel gagal dibaca", async () => {
    aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { size: null } });
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValue([]);
    queryRawUnsafe.mockResolvedValue([]);
    alertStateFindUnique.mockResolvedValue(null);

    const stats = await getUploadStorageStats();
    expect(stats.alertState).toBeNull();
  });
});