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

import { GET, POST } from "@/app/api/teachers/route";
import { GET as GET_DETAIL } from "@/app/api/teachers/[id]/route";

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
          nuptk: "1998765432100001",
          nip: "198007152008011001",
          nik: "7371011507800001",
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
      // Identitas (NUPTK/NIP/NIK) tidak boleh bocor ke publik.
      expect(data.items[0]).not.toHaveProperty("nuptk");
      expect(data.items[0]).not.toHaveProperty("nip");
      expect(data.items[0]).not.toHaveProperty("nik");
    });

    it("paginates scope=admin with page/limit and filters by q", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.teacher.count.mockResolvedValue(31);
      mockPrisma.teacher.findMany.mockResolvedValue([]);

      const req = createMockRequest(
        "http://localhost/api/teachers?scope=admin&page=4&limit=10&q=Matematika"
      );
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total).toBe(31);
      expect(data.page).toBe(4);
      expect(data.limit).toBe(10);
      expect(data.totalPages).toBe(4);
      expect(mockPrisma.teacher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 30, take: 10 })
      );
      expect(mockPrisma.teacher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: "Matematika" } },
              { position: { contains: "Matematika" } },
              { subject: { contains: "Matematika" } },
            ],
          },
        })
      );
    });

    it("returns teacher detail without identifiers for public", async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue({
        id: "1",
        name: "Pak Budi",
        position: "Guru Matematika",
        photo: null,
        nuptk: "1998765432100001",
        nip: "198007152008011001",
        nik: "7371011507800001",
        homeroomClasses: [],
        isActive: true,
      });

      const req = createMockRequest("http://localhost/api/teachers/1");
      const res = await GET_DETAIL(asNextRequest(req), {
        params: Promise.resolve({ id: "1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.item.name).toBe("Pak Budi");
      expect(data.item).not.toHaveProperty("nuptk");
      expect(data.item).not.toHaveProperty("nip");
      expect(data.item).not.toHaveProperty("nik");
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
