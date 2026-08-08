import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

import { POST } from "@/app/api/payments/send-whatsapp/route";

function makeStudent(id: string, name: string, parentPhone: string | null) {
  return {
    id,
    name,
    parentPhone,
    isActive: true,
  };
}

describe("POST /api/payments/send-whatsapp", () => {
  const originalEnv = process.env.FONNTE_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: true, id: "wa-x" }),
      })
    );
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv === undefined) delete process.env.FONNTE_TOKEN;
    else process.env.FONNTE_TOKEN = originalEnv;
  });

  it("menolak format monthPeriod yang tidak valid", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    const req = createMockRequest("http://localhost/api/payments/send-whatsapp", {
      method: "POST",
      body: { monthPeriod: "07-2026" },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("dry-run menghitung penerima unik per nomor (format 08xx dinormalisasi)", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    // s1 sudah bayar; s2 & s3 belum bayar tapi berbagi nomor yang sama (format beda);
    // s4 nomor tidak valid → dilewati. Penerima unik = 1.
    mockPrisma.student.findMany.mockResolvedValue([
      makeStudent("s1", "Andi", "081234567890"),
      makeStudent("s2", "Budi", "081234567891"),
      makeStudent("s3", "Citra", "0812-3456-7891"),
      makeStudent("s4", "Dedi", "abc-invalid"),
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([
      { studentId: "s1" },
    ]);

    const req = createMockRequest("http://localhost/api/payments/send-whatsapp", {
      method: "POST",
      body: { monthPeriod: "2026-07", dryRun: true },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dryRun).toBe(true);
    expect(data.recipients).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mengirim pengingat ke nomor orang tua siswa belum bayar", async () => {
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockPrisma.student.findMany.mockResolvedValue([
      makeStudent("s1", "Andi", "081234567890"), // sudah bayar → tidak dikirim
      makeStudent("s2", "Budi", "081234567891"), // belum bayar → dikirim
      makeStudent("s3", "Citra", null), // tanpa nomor → dilewati
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([{ studentId: "s1" }]);

    const req = createMockRequest("http://localhost/api/payments/send-whatsapp", {
      method: "POST",
      body: { monthPeriod: "2026-07" },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sent).toBe(1);
    expect(data.recipients).toBe(1);

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][1].body)).toContain("target=6281234567891");
    // pesan menyertakan periode & nama siswa
    const body = String(calls[0][1].body);
    expect(body).toContain("message=");
    expect(decodeURIComponent(body.replace(/\+/g, " "))).toContain("Juli 2026");
    expect(decodeURIComponent(body.replace(/\+/g, " "))).toContain("Budi");
  });

  it("mengembalikan 404 jika classId tidak ditemukan", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findUnique.mockResolvedValue(null);

    const req = createMockRequest("http://localhost/api/payments/send-whatsapp", {
      method: "POST",
      body: { monthPeriod: "2026-07", classId: "ghost" },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(404);
  });

  it("membatasi penerima ke kelas tertentu bila classId diberikan", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findUnique.mockResolvedValue({ id: "c1" });
    mockPrisma.student.findMany.mockResolvedValue([
      makeStudent("s2", "Budi", "081234567891"),
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const req = createMockRequest("http://localhost/api/payments/send-whatsapp", {
      method: "POST",
      body: { monthPeriod: "2026-07", classId: "c1", dryRun: true },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recipients).toBe(1);
    expect(mockPrisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ classId: "c1" }) })
    );
  });

  it("mengembalikan 0 penerima jika tidak ada nomor valid", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.student.findMany.mockResolvedValue([
      makeStudent("s1", "Andi", null),
      makeStudent("s2", "Budi", "abc"),
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const req = createMockRequest("http://localhost/api/payments/send-whatsapp", {
      method: "POST",
      body: { monthPeriod: "2026-07" },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recipients).toBe(0);
    expect(data.sent).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
