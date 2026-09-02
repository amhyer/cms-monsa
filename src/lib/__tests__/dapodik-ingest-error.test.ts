import { describe, expect, it } from "vitest";
import { describeIngestError, ingestErrorStatus } from "@/lib/dapodik-ingest-error";

class PrismaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

describe("describeIngestError", () => {
  it("selalu mengembalikan objek JSON dengan field error", () => {
    for (const input of [
      null,
      undefined,
      "string biasa",
      new Error("boom"),
      new PrismaError("P2002", "Unique constraint failed"),
    ]) {
      const out = describeIngestError(input);
      expect(typeof out.error).toBe("string");
      expect(out.error.length).toBeGreaterThan(0);
      expect(() => JSON.stringify(out)).not.toThrow();
    }
  });

  it("menjelaskan P2028 sebagai timeout transaksi + jaminan rollback", () => {
    const out = describeIngestError(new PrismaError("P2028", "Transaction not found."));
    expect(out.code).toBe("P2028");
    expect(out.error).toMatch(/batas waktu/i);
    expect(out.error).toMatch(/rollback/i);
    expect(out.error).toMatch(/tidak ada data yang dihapus/i);
  });

  it("mendeteksi P2028 dari pesan meski tanpa kode", () => {
    const out = describeIngestError(new Error("Transaction API error: Transaction not found."));
    expect(out.code).toBe("P2028");
  });

  it("menangani pool habis (P2024)", () => {
    const out = describeIngestError(new PrismaError("P2024", "Timed out fetching a connection"));
    expect(out.code).toBe("P2024");
    expect(out.error).toMatch(/sibuk/i);
  });

  it("meneruskan pesan validasi apa adanya", () => {
    expect(describeIngestError(new Error("Field sekolah.nama dan sekolah.npsn wajib diisi.")).error)
      .toBe("Field sekolah.nama dan sekolah.npsn wajib diisi.");
  });

  it("tidak membocorkan stack trace maupun detail Prisma mentah", () => {
    const err = new PrismaError(
      "P2010",
      "Invalid `prisma.teacher.create()` invocation:\n\n  at /var/task/.next/server/chunks/123.js:45:67\n" +
        "postgresql://user:s3cr3t@db.neon.tech/main"
    );
    const out = describeIngestError(err);
    expect(out.error).not.toMatch(/postgresql:\/\//);
    expect(out.error).not.toMatch(/s3cr3t/);
    expect(out.error).not.toMatch(/\.next\/server/);
    expect(out.error).not.toContain("\n");
    expect(out.code).toBe("P2010");
  });

  it("tidak meneruskan pesan multi-baris yang tidak dikenal", () => {
    const out = describeIngestError(new Error("baris1\nbaris2 token=abc123"));
    expect(out.error).toBe("Gagal memproses data Dapodik.");
    expect(out.error).not.toMatch(/abc123/);
  });
});

describe("ingestErrorStatus", () => {
  it("400 untuk error validasi", () => {
    expect(ingestErrorStatus(new Error("Body JSON wajib."))).toBe(400);
    expect(ingestErrorStatus(new Error("Payload Dapodik tidak valid."))).toBe(400);
  });

  it("503 untuk timeout transaksi / pool penuh (layak dicoba ulang)", () => {
    expect(ingestErrorStatus(new PrismaError("P2028", "Transaction not found"))).toBe(503);
    expect(ingestErrorStatus(new PrismaError("P2024", "Timed out"))).toBe(503);
  });

  it("502 untuk error lain", () => {
    expect(ingestErrorStatus(new Error("boom"))).toBe(502);
    expect(ingestErrorStatus(new PrismaError("P2002", "unique"))).toBe(502);
  });
});
