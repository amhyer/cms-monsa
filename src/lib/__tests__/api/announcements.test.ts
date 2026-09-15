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

    it("exposes items with isActive on every scope (kontrak ticker + manager)", async () => {
      mockPrisma.schoolAnnouncement.findMany.mockResolvedValue([
        {
          id: "1",
          title: "Publik",
          isPublished: true,
          isPinned: false,
          expiresAt: null,
        },
      ]);
      mockPrisma.schoolAnnouncement.groupBy.mockResolvedValue([]);

      const req = createMockRequest("http://localhost/api/announcements");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].isActive).toBe(true);
    });

    it("scope=admin returns drafts with isActive mapping for OPERATOR", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.schoolAnnouncement.findMany.mockResolvedValue([
        {
          id: "1",
          title: "Publik",
          isPublished: true,
          isPinned: false,
          expiresAt: null,
        },
        {
          id: "2",
          title: "Draft",
          isPublished: false,
          isPinned: false,
          expiresAt: null,
        },
      ]);
      mockPrisma.schoolAnnouncement.groupBy.mockResolvedValue([]);

      const req = createMockRequest(
        "http://localhost/api/announcements?scope=admin"
      );
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(2);
      expect(data.items[0].isActive).toBe(true);
      expect(data.items[1].isActive).toBe(false);
    });

    it("scope=admin requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
        }),
      });

      const req = createMockRequest(
        "http://localhost/api/announcements?scope=admin"
      );
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(403);
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

    it("maps isActive=false to unpublished draft", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });
      mockPrisma.schoolAnnouncement.create.mockResolvedValue({
        id: "draft-id",
        title: "Draft",
        isPublished: false,
      });

      const req = createMockRequest("http://localhost/api/announcements", {
        method: "POST",
        body: { title: "Draft", content: "Isi", isActive: false },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(201);
      expect(mockPrisma.schoolAnnouncement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPublished: false }),
        })
      );
    });
  });
});
