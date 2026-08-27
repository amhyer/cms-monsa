import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPrisma } from "./test-utils";

/**
 * Unit test src/lib/file-storage.ts + route /uploads/[...path].
 *
 * Disk I/O (fs/promises) di-mock agar test tidak menyentuh filesystem.
 * Backend "db" diuji via mockPrisma.uploadedFile; backend "disk" diuji
 * lewat mock writeFile/readFile.
 */

// --- Mock fs/promises SEBELUM import modul yang dites ---
const { writeFileMock, mkdirMock, readFileMock, unlinkMock, accessMock } =
  vi.hoisted(() => ({
    writeFileMock: vi.fn(),
    mkdirMock: vi.fn(),
    readFileMock: vi.fn(),
    unlinkMock: vi.fn(),
    accessMock: vi.fn(),
  }));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
    unlink: unlinkMock,
    access: accessMock,
  },
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  readFile: readFileMock,
  unlink: unlinkMock,
  access: accessMock,
}));

import {
  uploadStorage,
  maxUploadMb,
  saveUpload,
  loadUpload,
  deleteUpload,
  isSafeUploadFilename,
} from "@/lib/file-storage";
import { GET as serveUpload } from "@/app/uploads/[...path]/route";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  // resetAllMocks (bukan clearAllMocks) — antrian mockResolvedValueOnce dari
  // test sebelumnya harus dibersihkan agar tidak bocor ke test berikutnya.
  vi.resetAllMocks();
  delete process.env.VERCEL;
  delete process.env.UPLOAD_STORAGE;
  delete process.env.MAX_UPLOAD_MB;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

// ---------------------------------------------------------------------------
// Pemilihan backend & batas ukuran
// ---------------------------------------------------------------------------

describe("uploadStorage()", () => {
  it("default disk di self-host (tanpa env VERCEL)", () => {
    expect(uploadStorage()).toBe("disk");
  });

  it("default db saat VERCEL=1 (filesystem ephemeral)", () => {
    process.env.VERCEL = "1";
    expect(uploadStorage()).toBe("db");
  });

  it("UPLOAD_STORAGE menimpa deteksi otomatis", () => {
    process.env.UPLOAD_STORAGE = "db";
    expect(uploadStorage()).toBe("db");
    process.env.UPLOAD_STORAGE = "disk";
    process.env.VERCEL = "1";
    expect(uploadStorage()).toBe("disk");
  });
});

describe("maxUploadMb()", () => {
  it("pakai default self-host (mis. 15 MB PDF) tanpa env", () => {
    expect(maxUploadMb(15)).toBe(15);
  });

  it("turun ke 4 MB di Vercel (limit platform 4.5 MB)", () => {
    process.env.VERCEL = "1";
    expect(maxUploadMb(15)).toBe(4);
  });

  it("MAX_UPLOAD_MB menimpa semua default", () => {
    process.env.MAX_UPLOAD_MB = "2";
    expect(maxUploadMb(15)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Validasi nama file
// ---------------------------------------------------------------------------

describe("isSafeUploadFilename()", () => {
  it("menerima nama file buatan route upload", () => {
    expect(isSafeUploadFilename("1758900000000-abc123.jpg")).toBe(true);
    expect(isSafeUploadFilename("bos-1758900000000-abc123.pdf")).toBe(true);
  });

  it("menolak path traversal / separator / ekstensi asing", () => {
    expect(isSafeUploadFilename("../../etc/passwd")).toBe(false);
    expect(isSafeUploadFilename("a/b.jpg")).toBe(false);
    expect(isSafeUploadFilename("file.html")).toBe(false);
    expect(isSafeUploadFilename("file.svg")).toBe(false);
    expect(isSafeUploadFilename("noext")).toBe(false);
    expect(isSafeUploadFilename("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Backend disk
// ---------------------------------------------------------------------------

describe("saveUpload — backend disk", () => {
  it("menulis file ke public/uploads dan mengembalikan URL", async () => {
    accessMock.mockRejectedValueOnce(new Error("ENOENT"));
    const saved = await saveUpload(
      new Uint8Array([1, 2, 3]),
      "1758900000000-abc123.jpg",
      "image/jpeg"
    );
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(saved.url).toBe("/uploads/1758900000000-abc123.jpg");
    expect(mockPrisma.uploadedFile.create).not.toHaveBeenCalled();
  });

  it("menolak nama file tidak valid (tidak menulis apa pun)", async () => {
    await expect(
      saveUpload(new Uint8Array([1]), "../evil.jpg", "image/jpeg")
    ).rejects.toThrow();
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});

describe("loadUpload — fallback disk", () => {
  it("membaca file disk bila ada (self-host)", async () => {
    accessMock.mockResolvedValueOnce(undefined);
    readFileMock.mockResolvedValueOnce(Buffer.from("disk-bytes"));
    const file = await loadUpload("1758900000000-abc123.png");
    expect(file?.data.toString()).toBe("disk-bytes");
    expect(file?.mimeType).toBe("image/png");
  });
});

// ---------------------------------------------------------------------------
// Backend db
// ---------------------------------------------------------------------------

describe("saveUpload — backend db (Vercel)", () => {
  it("menyimpan baris UploadedFile, bukan menulis disk", async () => {
    process.env.VERCEL = "1";
    const bytes = new Uint8Array([9, 9, 9, 9]);
    const saved = await saveUpload(bytes, "1758900000000-abc123.pdf", "application/pdf");
    expect(mockPrisma.uploadedFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filename: "1758900000000-abc123.pdf",
        mimeType: "application/pdf",
        size: 4,
      }),
    });
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(saved.url).toBe("/uploads/1758900000000-abc123.pdf");
  });
});

describe("loadUpload — backend db", () => {
  it("membaca dari UploadedFile bila tidak ada di disk", async () => {
    accessMock.mockRejectedValueOnce(new Error("ENOENT"));
    mockPrisma.uploadedFile.findUnique.mockResolvedValueOnce({
      id: "uf-1",
      filename: "1758900000000-abc123.jpg",
      mimeType: "image/jpeg",
      size: 3,
      data: Buffer.from([1, 2, 3]),
    });
    const file = await loadUpload("1758900000000-abc123.jpg");
    expect(file?.mimeType).toBe("image/jpeg");
    expect(file?.size).toBe(3);
    expect(file?.data.byteLength).toBe(3);
    expect(file?.etag).toBe('"uf-1-3"');
  });

  it("null bila tidak ada di disk maupun DB", async () => {
    accessMock.mockRejectedValueOnce(new Error("ENOENT"));
    mockPrisma.uploadedFile.findUnique.mockResolvedValueOnce(null);
    expect(await loadUpload("1758900000000-abc123.jpg")).toBeNull();
  });

  it("null untuk nama file tidak valid (tanpa query DB)", async () => {
    expect(await loadUpload("../etc/passwd")).toBeNull();
    expect(mockPrisma.uploadedFile.findUnique).not.toHaveBeenCalled();
  });
});

describe("deleteUpload", () => {
  it("best-effort: hapus dari disk dan DB tanpa melempar error", async () => {
    unlinkMock.mockRejectedValueOnce(new Error("ENOENT"));
    mockPrisma.uploadedFile.deleteMany.mockResolvedValueOnce(0);
    await expect(
      deleteUpload("bos-1758900000000-abc123.pdf")
    ).resolves.toBeUndefined();
    expect(mockPrisma.uploadedFile.deleteMany).toHaveBeenCalledWith({
      where: { filename: "bos-1758900000000-abc123.pdf" },
    });
  });
});

// ---------------------------------------------------------------------------
// Route serve /uploads/[...path]
// ---------------------------------------------------------------------------

function serveReq(filename: string) {
  return serveUpload({} as never, {
    params: Promise.resolve({ path: filename.split("/") }),
  });
}

describe("GET /uploads/[...path]", () => {
  it("404 untuk nama file tidak valid (path traversal)", async () => {
    const res = await serveReq("../etc/passwd");
    expect(res.status).toBe(404);
  });

  it("serve file dari DB dengan header cache immutable", async () => {
    accessMock.mockRejectedValue(new Error("ENOENT"));
    mockPrisma.uploadedFile.findUnique.mockResolvedValue({
      id: "uf-9",
      filename: "1758900000000-abc123.webp",
      mimeType: "image/webp",
      size: 5,
      data: Buffer.from([1, 2, 3, 4, 5]),
    });
    const res = await serveReq("1758900000000-abc123.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(res.headers.get("Content-Length")).toBe("5");
    expect(res.headers.get("ETag")).toBe('"uf-9-5"');
  });

  it("404 bila file tidak ada di disk maupun DB", async () => {
    accessMock.mockRejectedValue(new Error("ENOENT"));
    mockPrisma.uploadedFile.findUnique.mockResolvedValue(null);
    const res = await serveReq("1758900000000-abc123.gif");
    expect(res.status).toBe(404);
  });
});
