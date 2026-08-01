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

import { GET, POST } from "@/app/api/gallery/route";

describe("/api/gallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/gallery", () => {
    it("returns gallery items for public", async () => {
      const mockData = [
        {
          id: "1",
          title: "Photo",
          description: "Description",
          type: "PHOTO",
          url: "https://example.com/photo.jpg",
          thumbnail: null,
          category: "Kegiatan",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.galleryItem.findMany.mockResolvedValue(mockData);

      const req = createMockRequest("http://localhost/api/gallery?scope=public");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
    });
  });

  describe("POST /api/gallery", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/gallery", {
        method: "POST",
        body: { title: "Photo", url: "https://example.com/photo.jpg" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("creates gallery item with valid data", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const created = {
        id: "new-id",
        title: "New Photo",
        description: null,
        type: "PHOTO",
        url: "https://example.com/photo.jpg",
        thumbnail: null,
        category: "Kegiatan",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.galleryItem.create.mockResolvedValue(created);

      const req = createMockRequest("http://localhost/api/gallery", {
        method: "POST",
        body: {
          title: "New Photo",
          type: "PHOTO",
          url: "https://example.com/photo.jpg",
          category: "Kegiatan",
        },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe("New Photo");
    });
  });
});
