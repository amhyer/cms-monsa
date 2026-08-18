import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockRequireRole = vi.fn();
const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

import { GET, POST } from "@/app/api/achievements/route";
import { PUT, DELETE } from "@/app/api/achievements/[id]/route";

const achievement = {
  id: "ach-1",
  title: "Juara 2 Olimpiade Matematika",
  description: null,
  studentName: "Bima Arya Saputra",
  studentId: "stu-1",
  level: "Provinsi",
  category: "Akademik",
  date: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const student = { id: "stu-1", nis: "20260002", nisn: "0123456782" };

describe("/api/achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/achievements", () => {
    it("flattens linked student identifiers into items (publik maupun admin)", async () => {
      mockPrisma.achievement.count.mockResolvedValue(1);
      mockPrisma.achievement.findMany.mockResolvedValue([
        { ...achievement, student },
      ]);

      const req = createMockRequest("http://localhost/api/achievements");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toMatchObject({
        id: "ach-1",
        studentNis: "20260002",
        studentNisn: "0123456782",
      });
      expect(data.items[0]).not.toHaveProperty("student");
      expect(mockPrisma.achievement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { student: { select: { nis: true, nisn: true } } },
        })
      );
    });

    it("returns null identifiers when no student is linked", async () => {
      mockPrisma.achievement.count.mockResolvedValue(1);
      mockPrisma.achievement.findMany.mockResolvedValue([
        { ...achievement, studentId: null, student: null },
      ]);

      const req = createMockRequest("http://localhost/api/achievements");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(data.items[0]).toMatchObject({
        studentId: null,
        studentNis: null,
        studentNisn: null,
      });
    });
  });

  describe("POST /api/achievements", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/achievements", {
        method: "POST",
        body: { title: "Juara 1" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("rejects empty title", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const req = createMockRequest("http://localhost/api/achievements", {
        method: "POST",
        body: { title: "  " },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("rejects unknown studentId", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.student.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/achievements", {
        method: "POST",
        body: { title: "Juara 1", studentId: "missing" },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Siswa tidak ditemukan.");
    });

    it("creates with a valid linked student", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.student.findUnique.mockResolvedValue(student);
      mockPrisma.achievement.create.mockResolvedValue(achievement);

      const req = createMockRequest("http://localhost/api/achievements", {
        method: "POST",
        body: { title: "Juara 2 Olimpiade Matematika", studentId: "stu-1" },
      });
      const res = await POST(asNextRequest(req));

      expect(res.status).toBe(200);
      expect(mockPrisma.achievement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: "stu-1" }),
        })
      );
    });

    it("creates team achievements without a student", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.achievement.create.mockResolvedValue({
        ...achievement,
        studentId: null,
      });

      const req = createMockRequest("http://localhost/api/achievements", {
        method: "POST",
        body: { title: "Juara Umum Drumband", studentName: "Tim Monsa Jaya" },
      });
      const res = await POST(asNextRequest(req));

      expect(res.status).toBe(200);
      expect(mockPrisma.achievement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: null }),
        })
      );
    });
  });

  describe("PUT /api/achievements/[id]", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/achievements/ach-1", {
        method: "PUT",
        body: { title: "Baru" },
      });
      const res = await PUT(asNextRequest(req), {
        params: Promise.resolve({ id: "ach-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 when achievement does not exist", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.achievement.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/achievements/missing", {
        method: "PUT",
        body: { title: "X" },
      });
      const res = await PUT(asNextRequest(req), {
        params: Promise.resolve({ id: "missing" }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects unknown studentId on update", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.achievement.findUnique.mockResolvedValue(achievement);
      mockPrisma.student.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/achievements/ach-1", {
        method: "PUT",
        body: { studentId: "missing" },
      });
      const res = await PUT(asNextRequest(req), {
        params: Promise.resolve({ id: "ach-1" }),
      });
      expect(res.status).toBe(400);
    });

    it("clears the student link when studentId is null", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.achievement.findUnique.mockResolvedValue(achievement);
      mockPrisma.achievement.update.mockResolvedValue({
        ...achievement,
        studentId: null,
      });

      const req = createMockRequest("http://localhost/api/achievements/ach-1", {
        method: "PUT",
        body: { studentId: null },
      });
      const res = await PUT(asNextRequest(req), {
        params: Promise.resolve({ id: "ach-1" }),
      });

      expect(res.status).toBe(200);
      expect(mockPrisma.achievement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: null }),
        })
      );
    });
  });

  describe("DELETE /api/achievements/[id]", () => {
    it("deletes existing achievement", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.achievement.findUnique.mockResolvedValue(achievement);
      mockPrisma.achievement.delete.mockResolvedValue(achievement);

      const req = createMockRequest("http://localhost/api/achievements/ach-1", {
        method: "DELETE",
      });
      const res = await DELETE(asNextRequest(req), {
        params: Promise.resolve({ id: "ach-1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });
});
