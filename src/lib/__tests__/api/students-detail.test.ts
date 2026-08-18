import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockPrisma,
  createMockRequest,
  createMockUser,
  asNextRequest,
} from "../test-utils";

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

import { GET } from "@/app/api/students/[id]/route";

const student = {
  id: "stu-1",
  nis: "20260001",
  nisn: "0123456781",
  name: "Aisyah Putri Ramadhani",
  dateOfBirth: new Date("2016-05-14"),
  gender: "P",
  address: "Jl. Monumen 45",
  phone: "081234567890",
  email: "aisyah@example.test",
  parentName: "Budi Ramadhani",
  parentPhone: "081298765432",
  photoUrl: null,
  classId: "c1",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  class: { id: "c1", name: "Kelas 1.a", grade: 1 },
};

function forbidden(role: string) {
  return {
    ok: false as const,
    response: new Response(
      JSON.stringify({ error: `Forbidden. Hak akses tidak mencukupi. (${role})` }),
      { status: 403 }
    ),
  };
}

describe("GET /api/students/[id] — gerbang akses GURU ke atas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GURU dapat membaca data siswa lengkap (termasuk relasi kelas)", async () => {
    mockRequireRole.mockResolvedValue({
      ok: true,
      user: createMockUser({ role: "GURU" }),
    });
    mockPrisma.student.findUnique.mockResolvedValue(student);

    const res = await GET(
      asNextRequest(createMockRequest("http://localhost/api/students/stu-1")),
      { params: Promise.resolve({ id: "stu-1" }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Aisyah Putri Ramadhani");
    expect(data.nis).toBe("20260001");
    expect(data.parentName).toBe("Budi Ramadhani"); // field sensitif ikut serta
    expect(data.class).toEqual({ id: "c1", name: "Kelas 1.a", grade: 1 });
    expect(mockPrisma.student.findUnique).toHaveBeenCalledWith({
      where: { id: "stu-1" },
      include: { class: { select: { id: true, name: true, grade: true } } },
    });
  });

  it("OPERATOR dan SUPER_ADMIN juga boleh (hierarki level >= GURU)", async () => {
    for (const role of ["OPERATOR", "SUPER_ADMIN"] as const) {
      vi.clearAllMocks();
      mockRequireRole.mockResolvedValue({
        ok: true,
        user: createMockUser({ role }),
      });
      mockPrisma.student.findUnique.mockResolvedValue(student);

      const res = await GET(
        asNextRequest(createMockRequest("http://localhost/api/students/stu-1")),
        { params: Promise.resolve({ id: "stu-1" }) }
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.student.findUnique).toHaveBeenCalled();
    }
  });

  it("SISWA ditolak (level 0 di bawah GURU) — DB tidak disentuh", async () => {
    mockRequireRole.mockResolvedValue(forbidden("SISWA"));

    const res = await GET(
      asNextRequest(createMockRequest("http://localhost/api/students/stu-1")),
      { params: Promise.resolve({ id: "stu-1" }) }
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("ORANG_TUA ditolak (level 0) — DB tidak disentuh", async () => {
    mockRequireRole.mockResolvedValue(forbidden("ORANG_TUA"));

    const res = await GET(
      asNextRequest(createMockRequest("http://localhost/api/students/stu-1")),
      { params: Promise.resolve({ id: "stu-1" }) }
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("tanpa autentikasi → 401", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      ),
    });

    const res = await GET(
      asNextRequest(createMockRequest("http://localhost/api/students/stu-1")),
      { params: Promise.resolve({ id: "stu-1" }) }
    );

    expect(res.status).toBe(401);
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("siswa tidak ditemukan → 404", async () => {
    mockRequireRole.mockResolvedValue({
      ok: true,
      user: createMockUser({ role: "GURU" }),
    });
    mockPrisma.student.findUnique.mockResolvedValue(null);

    const res = await GET(
      asNextRequest(createMockRequest("http://localhost/api/students/missing")),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Siswa tidak ditemukan.");
  });
});
