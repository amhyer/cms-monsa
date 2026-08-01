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

import { GET, POST } from "@/app/api/teachers/route";

describe("/api/teachers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/teachers", () => {
    it("returns active teachers for public", async () => {
      const mockData = [
        {
          id: "1",
          name: "Pak Budi",
          position: "Guru Matematika",
          subject: "Matematika",
          education: "S.Pd",
          photo: null,
          order: 1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.teacher.findMany.mockResolvedValue(mockData);

      const req = createMockRequest("http://localhost/api/teachers?scope=public");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
    });
  });

  describe("POST /api/teachers", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/teachers", {
        method: "POST",
        body: { name: "Guru Baru", position: "Guru" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("creates teacher with valid data", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const created = {
        id: "new-id",
        name: "Pak Baru",
        position: "Guru IPA",
        subject: "IPA",
        education: "S.Pd",
        photo: null,
        order: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.teacher.create.mockResolvedValue(created);

      const req = createMockRequest("http://localhost/api/teachers", {
        method: "POST",
        body: {
          name: "Pak Baru",
          position: "Guru IPA",
          subject: "IPA",
          education: "S.Pd",
        },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.name).toBe("Pak Baru");
    });
  });
});
