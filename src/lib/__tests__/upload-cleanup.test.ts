import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    uploadedFile: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  cleanupOldUploads,
  uploadRetentionDays,
  DEFAULT_UPLOAD_RETENTION_DAYS,
} from "@/lib/upload-cleanup";

const findMany = db.uploadedFile.findMany as ReturnType<typeof vi.fn>;
const deleteMany = db.uploadedFile.deleteMany as ReturnType<typeof vi.fn>;

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-08T00:00:00.000Z");

function setRetention(value: string | undefined) {
  if (value === undefined) delete process.env.UPLOAD_RETENTION_DAYS;
  else process.env.UPLOAD_RETENTION_DAYS = value;
}

describe("uploadRetentionDays", () => {
  afterEach(() => setRetention(undefined));

  it("defaults to 90 days when env tidak diset", () => {
    setRetention(undefined);
    expect(uploadRetentionDays()).toBe(DEFAULT_UPLOAD_RETENTION_DAYS);
  });

  it("memakai nilai env yang valid", () => {
    setRetention("30");
    expect(uploadRetentionDays()).toBe(30);
  });

  it("nonaktif (0) untuk nilai <= 0", () => {
    setRetention("0");
    expect(uploadRetentionDays()).toBe(0);
    setRetention("-5");
    expect(uploadRetentionDays()).toBe(0);
  });

  it("fallback ke default untuk nilai tidak valid", () => {
    setRetention("abc");
    expect(uploadRetentionDays()).toBe(DEFAULT_UPLOAD_RETENTION_DAYS);
  });

  it("env kosong dianggap tidak diset → default (bukan nonaktif)", () => {
    // Number("") = 0 — tanpa guard, env kosong menonaktifkan cleanup diam-diam.
    setRetention("");
    expect(uploadRetentionDays()).toBe(DEFAULT_UPLOAD_RETENTION_DAYS);
  });
});

describe("cleanupOldUploads", () => {
  beforeEach(() => {
    findMany.mockReset();
    deleteMany.mockReset();
  });
  afterEach(() => setRetention(undefined));

  it("tidak menyentuh DB saat nonaktif (retensi 0)", async () => {
    setRetention("0");
    const result = await cleanupOldUploads(NOW);
    expect(result).toMatchObject({ disabled: true, deleted: 0, freedBytes: 0 });
    expect(result.cutoffAt).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("menghitung cutoff = now - retensi dan tidak hapus apa pun saat tak ada file lama", async () => {
    setRetention("90");
    findMany.mockResolvedValue([]);

    const result = await cleanupOldUploads(NOW);

    expect(findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(NOW.getTime() - 90 * DAY_MS) } },
      select: { id: true, size: true },
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ disabled: false, deleted: 0, freedBytes: 0 });
    expect(result.cutoffAt).toBe(new Date(NOW.getTime() - 90 * DAY_MS).toISOString());
  });

  it("menghapus file lama dan menjumlahkan freedBytes", async () => {
    setRetention("90");
    findMany.mockResolvedValue([
      { id: "a", size: 100 },
      { id: "b", size: 250 },
    ]);
    deleteMany.mockResolvedValue({ count: 2 });

    const result = await cleanupOldUploads(NOW);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(NOW.getTime() - 90 * DAY_MS) } },
    });
    expect(result).toMatchObject({ disabled: false, deleted: 2, freedBytes: 350 });
    expect(result.cutoffAt).toBe(new Date(NOW.getTime() - 90 * DAY_MS).toISOString());
  });
});