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

import { GET, POST } from "@/app/api/attendances/route";
import { POST as POST_BULK } from "@/app/api/attendances/bulk/route";

const MOCK_CLASS = { id: "c1", name: "1A", grade: 1, year: "2026-2027" };

function makeStudent(id: string, name: string, classId = "c1") {
  return {
    id,
    nis: `N-${id}`,
    nisn: null,
    name,
    gender: "L",
    parentName: null,
    classId,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRecord(studentId: string, status = "HADIR") {
  return {
    id: `a-${studentId}`,
    studentId,
    classId: "c1",
    date: new Date(2026, 6, 15, 12, 0, 0),
    status,
    note: null,
    createdById: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("/api/attendances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
    mockPrisma.class.findUnique.mockResolvedValue(MOCK_CLASS);
  });

  describe("GET /api/attendances", () => {
    it("requires authentication", async () => {
      mockRequireAuth.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const req = createMockRequest("http://localhost/api/attendances?classId=c1&date=2026-07-15");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(401);
    });

    it("rejects missing classId", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      const req = createMockRequest("http://localhost/api/attendances?date=2026-07-15");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("rejects invalid date format", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      const req = createMockRequest("http://localhost/api/attendances?classId=c1&date=2026/07/15");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("returns 404 when class does not exist", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.class.findUnique.mockResolvedValue(null);
      const req = createMockRequest("http://localhost/api/attendances?classId=ghost&date=2026-07-15");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(404);
    });

    it("returns students with merged attendance records", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.student.findMany.mockResolvedValue([
        makeStudent("s1", "Andi"),
        makeStudent("s2", "Budi"),
      ]);
      mockPrisma.attendance.findMany.mockResolvedValue([
        makeRecord("s1", "SAKIT"),
      ]);

      const req = createMockRequest("http://localhost/api/attendances?classId=c1&date=2026-07-15");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(2);
      expect(data.items[0].status).toBe("SAKIT");
      expect(data.items[0].attendanceId).toBe("a-s1");
      expect(data.items[1].status).toBeNull();
      expect(data.items[1].attendanceId).toBeNull();
    });
  });

  describe("POST /api/attendances", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/attendances", {
        method: "POST",
        body: { studentId: "s1", classId: "c1", date: "2026-07-15", status: "HADIR" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("rejects invalid status", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const req = createMockRequest("http://localhost/api/attendances", {
        method: "POST",
        body: { studentId: "s1", classId: "c1", date: "2026-07-15", status: "LIBUR" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("rejects student not in class", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.student.findUnique.mockResolvedValue(makeStudent("s9", "Deni", "c2"));

      const req = createMockRequest("http://localhost/api/attendances", {
        method: "POST",
        body: { studentId: "s9", classId: "c1", date: "2026-07-15", status: "HADIR" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(404);
    });

    it("creates attendance via upsert", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.student.findUnique.mockResolvedValue(makeStudent("s1", "Andi"));
      const saved = makeRecord("s1", "HADIR");
      mockPrisma.attendance.upsert.mockResolvedValue(saved);

      const req = createMockRequest("http://localhost/api/attendances", {
        method: "POST",
        body: { studentId: "s1", classId: "c1", date: "2026-07-15", status: "HADIR" },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("HADIR");
      expect(mockPrisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId_date: { studentId: "s1", date: expect.any(Date) } },
          create: expect.objectContaining({ createdById: user.id }),
        })
      );
    });
  });

  describe("GURU role scope", () => {
    it("GET rejects GURU accessing a class outside their wali class", async () => {
      mockRequireAuth.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "GURU", guardianClassId: "c2" }),
      });
      mockPrisma.class.findUnique.mockResolvedValue(MOCK_CLASS);

      const req = createMockRequest("http://localhost/api/attendances?classId=c1&date=2026-07-15");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("GET allows GURU for their own wali class", async () => {
      mockRequireAuth.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "GURU", guardianClassId: "c1" }),
      });
      mockPrisma.class.findUnique.mockResolvedValue(MOCK_CLASS);
      mockPrisma.student.findMany.mockResolvedValue([makeStudent("s1", "Andi")]);
      mockPrisma.attendance.findMany.mockResolvedValue([]);

      const req = createMockRequest("http://localhost/api/attendances?classId=c1&date=2026-07-15");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(200);
    });

    it("POST rejects GURU for a class outside their wali class", async () => {
      mockRequireRole.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "GURU", guardianClassId: "c2" }),
      });

      const req = createMockRequest("http://localhost/api/attendances", {
        method: "POST",
        body: { studentId: "s1", classId: "c1", date: "2026-07-15", status: "HADIR" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("bulk rejects GURU for a class outside their wali class", async () => {
      mockRequireRole.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "GURU", guardianClassId: "c2" }),
      });

      const req = createMockRequest("http://localhost/api/attendances/bulk", {
        method: "POST",
        body: {
          classId: "c1",
          date: "2026-07-15",
          records: [{ studentId: "s1", status: "HADIR" }],
        },
      });
      const res = await POST_BULK(asNextRequest(req));
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/attendances/bulk", () => {
    it("rejects empty records", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const req = createMockRequest("http://localhost/api/attendances/bulk", {
        method: "POST",
        body: { classId: "c1", date: "2026-07-15", records: [] },
      });
      const res = await POST_BULK(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("rejects invalid status in any record", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const req = createMockRequest("http://localhost/api/attendances/bulk", {
        method: "POST",
        body: {
          classId: "c1",
          date: "2026-07-15",
          records: [{ studentId: "s1", status: "HADIR" }, { studentId: "s2", status: "LIBUR" }],
        },
      });
      const res = await POST_BULK(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("rejects student not registered in the class", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.student.findMany.mockResolvedValue([makeStudent("s1", "Andi")]);

      const req = createMockRequest("http://localhost/api/attendances/bulk", {
        method: "POST",
        body: {
          classId: "c1",
          date: "2026-07-15",
          records: [{ studentId: "s1", status: "HADIR" }, { studentId: "s2", status: "IZIN" }],
        },
      });
      const res = await POST_BULK(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("saves all records in a transaction", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.student.findMany.mockResolvedValue([
        makeStudent("s1", "Andi"),
        makeStudent("s2", "Budi"),
      ]);
      const saved = [makeRecord("s1", "HADIR"), makeRecord("s2", "SAKIT")];
      mockPrisma.$transaction.mockResolvedValue(saved);

      const req = createMockRequest("http://localhost/api/attendances/bulk", {
        method: "POST",
        body: {
          classId: "c1",
          date: "2026-07-15",
          records: [
            { studentId: "s1", status: "HADIR" },
            { studentId: "s2", status: "SAKIT", note: "Demam" },
          ],
        },
      });
      const res = await POST_BULK(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.saved).toBe(2);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(data.items[1].studentName).toBe("Budi");
    });
  });
});
