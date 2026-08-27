import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const { mockRequireRole, mockNotifyComplaintToAdmin } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockNotifyComplaintToAdmin: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));
vi.mock("@/lib/notifications", () => ({
  notifyComplaintToAdmin: (...args: unknown[]) =>
    Promise.resolve(mockNotifyComplaintToAdmin(...args)),
}));

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  emailTemplates: {
    complaintReply: vi.fn((d: { subject: string }) => ({
      subject: `Re: ${d.subject}`,
      html: "<p>reply</p>",
    })),
  },
}));

import { GET, POST } from "@/app/api/complaints/route";
import { PUT } from "@/app/api/complaints/[id]/route";

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

    it("mengirim kontak pelapor ke notifikasi (untuk alert TINGGI)", async () => {
      mockPrisma.complaint.create.mockResolvedValue({
        id: "new-id",
        name: "Pelapor",
        email: "reporter@test.com",
        phone: "08123456789",
        role: "Orang Tua",
        category: "Akademik",
        subject: "Keluhan Saya",
        message: "Isi keluhan",
        isAnonymous: false,
        status: "BARU",
        priority: "TINGGI",
        response: null,
        responseBy: null,
        respondedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = createMockRequest("http://localhost/api/complaints", {
        method: "POST",
        body: {
          name: "Pelapor",
          email: "reporter@test.com",
          phone: "08123456789",
          category: "Akademik",
          subject: "Keluhan Saya",
          message: "Isi keluhan",
          priority: "TINGGI",
        },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(200);

      expect(mockNotifyComplaintToAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "TINGGI",
          email: "reporter@test.com",
          phone: "08123456789",
        })
      );
    });

    it("tidak mengirim kontak pelapor saat anonim", async () => {
      mockPrisma.complaint.create.mockResolvedValue({
        id: "new-id",
        name: "Anonim",
        email: "-",
        phone: "-",
        role: "Orang Tua",
        category: "Akademik",
        subject: "Keluhan",
        message: "Isi",
        isAnonymous: true,
        status: "BARU",
        priority: "NORMAL",
        response: null,
        responseBy: null,
        respondedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = createMockRequest("http://localhost/api/complaints", {
        method: "POST",
        body: {
          name: "Pelapor",
          email: "reporter@test.com",
          phone: "08123456789",
          isAnonymous: true,
          subject: "Keluhan",
          message: "Isi",
        },
      });
      const res = await POST(asNextRequest(req));
      expect(res.status).toBe(200);

      expect(mockNotifyComplaintToAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ isAnonymous: true, email: null, phone: null })
      );
    });
  });

  describe("PUT /api/complaints/[id]", () => {
    const mockUpdate = vi.fn();
    const mockFindUnique = vi.fn();

    beforeEach(() => {
      mockPrisma.complaint.update = mockUpdate;
      mockPrisma.complaint.findUnique = mockFindUnique;
    });

    it("mengirim email balasan otomatis ke pelapor non-anonim", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "c1",
        subject: "Keluhan Kantin",
        name: "Budi",
        email: "budi@test.com",
        isAnonymous: false,
      });
      mockUpdate.mockResolvedValueOnce({ id: "c1", response: "Tanggapan" });

      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        user: createMockUser(),
      });

      mockSendEmail.mockResolvedValueOnce(true);

      const req = createMockRequest("http://localhost/api/complaints/c1", {
        method: "PUT",
        body: { response: "Kami sudah menindaklanjuti.", status: "DIPROSES" },
      });
      const res = await PUT(asNextRequest(req), { params: Promise.resolve({ id: "c1" }) });
      expect(res.status).toBe(200);

      // Tunggu microtask (fire-and-forget)
      await new Promise((r) => setTimeout(r, 10));

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "budi@test.com",
          subject: expect.stringContaining("Keluhan Kantin"),
        })
      );
    });

    it("tidak mengirim email saat pengaduan anonim", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "c2",
        subject: "Keluhan Anonim",
        name: "Anonim",
        email: "anon@test.com",
        isAnonymous: true,
      });
      mockUpdate.mockResolvedValueOnce({ id: "c2" });

      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        user: createMockUser(),
      });

      mockSendEmail.mockClear();

      const req = createMockRequest("http://localhost/api/complaints/c2", {
        method: "PUT",
        body: { response: "Tanggapan" },
      });
      await PUT(asNextRequest(req), { params: Promise.resolve({ id: "c2" }) });

      await new Promise((r) => setTimeout(r, 10));
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("tidak mengirim email saat pelapor tidak punya email", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "c3",
        subject: "Tanpa Email",
        name: "Siswa",
        email: "",
        isAnonymous: false,
      });
      mockUpdate.mockResolvedValueOnce({ id: "c3" });

      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        user: createMockUser(),
      });

      mockSendEmail.mockClear();

      const req = createMockRequest("http://localhost/api/complaints/c3", {
        method: "PUT",
        body: { response: "Tanggapan" },
      });
      await PUT(asNextRequest(req), { params: Promise.resolve({ id: "c3" }) });

      await new Promise((r) => setTimeout(r, 10));
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
