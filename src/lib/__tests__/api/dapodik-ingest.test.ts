import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, asNextRequest } from "../test-utils";

const mockAuthenticateBridgeRequest = vi.fn();
const mockApplyDapodikPayload = vi.fn();
const mockRateLimitPublicForm = vi.fn();

vi.mock("@/lib/dapodik-bridge", () => ({
  authenticateBridgeRequest: (...args: unknown[]) => mockAuthenticateBridgeRequest(...args),
}));

vi.mock("@/lib/dapodik-sync", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/dapodik-sync")>();
  return {
    ...original,
    applyDapodikPayload: (...args: unknown[]) => mockApplyDapodikPayload(...args),
  };
});

vi.mock("@/lib/rate-limit", () => ({
  rateLimitPublicForm: (...args: unknown[]) => mockRateLimitPublicForm(...args),
}));

import { POST, GET } from "@/app/api/dapodik/ingest/route";

const sampleBody = {
  sekolah: { nama: "SDN Mongisidi 1", npsn: "40313912" },
  siswa: [{ peserta_didik_id: "pd-1", nama: "Siswa 1", rombongan_belajar_id: "rb-1" }],
  gtk: [{ nama: "Guru 1", nuptk: "12345" }],
  rombel: [{ rombongan_belajar_id: "rb-1", nama: "1.a" }],
};

describe("POST /api/dapodik/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitPublicForm.mockResolvedValue(null);
    mockAuthenticateBridgeRequest.mockResolvedValue({ ok: true });
    mockApplyDapodikPayload.mockResolvedValue({
      mode: "dry-run",
      sekolah: { updated: 1 },
      siswa: { created: 1, updated: 0, archived: 0, errors: 0 },
      gtk: { created: 1, updated: 0, archived: 0, errors: 0 },
      rombel: { created: 1, updated: 0, errors: 0 },
    });
  });

  it("mengembalikan 401 JSON jika auth pairing gagal", async () => {
    mockAuthenticateBridgeRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Kunci pairing tidak valid atau belum dipasangkan.",
    });

    const req = createMockRequest("http://localhost/api/dapodik/ingest", {
      method: "POST",
      body: sampleBody,
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Kunci pairing tidak valid atau belum dipasangkan.");
  });

  it("merespons ping dengan 200 JSON ok: true", async () => {
    const req = createMockRequest("http://localhost/api/dapodik/ingest", {
      method: "POST",
      body: { ping: true },
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message).toBe("Kunci pairing valid.");
  });

  it("menerima dry-run mode dan memanggil applyDapodikPayload dengan dry-run", async () => {
    const req = createMockRequest("http://localhost/api/dapodik/ingest?mode=dry-run", {
      method: "POST",
      body: sampleBody,
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("dry-run");
    expect(mockApplyDapodikPayload).toHaveBeenCalledWith(
      expect.objectContaining({ sekolah: expect.any(Object) }),
      "dry-run",
      { userId: "jembatan" }
    );
  });

  it("menerima commit mode dan memanggil applyDapodikPayload dengan commit", async () => {
    mockApplyDapodikPayload.mockResolvedValue({
      mode: "commit",
      logId: "log-123",
      sekolah: { updated: 1 },
      siswa: { created: 1, updated: 0, archived: 0, errors: 0 },
      gtk: { created: 1, updated: 0, archived: 0, errors: 0 },
      rombel: { created: 1, updated: 0, errors: 0 },
    });

    const req = createMockRequest("http://localhost/api/dapodik/ingest?mode=commit", {
      method: "POST",
      body: sampleBody,
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("commit");
    expect(json.logId).toBe("log-123");
    expect(mockApplyDapodikPayload).toHaveBeenCalledWith(
      expect.objectContaining({ sekolah: expect.any(Object) }),
      "commit",
      { userId: "jembatan" }
    );
  });

  it("mengembalikan 400 JSON jika body bukan JSON yang valid", async () => {
    const req = new Request("http://localhost/api/dapodik/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not a json string {{{",
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Body JSON wajib.");
  });

  it("mengembalikan 400 JSON jika payload tidak valid (nama sekolah kosong)", async () => {
    const req = createMockRequest("http://localhost/api/dapodik/ingest", {
      method: "POST",
      body: { sekolah: { nama: "", npsn: "" } },
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/wajib diisi/i);
  });

  it("mengembalikan 504 JSON jika terjadi batas waktu transaksi database (P2028 / timeout)", async () => {
    mockApplyDapodikPayload.mockRejectedValue(
      new Error("Transaction API error: Transaction not found. Transaction ID is invalid (P2028)")
    );

    const req = createMockRequest("http://localhost/api/dapodik/ingest?mode=commit", {
      method: "POST",
      body: sampleBody,
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(504);
    expect(json.error).toContain("Batas waktu transaksi database terlampaui");
    expect(json.error).not.toContain("P2028");
    expect(json.error).not.toContain("Transaction API error");
  });

  it("mengembalikan 502 JSON yang aman tanpa membocorkan stack trace atau credential pada database error", async () => {
    mockApplyDapodikPayload.mockRejectedValue(
      new Error("PrismaClientKnownRequestError: Can't reach database server at postgresql://postgres:password123@db.neon.tech/main")
    );

    const req = createMockRequest("http://localhost/api/dapodik/ingest?mode=commit", {
      method: "POST",
      body: sampleBody,
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe("Gagal memproses data Dapodik pada database. Silakan coba beberapa saat lagi.");
    expect(json.error).not.toContain("password123");
    expect(json.error).not.toContain("neon.tech");
    expect(json.error).not.toContain("PrismaClientKnownRequestError");
  });
});

describe("GET /api/dapodik/ingest", () => {
  it("mengembalikan 405 JSON instruksi", async () => {
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(405);
    expect(json.error).toContain("Gunakan POST dari aplikasi jembatan");
  });
});
