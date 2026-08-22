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
  SESSION_COOKIE: "monsa_session",
}));

import { POST } from "@/app/api/bulk/route";

describe("/api/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("POST /api/bulk", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "news", ids: ["1"] },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("returns 400 when entity is missing", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { ids: ["1"] },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("wajib diisi");
    });

    it("returns 400 when ids is empty", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "news", ids: [] },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("returns 400 when ids exceeds 100", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const ids = Array.from({ length: 101 }, (_, i) => String(i));
      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "news", ids },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Maksimal 100");
    });

    it("returns 400 for invalid entity", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "nonexistent", ids: ["1"] },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("tidak valid");
    });

    it("returns 403 when OPERATOR tries to delete students (SUPER_ADMIN only)", async () => {
      mockRequireRole.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "OPERATOR" }),
      });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "students", ids: ["1"] },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("deletes news items successfully", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.news.deleteMany.mockResolvedValue({ count: 2 });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "news", ids: ["n1", "n2"] },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.deleted).toBe(2);
      expect(data.entity).toBe("news");
    });

    it("deletes multiple entities with correct model", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.announcement.deleteMany.mockResolvedValue({ count: 1 });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "announcements", ids: ["a1"] },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deleted).toBe(1);
      expect(data.entity).toBe("announcements");
    });

    it("handles database errors gracefully", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.news.deleteMany.mockRejectedValue(new Error("DB error"));

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "news", ids: ["n1"] },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(500);
    });

    it("allows SUPER_ADMIN to delete students", async () => {
      mockRequireRole.mockResolvedValue({
        ok: true,
        user: createMockUser({ role: "SUPER_ADMIN" }),
      });
      mockPrisma.student.deleteMany.mockResolvedValue({ count: 1 });

      const req = createMockRequest("http://localhost/api/bulk", {
        method: "POST",
        body: { entity: "students", ids: ["s1"] },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deleted).toBe(1);
    });
  });
});
