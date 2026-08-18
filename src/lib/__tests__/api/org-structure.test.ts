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
import {
  GET as GET_DETAIL,
  PUT,
  DELETE,
} from "@/app/api/org-structure/[id]/route";

const entry = {
  id: "org-1",
  name: "Nawawi Hamzah",
  position: "Kepala Sekolah",
  photo: null,
  nuptk: "1345752663130001",
  nip: "196806121994031002",
  nik: "7371011206680001",
  bio: "Memimpin SDN Unggulan Mongisidi 1 sejak 2019.",
  contact: "kepala.sekolah@mongisidi1.sch.id",
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
      // Identitas (NUPTK/NIP/NIK) tidak boleh bocor ke publik — tetapi bio
      // dan kontak JUSTRU publik (modal detail profil).
      expect(data.items[0]).not.toHaveProperty("nuptk");
      expect(data.items[0]).not.toHaveProperty("nip");
      expect(data.items[0]).not.toHaveProperty("nik");
      expect(data.items[0].bio).toBe("Memimpin SDN Unggulan Mongisidi 1 sejak 2019.");
      expect(data.items[0].contact).toBe("kepala.sekolah@mongisidi1.sch.id");
    });

    it("returns identifiers only for scope=admin (auth)", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.orgStructure.count.mockResolvedValue(1);
      mockPrisma.orgStructure.findMany.mockResolvedValue([entry]);

      const req = createMockRequest("http://localhost/api/org-structure?scope=admin");
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.items[0].nuptk).toBe("1345752663130001");
      expect(data.items[0].nip).toBe("196806121994031002");
      expect(data.items[0].nik).toBe("7371011206680001");
    });

    it("paginates scope=admin with page/limit and filters by q", async () => {
      mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
      mockPrisma.orgStructure.count.mockResolvedValue(23);
      mockPrisma.orgStructure.findMany.mockResolvedValue([entry]);

      const req = createMockRequest(
        "http://localhost/api/org-structure?scope=admin&page=3&limit=10&q=Kepala"
      );
      const res = await GET(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total).toBe(23);
      expect(data.page).toBe(3);
      expect(data.limit).toBe(10);
      expect(data.totalPages).toBe(3);
      expect(mockPrisma.orgStructure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
      expect(mockPrisma.orgStructure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ name: { contains: "Kepala" } }, { position: { contains: "Kepala" } }],
          },
        })
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
        body: {
          name: "Nawawi Hamzah",
          position: "Kepala Sekolah",
          bio: "Memimpin sejak 2019.",
          contact: "kepala.sekolah@mongisidi1.sch.id",
          order: 0,
          isActive: true,
        },
      });
      const res = await POST(asNextRequest(req));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.name).toBe("Nawawi Hamzah");
      expect(mockPrisma.orgStructure.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bio: "Memimpin sejak 2019.",
            contact: "kepala.sekolah@mongisidi1.sch.id",
          }),
        })
      );
    });
  });

  describe("GET /api/org-structure/[id]", () => {
    it("returns detail without identifiers for public", async () => {
      mockPrisma.orgStructure.findUnique.mockResolvedValue(entry);

      const req = createMockRequest("http://localhost/api/org-structure/org-1");
      const res = await GET_DETAIL(asNextRequest(req), {
        params: Promise.resolve({ id: "org-1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.item.name).toBe("Nawawi Hamzah");
      expect(data.item).not.toHaveProperty("nuptk");
      expect(data.item).not.toHaveProperty("nip");
      expect(data.item).not.toHaveProperty("nik");
      // Bio/kontak tetap ikut detail publik (konten modal, bukan identitas).
      expect(data.item.bio).toBe("Memimpin SDN Unggulan Mongisidi 1 sejak 2019.");
      expect(data.item.contact).toBe("kepala.sekolah@mongisidi1.sch.id");
    });

    it("returns 404 for inactive entry", async () => {
      mockPrisma.orgStructure.findUnique.mockResolvedValue({
        ...entry,
        isActive: false,
      });

      const req = createMockRequest("http://localhost/api/org-structure/org-1");
      const res = await GET_DETAIL(asNextRequest(req), {
        params: Promise.resolve({ id: "org-1" }),
      });
      expect(res.status).toBe(404);
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
        body: {
          position: "Wakil Kepala Sekolah",
          bio: "Profil baru.",
          contact: "wakasek@mongisidi1.sch.id",
        },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "org-1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.position).toBe("Wakil Kepala Sekolah");
      expect(mockPrisma.orgStructure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bio: "Profil baru.",
            contact: "wakasek@mongisidi1.sch.id",
          }),
        })
      );
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