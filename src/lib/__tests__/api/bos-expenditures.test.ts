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

import { GET, POST } from "@/app/api/bos-expenditures/route";
import { PUT, DELETE } from "@/app/api/bos-expenditures/[id]/route";

const entry = {
  id: "bos-1",
  year: 2026,
  source: "BOS Reguler",
  category: "Honorarium",
  item: "Honorarium guru tidak tetap",
  amount: 24000000,
  quarter: 1,
  note: null,
  recordedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("/api/bos-expenditures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/bos-expenditures", () => {
    it("returns paginated items with summary for public (transparansi)", async () => {
      mockPrisma.bosExpenditure.count.mockResolvedValue(1);
      mockPrisma.bosExpenditure.findMany.mockResolvedValue([entry]);
      mockPrisma.bosExpenditure.aggregate.mockResolvedValue({
        _sum: { amount: 24000000 },
      });
      // groupBy dipanggil dua kali: statistik per tahun, lalu ringkasan per
      // sumber; bosDocument.groupBy (jumlah dokumen per tahun) default [].
      mockPrisma.bosExpenditure.groupBy
        .mockResolvedValueOnce([
          { year: 2026, _count: { _all: 1 }, _sum: { amount: 24000000 } },
        ])
        .mockResolvedValueOnce([
          { source: "BOS Reguler", _sum: { amount: 24000000 } },
        ]);

      const req = createMockRequest("http://localhost/api/bos-expenditures");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].item).toBe("Honorarium guru tidak tetap");
      expect(data.total).toBe(1);
      expect(data.hasMore).toBe(false);
      expect(data.nextCursor).toBeNull();
      expect(data.years).toEqual([2026]);
      expect(data.yearStats).toEqual([
        { year: 2026, count: 1, docs: 0, amount: 24000000 },
      ]);
      expect(data.totalAmount).toBe(24000000);
      expect(data.bySource).toEqual([
        { source: "BOS Reguler", total: 24000000 },
      ]);
    });

    it("filters by year when ?year= diberikan", async () => {
      mockPrisma.bosExpenditure.count.mockResolvedValue(1);
      mockPrisma.bosExpenditure.findMany.mockResolvedValue([entry]);
      mockPrisma.bosExpenditure.aggregate.mockResolvedValue({
        _sum: { amount: 24000000 },
      });
      mockPrisma.bosExpenditure.groupBy.mockResolvedValue([]);

      const req = createMockRequest("http://localhost/api/bos-expenditures?year=2026");
      await GET(asNextRequest(req));

      expect(mockPrisma.bosExpenditure.count).toHaveBeenCalledWith({
        where: { year: 2026 },
      });
      expect(mockPrisma.bosExpenditure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { year: 2026 } })
      );
      expect(mockPrisma.bosExpenditure.aggregate).toHaveBeenCalledWith({
        where: { year: 2026 },
        _sum: { amount: true },
      });
    });

    it("paginates with cursor-based pagination", async () => {
      mockPrisma.bosExpenditure.count.mockResolvedValue(23);
      mockPrisma.bosExpenditure.findMany.mockResolvedValue([]);
      mockPrisma.bosExpenditure.aggregate.mockResolvedValue({
        _sum: { amount: 1000000 },
      });
      mockPrisma.bosExpenditure.groupBy.mockResolvedValue([]);

      const req = createMockRequest(
        "http://localhost/api/bos-expenditures?limit=10"
      );
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total).toBe(23);
      expect(mockPrisma.bosExpenditure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 11, orderBy: [{ id: "asc" }] })
      );
    });
  });

  describe("POST /api/bos-expenditures", () => {
    it("requires SUPER_ADMIN role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/bos-expenditures", {
        method: "POST",
        body: { year: 2026, source: "BOS Reguler", category: "Honorarium", item: "A", amount: 1000 },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("rejects invalid payload (nominal nol)", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const req = createMockRequest("http://localhost/api/bos-expenditures", {
        method: "POST",
        body: { year: 2026, source: "BOS Reguler", category: "Honorarium", item: "A", amount: 0 },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("creates entry with valid data", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.bosExpenditure.create.mockResolvedValue(entry);

      const req = createMockRequest("http://localhost/api/bos-expenditures", {
        method: "POST",
        body: {
          year: 2026,
          source: "BOS Reguler",
          category: "Honorarium",
          item: "Honorarium guru tidak tetap",
          amount: 24000000,
          quarter: 1,
        },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.item).toBe("Honorarium guru tidak tetap");
      expect(mockPrisma.bosExpenditure.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordedById: user.id,
            amount: 24000000,
          }),
        })
      );
    });
  });

  describe("PUT /api/bos-expenditures/[id]", () => {
    it("requires SUPER_ADMIN role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/bos-expenditures/bos-1", {
        method: "PUT",
        body: { item: "Baru" },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "bos-1" }) });
      expect(res.status).toBe(403);
    });

    it("updates existing entry", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.bosExpenditure.findUnique.mockResolvedValue(entry);
      mockPrisma.bosExpenditure.update.mockResolvedValue({ ...entry, item: "Honorarium baru" });

      const req = createMockRequest("http://localhost/api/bos-expenditures/bos-1", {
        method: "PUT",
        body: { item: "Honorarium baru" },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "bos-1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.item).toBe("Honorarium baru");
    });

    it("returns 404 when entry does not exist", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.bosExpenditure.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/bos-expenditures/missing", {
        method: "PUT",
        body: { item: "X" },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "missing" }) });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/bos-expenditures/[id]", () => {
    it("deletes existing entry", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.bosExpenditure.findUnique.mockResolvedValue(entry);
      mockPrisma.bosExpenditure.delete.mockResolvedValue(entry);

      const req = createMockRequest("http://localhost/api/bos-expenditures/bos-1", {
        method: "DELETE",
      });
      const res = await DELETE(asNextRequest(req), { params: Promise.resolve({ id: "bos-1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });
});
