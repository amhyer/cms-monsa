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

import { GET, POST } from "@/app/api/complaints/route";

describe("/api/complaints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/complaints", () => {
    it("returns complaints for admin scope", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const mockData = [
        {
          id: "1",
          name: "Pelapor",
          email: "reporter@test.com",
          phone: "08123456789",
          role: "Orang Tua",
          category: "Akademik",
          subject: "Keluhan",
          message: "Isi keluhan",
          isAnonymous: false,
          status: "BARU",
          priority: "NORMAL",
          response: null,
          responseBy: null,
          respondedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.complaint.findMany.mockResolvedValue(mockData);

      const req = createMockRequest("http://localhost/api/complaints?scope=admin");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
    });

    it("requires auth for admin scope", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const req = createMockRequest("http://localhost/api/complaints?scope=admin");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/complaints", () => {
    it("allows public submission without auth", async () => {
      const created = {
        id: "new-id",
        name: "Pelapor",
        email: "reporter@test.com",
        phone: "08123456789",
        role: "Orang Tua",
        category: "Akademik",
        subject: "Keluhan Saya",
        message: "Isi keluhan detail",
        isAnonymous: false,
        status: "BARU",
        priority: "NORMAL",
        response: null,
        responseBy: null,
        respondedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.complaint.create.mockResolvedValue(created);

      const req = createMockRequest("http://localhost/api/complaints", {
        method: "POST",
        body: {
          name: "Pelapor",
          email: "reporter@test.com",
          phone: "08123456789",
          role: "Orang Tua",
          category: "Akademik",
          subject: "Keluhan Saya",
          message: "Isi keluhan detail",
        },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.id).toBeTruthy();
    });

    it("returns 400 when required fields are missing", async () => {
      const req = createMockRequest("http://localhost/api/complaints", {
        method: "POST",
        body: { name: "Test" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });
  });
});
