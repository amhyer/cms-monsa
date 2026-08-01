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
    mockPrisma.student.findUnique.mockResolvedValue(null);
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
    mockPrisma.student.findUnique
      .mockResolvedValueOnce(null) // NIS 1 → create
      .mockResolvedValueOnce({ id: "s2" }); // NIS 2 → update
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
});
