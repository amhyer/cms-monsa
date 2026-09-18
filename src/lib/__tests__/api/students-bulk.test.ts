import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  canAccessClass: vi.fn(() => true),
  SESSION_COOKIE: "monsa_session",
}));

import { POST } from "@/app/api/students/bulk/route";

describe("POST /api/students/bulk (import CSV)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  it("requires OPERATOR role", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });
    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: { items: [{ nis: "1", name: "Andi", classId: "c1" }] },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(403);
  });

  it("rejects empty items", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: { items: [] },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("rejects more than 500 records", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    const items = Array.from({ length: 501 }, (_, i) => ({
      nis: `N${i}`,
      name: `Siswa ${i}`,
      classId: "c1",
    }));
    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: { items },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("collects per-row validation errors without aborting valid rows", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findMany.mockResolvedValue([{ id: "c1" }]);
    // Sejak temuan review M4, route mengambil semua kandidat dalam SATU
    // findMany (bukan satu findUnique per baris).
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.student.create.mockResolvedValue({ id: "new" });

    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: {
        items: [
          { nis: "1", name: "Andi", classId: "c1" },
          { nis: "", name: "Kosong", classId: "c1" }, // baris 3: NIS kosong
          { nis: "2", name: "Budi", classId: "c1", gender: "LAKI-LAKI" }, // baris 4: gender salah
          { nis: "3", name: "Cici", classId: "ghost" }, // baris 5: kelas tidak ada
        ],
      },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.errors.map((e: { row: number }) => e.row)).toEqual([3, 4, 5]);
  });

  it("creates new students and updates existing ones by NIS", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findMany.mockResolvedValue([{ id: "c1" }]);
    // Satu findMany mengembalikan siswa yang SUDAH ada. NIS "2" ada → update;
    // NIS "1" tidak muncul di hasil → create.
    mockPrisma.student.findMany.mockResolvedValue([
      { id: "s2", nis: "2", nisn: null, gender: null, parentName: "Lama" },
    ]);
    mockPrisma.student.create.mockResolvedValue({ id: "s1" });
    mockPrisma.student.update.mockResolvedValue({ id: "s2" });

    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: {
        items: [
          { nis: "1", name: "Andi", classId: "c1" },
          { nis: "2", name: "Budi", classId: "c1", parentName: "Ibu Budi" },
        ],
      },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.updated).toBe(1);
    expect(mockPrisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s2" },
        data: expect.objectContaining({ name: "Budi", parentName: "Ibu Budi" }),
      })
    );
  });

  it("membaca semua kandidat dalam SATU query, bukan satu per baris (M4)", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findMany.mockResolvedValue([{ id: "c1" }]);
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.student.create.mockResolvedValue({ id: "new" });

    const items = Array.from({ length: 25 }, (_, i) => ({
      nis: `B${i}`,
      name: `Siswa ${i}`,
      classId: "c1",
    }));
    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: { items },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    // 25 baris → tepat 1 findMany. Sebelumnya 25 findUnique + 25 create
    // sekuensial = 50 round-trip.
    expect(mockPrisma.student.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("membungkus semua tulis dalam SATU transaksi (atomik)", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findMany.mockResolvedValue([{ id: "c1" }]);
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.student.create.mockResolvedValue({ id: "new" });

    const items = Array.from({ length: 10 }, (_, i) => ({
      nis: `T${i}`,
      name: `Siswa ${i}`,
      classId: "c1",
    }));
    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: { items },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const batch = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(batch).toHaveLength(10);
  });

  it("NIS duplikat dalam satu file dilaporkan, tidak di-create dua kali", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.class.findMany.mockResolvedValue([{ id: "c1" }]);
    mockPrisma.student.findMany.mockResolvedValue([]);
    mockPrisma.student.create.mockResolvedValue({ id: "new" });

    const req = createMockRequest("http://localhost/api/students/bulk", {
      method: "POST",
      body: {
        items: [
          { nis: "D1", name: "Versi lama", classId: "c1" },
          { nis: "D2", name: "Unik", classId: "c1" },
          { nis: "D1", name: "Versi baru", classId: "c1" }, // duplikat baris 2
        ],
      },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    // last-write-wins: hanya 2 siswa dibuat, baris yang digantikan dilaporkan
    expect(data.created).toBe(2);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].row).toBe(2); // baris pertama D1 (header = baris 1)
    expect(data.errors[0].error).toContain("D1");
    // Yang menang adalah kemunculan terakhir.
    expect(mockPrisma.student.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nis: "D1", name: "Versi baru" }),
      })
    );
    // Tanpa dedup, dua create dengan NIS sama akan melanggar unique
    // constraint dan me-rollback SELURUH transaksi.
    expect(mockPrisma.student.create).toHaveBeenCalledTimes(2);
  });
});
