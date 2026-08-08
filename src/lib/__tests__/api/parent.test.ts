import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockPrisma,
  createMockRequest,
  createMockUser,
  asNextRequest,
} from "../test-utils";

const mockRequireParent = vi.fn();
const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireParent: (...args: unknown[]) => mockRequireParent(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

import { GET as GET_OVERVIEW } from "@/app/api/parent/route";
import { GET as GET_ATTENDANCE } from "@/app/api/parent/attendance/route";
import { GET as GET_STUDENTS } from "@/app/api/students/route";

function makeStudent(id: string, name: string) {
  return {
    id,
    nisn: "3206314419",
    name,
    gender: "LAKI_LAKI",
    parentName: "Orang Tua Contoh",
    class: { name: "5A", grade: "5", academicYear: "2025/2026" },
  };
}

function makeAttendance(id: string, status: string, date: Date) {
  return {
    id,
    status,
    date,
    note: null,
  };
}

describe("/api/parent (Portal Orang Tua)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/parent (overview)", () => {
    it("rejects when not linked to a student", async () => {
      mockRequireParent.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Akun belum ditautkan" }), {
          status: 403,
        }),
      });
      const res = await GET_OVERVIEW();
      expect(res.status).toBe(403);
    });

    it("returns 404 when the linked student no longer exists", async () => {
      mockRequireParent.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "ORANG_TUA", guardianStudentId: "s1" }),
        studentId: "s1",
      });
      mockPrisma.student.findUnique.mockResolvedValue(null);
      const res = await GET_OVERVIEW();
      expect(res.status).toBe(404);
    });

    it("returns student info + attendance summary scoped to the student", async () => {
      const user = createMockUser({ role: "ORANG_TUA", guardianStudentId: "s1" });
      mockRequireParent.mockResolvedValue({ ok: true, user, studentId: "s1" });
      mockPrisma.student.findUnique.mockResolvedValue(makeStudent("s1", "Andi Arsyad"));
      mockPrisma.attendance.findMany.mockResolvedValue([
        makeAttendance("a1", "HADIR", new Date(2026, 7, 1)),
        makeAttendance("a2", "HADIR", new Date(2026, 7, 2)),
        makeAttendance("a3", "SAKIT", new Date(2026, 7, 3)),
      ]);

      const res = await GET_OVERVIEW();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.student.name).toBe("Andi Arsyad");
      expect(data.student.nisn).toBe("3206314419");
      expect(data.student.className).toBe("5A");
      expect(data.attendance.total).toBe(3);
      expect(data.attendance.summary).toEqual({ HADIR: 2, SAKIT: 1 });
      // Scoping: query hanya untuk studentId milik akun.
      expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: "s1" }) })
      );
    });
  });

  describe("hardening: ORANG_TUA ditolak dari data admin", () => {
    it("GET /api/students returns 403 for ORANG_TUA (requireRole GURU)", async () => {
      // Route students memakai requireRole("GURU") — ORANG_TUA level 0 harus 403.
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
        }),
      });
      const req = createMockRequest("http://localhost/api/students");
      const res = await GET_STUDENTS(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("GET /api/students allows GURU+ roles", async () => {
      mockRequireRole.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "GURU" }),
      });
      mockPrisma.student.count.mockResolvedValue(0);
      mockPrisma.student.findMany.mockResolvedValue([]);
      const req = createMockRequest("http://localhost/api/students");
      const res = await GET_STUDENTS(asNextRequest(req));
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/parent/attendance (riwayat)", () => {
    it("rejects non-parent role", async () => {
      mockRequireParent.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });
      const req = createMockRequest("http://localhost/api/parent/attendance");
      const res = await GET_ATTENDANCE(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("filters by requested month and scopes to the student", async () => {
      const user = createMockUser({ role: "ORANG_TUA", guardianStudentId: "s1" });
      mockRequireParent.mockResolvedValue({ ok: true, user, studentId: "s1" });
      mockPrisma.attendance.findMany.mockResolvedValue([
        makeAttendance("a1", "HADIR", new Date(2026, 2, 10)),
        makeAttendance("a2", "IZIN", new Date(2026, 2, 11)),
      ]);

      const req = createMockRequest(
        "http://localhost/api/parent/attendance?month=2026-03"
      );
      const res = await GET_ATTENDANCE(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.monthLabel).toContain("Maret");
      expect(data.items).toHaveLength(2);
      expect(data.summary).toEqual({ HADIR: 1, IZIN: 1 });
      const call = mockPrisma.attendance.findMany.mock.calls[0][0];
      expect(call.where.studentId).toBe("s1");
      // Rentang tanggal = 1 Maret s.d. 31 Maret 2026 (exclusive end 1 April).
      // Dibangun dengan Date lokal yang sama dengan route handler.
      expect(call.where.date.gte.toISOString()).toBe(
        new Date(2026, 2, 1).toISOString()
      );
      expect(call.where.date.lt.toISOString()).toBe(
        new Date(2026, 3, 1).toISOString()
      );
    });
  });
});
