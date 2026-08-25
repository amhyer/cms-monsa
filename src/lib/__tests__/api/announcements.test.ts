import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockRequireAuth = vi.fn();
const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

import { GET, POST } from "@/app/api/announcements/route";

describe("/api/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/announcements", () => {
    it("returns active announcements for public", async () => {
      const mockData = [
        {
          id: "1",
          title: "Pengumuman",
          content: "Isi pengumuman",
          isPinned: true,
          expiresAt: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.schoolAnnouncement.findMany.mockResolvedValue(mockData);
      mockPrisma.schoolAnnouncement.groupBy.mockResolvedValue([]);

      const req = createMockRequest("http://localhost/api/announcements");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.announcements).toHaveLength(1);
    });

    it("returns empty list when no announcements exist", async () => {
      mockPrisma.schoolAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.schoolAnnouncement.groupBy.mockResolvedValue([]);

      const req = createMockRequest("http://localhost/api/announcements");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.announcements).toHaveLength(0);
    });
  });

  describe("POST /api/announcements", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/announcements", {
        method: "POST",
        body: { title: "Test", content: "Content" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("creates announcement with valid data", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const created = {
        id: "new-id",
        title: "New Announcement",
        content: "Content here",
        isPinned: false,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.schoolAnnouncement.create.mockResolvedValue(created);

      const req = createMockRequest("http://localhost/api/announcements", {
        method: "POST",
        body: { title: "New Announcement", content: "Content here" },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.title).toBe("New Announcement");
    });
  });
});
