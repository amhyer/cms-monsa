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

import { GET, POST } from "@/app/api/news/route";

describe("/api/news", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/news", () => {
    it("returns published news for public scope", async () => {
      const mockNews = [
        {
          id: "1",
          title: "Test News",
          slug: "test-news",
          excerpt: "Excerpt",
          content: "Content",
          coverImage: null,
          category: "Kegiatan",
          status: "PUBLISHED",
          authorId: "author1",
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { name: "Author Name" },
        },
      ];

      mockPrisma.news.findMany.mockResolvedValue(mockNews);
      mockPrisma.news.count.mockResolvedValue(1);

      const req = createMockRequest("http://localhost/api/news?scope=public");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].authorName).toBe("Author Name");
      expect(data.total).toBe(1);
      expect(data.page).toBe(1);
    });

    it("returns paginated results", async () => {
      mockPrisma.news.findMany.mockResolvedValue([]);
      mockPrisma.news.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/news?scope=public&page=2&limit=5");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
    });

    it("filters by category", async () => {
      mockPrisma.news.findMany.mockResolvedValue([]);
      mockPrisma.news.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/news?scope=public&category=Akademik");
      await GET(asNextRequest(req));

      expect(mockPrisma.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: "Akademik" }),
        })
      );
    });

    it("searches by title", async () => {
      mockPrisma.news.findMany.mockResolvedValue([]);
      mockPrisma.news.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/news?scope=public&search=berita");
      await GET(asNextRequest(req));

      expect(mockPrisma.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: "berita" } },
            ]),
          }),
        })
      );
    });

    it("requires auth for admin scope", async () => {
      mockRequireAuth.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });

      const req = createMockRequest("http://localhost/api/news?scope=admin");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/news", () => {
    it("requires OPERATOR role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/news", {
        method: "POST",
        body: { title: "Test", content: "Content" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("returns 400 when title is empty", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const req = createMockRequest("http://localhost/api/news", {
        method: "POST",
        body: { title: "", content: "Content" },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(400);
    });

    it("creates news with valid data", async () => {
      const user = createMockUser();
      mockRequireRole.mockResolvedValue({ ok: true, user });

      const createdNews = {
        id: "new-id",
        title: "Valid Title",
        slug: "valid-title",
        excerpt: "Excerpt",
        content: "<p>Content</p>",
        coverImage: null,
        category: "Kegiatan",
        status: "DRAFT",
        authorId: user.id,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { name: user.name },
      };

      mockPrisma.news.findUnique.mockResolvedValue(null);
      mockPrisma.news.create.mockResolvedValue(createdNews);

      const req = createMockRequest("http://localhost/api/news", {
        method: "POST",
        body: {
          title: "Valid Title",
          content: "<p>Content</p>",
          excerpt: "Excerpt",
          category: "Kegiatan",
        },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe("Valid Title");
      expect(data.slug).toBe("valid-title");
    });
  });
});
