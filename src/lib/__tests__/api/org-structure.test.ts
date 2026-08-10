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

import { GET, POST } from "@/app/api/org-structure/route";
import { PUT, DELETE } from "@/app/api/org-structure/[id]/route";

const entry = {
  id: "org-1",
  name: "Nawawi Hamzah",
  position: "Kepala Sekolah",
  photo: null,
  order: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("/api/org-structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/org-structure", () => {
    it("returns only active entries for public", async () => {
      mockPrisma.orgStructure.findMany.mockResolvedValue([entry]);

      const req = createMockRequest("http://localhost/api/org-structure");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(mockPrisma.orgStructure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      );
    });

    it("requires auth for scope=admin", async () => {
      mockRequireAuth.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const req = createMockRequest("http://localhost/api/org-structure?scope=admin");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/org-structure", () => {
    it("requires SUPER_ADMIN role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/org-structure", {
        method: "POST",
        body: { name: "A", position: "B" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("rejects invalid payload", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const req = createMockRequest("http://localhost/api/org-structure", {
        method: "POST",
        body: { name: "", position: "Kepala Sekolah" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("creates entry with valid data", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.orgStructure.count.mockResolvedValue(0);
      mockPrisma.orgStructure.create.mockResolvedValue(entry);

      const req = createMockRequest("http://localhost/api/org-structure", {
        method: "POST",
        body: { name: "Nawawi Hamzah", position: "Kepala Sekolah", order: 0, isActive: true },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.name).toBe("Nawawi Hamzah");
    });
  });

  describe("PUT /api/org-structure/[id]", () => {
    it("requires SUPER_ADMIN role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/org-structure/org-1", {
        method: "PUT",
        body: { name: "Baru" },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "org-1" }) });
      expect(res.status).toBe(403);
    });

    it("updates existing entry", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.orgStructure.findUnique.mockResolvedValue(entry);
      mockPrisma.orgStructure.update.mockResolvedValue({ ...entry, position: "Wakil Kepala Sekolah" });

      const req = createMockRequest("http://localhost/api/org-structure/org-1", {
        method: "PUT",
        body: { position: "Wakil Kepala Sekolah" },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "org-1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.position).toBe("Wakil Kepala Sekolah");
    });

    it("returns 404 when entry does not exist", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.orgStructure.findUnique.mockResolvedValue(null);

      const req = createMockRequest("http://localhost/api/org-structure/missing", {
        method: "PUT",
        body: { name: "X" },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "missing" }) });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/org-structure/[id]", () => {
    it("deletes existing entry", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.orgStructure.findUnique.mockResolvedValue(entry);
      mockPrisma.orgStructure.delete.mockResolvedValue(entry);

      const req = createMockRequest("http://localhost/api/org-structure/org-1", {
        method: "DELETE",
      });
      const res = await DELETE(asNextRequest(req), { params: Promise.resolve({ id: "org-1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });
});