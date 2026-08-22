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

import { GET } from "@/app/api/activity-logs/route";

describe("/api/activity-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  describe("GET /api/activity-logs", () => {
    it("requires SUPER_ADMIN role", async () => {
      mockRequireRole.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = createMockRequest("http://localhost/api/activity-logs");
      const res = await GET(asNextRequest(req));
      expect(res.status).toBe(403);
    });

    it("returns paginated activity logs", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });

      const mockLogs = [
        {
          id: "log1",
          userId: "u1",
          userName: "Admin",
          action: "CREATE",
          entity: "News",
          entityId: "n1",
          detail: "Created news",
          createdAt: new Date(),
        },
      ];

      mockPrisma.activityLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.activityLog.count.mockResolvedValue(1);

      const req = createMockRequest("http://localhost/api/activity-logs?page=1&limit=20");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(20);
      expect(data.totalPages).toBe(1);
    });

    it("filters by entity", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/activity-logs?entity=News");
      await GET(asNextRequest(req));

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entity: "News" },
        })
      );
    });

    it("returns all logs when no entity filter", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/activity-logs");
      await GET(asNextRequest(req));

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it("respects limit cap of 100", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/activity-logs?limit=500");
      await GET(asNextRequest(req));

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it("enforces minimum limit of 1", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/activity-logs?limit=0");
      await GET(asNextRequest(req));

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
    });

    it("defaults to page 1 and limit 20", async () => {
      mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      const req = createMockRequest("http://localhost/api/activity-logs");
      await GET(asNextRequest(req));

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });
  });
});
