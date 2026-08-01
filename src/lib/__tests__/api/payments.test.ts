import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockRequireAuth = vi.fn();
const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

import { GET, POST } from "@/app/api/payments/route";
import { PUT, DELETE } from "@/app/api/payments/[id]/route";

function makeStudent(id: string, name: string) {
  return {
    id,
    nis: `N-${id}`,
    nisn: null,
    name,
    gender: "L",
    parentName: null,
    classId: "c1",
    class: { name: "1A" },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePayment(id: string, studentId: string, amount: number) {
  return {
    id,
    studentId,
    amount,
    paymentDate: new Date(2026, 6, 10, 12, 0, 0),
    monthPeriod: "2026-07",
    status: "PAID",
    note: null,
    recordedById: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
    student: {
      id: studentId,
      nis: `N-${studentId}`,
      name: `Siswa ${studentId}`,
      classId: "c1",
    },
  };
}

describe("/api/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/payments", () => {
    it("rejects invalid monthPeriod format", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      const req = createMockRequest("http://localhost/api/payments?monthPeriod=07-2026");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("returns 404 when class does not exist", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.class.findUnique.mockResolvedValue(null);
      const req = createMockRequest(
        "http://localhost/api/payments?monthPeriod=2026-07&classId=ghost"
      );
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(404);
    });

    it("returns summary, paid and unpaid lists", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.student.findMany.mockResolvedValue([
        makeStudent("s1", "Andi"),
        makeStudent("s2", "Budi"),
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([makePayment("p1", "s1", 50000)]);

      const req = createMockRequest("http://localhost/api/payments?monthPeriod=2026-07");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary).toEqual({
        totalStudents: 2,
        paidCount: 1,
        unpaidCount: 1,
        totalAmount: 50000,
      });
      expect(data.paid[0].studentName).toBe("Siswa s1");
      expect(data.paid[0].amount).toBe(50000);
      expect(data.unpaid).toHaveLength(1);
      expect(data.unpaid[0].name).toBe("Budi");
      expect(data.unpaid[0].className).toBe("1A");
    });
  });

  describe("POST /api/payments", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/payments", {
        method: "POST",
        body: { studentId: "s1", monthPeriod: "2026-07", amount: 50000 },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("rejects non-positive amount", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const req = createMockRequest("http://localhost/api/payments", {
        method: "POST",
        body: { studentId: "s1", monthPeriod: "2026-07", amount: -100 },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("returns 404 when student is not found", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.student.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/payments", {
        method: "POST",
        body: { studentId: "ghost", monthPeriod: "2026-07", amount: 50000 },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(404);
    });

    it("returns 409 when payment already exists for the period", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.student.findUnique.mockResolvedValue({
        id: "s1",
        name: "Andi",
        nis: "N-s1",
      });
      mockPrisma.payment.findFirst.mockResolvedValue(makePayment("p1", "s1", 50000));

      const req = createMockRequest("http://localhost/api/payments", {
        method: "POST",
        body: { studentId: "s1", monthPeriod: "2026-07", amount: 50000 },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(409);
    });

    it("creates a payment record", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.student.findUnique.mockResolvedValue({
        id: "s1",
        name: "Andi",
        nis: "N-s1",
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      const created = makePayment("p1", "s1", 50000);
      mockPrisma.payment.create.mockResolvedValue(created);

      const req = createMockRequest("http://localhost/api/payments", {
        method: "POST",
        body: { studentId: "s1", monthPeriod: "2026-07", amount: 50000, note: "Tunai" },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.amount).toBe(50000);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recordedById: user.id, monthPeriod: "2026-07" }),
        })
      );
    });
  });

  describe("PUT /api/payments/[id]", () => {
    const ctx = { params: Promise.resolve({ id: "p1" }) };

    it("returns 404 when payment is not found", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/payments/p1", {
        method: "PUT",
        body: { amount: 60000 },
      });
      const res = await PUT(asNextRequest(req), ctx as never);
      expect(res.status).toBe(404);
    });

    it("rejects invalid amount", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.payment.findUnique.mockResolvedValue(makePayment("p1", "s1", 50000));

      const req = createMockRequest("http://localhost/api/payments/p1", {
        method: "PUT",
        body: { amount: 0 },
      });
      const res = await PUT(asNextRequest(req), ctx as never);
      expect(res.status).toBe(400);
    });

    it("updates the payment", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.payment.findUnique.mockResolvedValue(makePayment("p1", "s1", 50000));
      mockPrisma.payment.update.mockResolvedValue({ ...makePayment("p1", "s1", 50000), amount: 60000 });

      const req = createMockRequest("http://localhost/api/payments/p1", {
        method: "PUT",
        body: { amount: 60000, note: "Bayar ulang" },
      });
      const res = await PUT(asNextRequest(req), ctx as never);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.amount).toBe(60000);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "p1" }, data: { amount: 60000, note: "Bayar ulang" } })
      );
    });
  });

  describe("DELETE /api/payments/[id]", () => {
    const ctx = { params: Promise.resolve({ id: "p1" }) };

    it("returns 404 when payment is not found", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/payments/p1", { method: "DELETE" });
      const res = await DELETE(asNextRequest(req), ctx as never);
      expect(res.status).toBe(404);
    });

    it("deletes the payment", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.payment.findUnique.mockResolvedValue(makePayment("p1", "s1", 50000));
      mockPrisma.payment.delete.mockResolvedValue({ id: "p1" });

      const req = createMockRequest("http://localhost/api/payments/p1", { method: "DELETE" });
      const res = await DELETE(asNextRequest(req), ctx as never);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockPrisma.payment.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    });
  });
});
