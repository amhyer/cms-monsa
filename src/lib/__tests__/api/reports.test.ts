import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";
import type { SessionUser } from "@/lib/types";

const mockRequireAuth = vi.fn();
const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  canAccessClass: (user: SessionUser, classId: string) =>
    user.role === "GURU" ? user.guardianClassId === classId : true,
  SESSION_COOKIE: "monsa_session",
}));

import { GET as GET_ATTENDANCE_REPORT } from "@/app/api/attendances/report/route";
import { GET as GET_PAYMENT_REPORT } from "@/app/api/payments/report/route";

describe("/api/attendances/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
    mockPrisma.class.findUnique.mockResolvedValue({ id: "c1", name: "1A" });
  });

  it("requires authentication", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const req = createMockRequest("http://localhost/api/attendances/report?classId=c1&month=2026-07");
    const res = await GET_ATTENDANCE_REPORT(asNextRequest(req));
    expect(res.status).toBe(401);
  });

  it("rejects invalid month format", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
    const req = createMockRequest("http://localhost/api/attendances/report?classId=c1&month=2026/07");
    const res = await GET_ATTENDANCE_REPORT(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("returns 404 when class is not found", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findUnique.mockResolvedValue(null);
    const req = createMockRequest("http://localhost/api/attendances/report?classId=ghost&month=2026-07");
    const res = await GET_ATTENDANCE_REPORT(asNextRequest(req));
    expect(res.status).toBe(404);
  });

  it("rejects GURU reporting on a class outside their wali class", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: true,
      user: createMockUser({ role: "GURU", guardianClassId: "c2" }),
    });
    const req = createMockRequest("http://localhost/api/attendances/report?classId=c1&month=2026-07");
    const res = await GET_ATTENDANCE_REPORT(asNextRequest(req));
    expect(res.status).toBe(403);
  });

  it("aggregates attendance counts and rate per student", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.student.findMany.mockResolvedValue([
      { id: "s1", nis: "1", name: "Andi", gender: "LAKI_LAKI" },
      { id: "s2", nis: "2", name: "Budi", gender: "LAKI_LAKI" },
    ]);
    mockPrisma.attendance.findMany
      .mockResolvedValueOnce([
        { studentId: "s1", status: "HADIR" },
        { studentId: "s1", status: "HADIR" },
        { studentId: "s1", status: "SAKIT" },
        { studentId: "s2", status: "IZIN" },
      ])
      .mockResolvedValueOnce([
        { date: new Date(2026, 6, 1) },
        { date: new Date(2026, 6, 2) },
        { date: new Date(2026, 6, 3) },
      ]);

    const req = createMockRequest("http://localhost/api/attendances/report?classId=c1&month=2026-07");
    const res = await GET_ATTENDANCE_REPORT(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDays).toBe(3);
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({
      name: "Andi",
      counts: { HADIR: 2, SAKIT: 1, IZIN: 0, ALFA: 0 },
      total: 3,
      rate: 67, // 2/3 ≈ 67%
    });
    expect(data.items[1].counts).toEqual({ HADIR: 0, SAKIT: 0, IZIN: 1, ALFA: 0 });
    expect(data.items[1].rate).toBe(0);
  });
});

describe("/api/payments/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  it("requires OPERATOR role (GURU denied)", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });
    const req = createMockRequest("http://localhost/api/payments/report?year=2026");
    const res = await GET_PAYMENT_REPORT(asNextRequest(req));
    expect(res.status).toBe(403);
  });

  it("rejects invalid year format", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    const req = createMockRequest("http://localhost/api/payments/report?year=26");
    const res = await GET_PAYMENT_REPORT(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("groups payments by month and builds summary", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.payment.findMany.mockResolvedValue([
      { id: "p1", amount: 50000, monthPeriod: "2026-01", studentId: "s1" },
      { id: "p2", amount: 50000, monthPeriod: "2026-01", studentId: "s2" },
      { id: "p3", amount: 75000, monthPeriod: "2026-07", studentId: "s1" },
    ]);

    const req = createMockRequest("http://localhost/api/payments/report?year=2026");
    const res = await GET_PAYMENT_REPORT(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.months).toHaveLength(12);
    expect(data.months[0]).toMatchObject({ month: 1, paidCount: 2, totalAmount: 100000 });
    expect(data.months[6]).toMatchObject({ month: 7, paidCount: 1, totalAmount: 75000 });
    expect(data.months[2]).toMatchObject({ month: 3, paidCount: 0, totalAmount: 0 });
    expect(data.summary).toEqual({
      totalPaid: 3,
      totalAmount: 175000,
      distinctStudents: 2,
    });
  });
});
