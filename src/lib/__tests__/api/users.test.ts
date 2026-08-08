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

const mockNotifyParentWhatsApp = vi.fn();
vi.mock("@/lib/whatsapp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whatsapp")>();
  return {
    ...actual,
    notifyParentWhatsApp: (...args: unknown[]) => mockNotifyParentWhatsApp(...args),
  };
});

import { POST } from "@/app/api/users/route";

function createdUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-ortu",
    name: "Orang Tua Andi",
    email: "ortu.andi@example.com",
    role: "ORANG_TUA",
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
    mockNotifyParentWhatsApp.mockReset().mockResolvedValue(undefined);
  });

  it("mengirim WhatsApp selamat datang (email+password+link portal) saat akun ORANG_TUA dibuat", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null); // email belum terdaftar
    mockPrisma.student.findUnique.mockResolvedValue({
      id: "s1",
      name: "A. UNAYSAH BANI AHMAD",
      parentName: "Bapak Andi",
      parentPhone: "081234567890",
    });
    mockPrisma.user.create.mockResolvedValue(createdUser());
    mockPrisma.siteSetting.findUnique.mockResolvedValue({ schoolName: "SDN Mongisidi 1" });

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Orang Tua Andi",
        email: "ortu.andi@example.com",
        password: "rahasia123",
        role: "ORANG_TUA",
        guardianStudentId: "s1",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockNotifyParentWhatsApp).toHaveBeenCalledTimes(1);
    const [phone, build] = mockNotifyParentWhatsApp.mock.calls[0] as [
      string,
      () => Promise<string>,
    ];
    expect(phone).toBe("6281234567890");
    const message = await build();
    expect(message).toContain("A. UNAYSAH BANI AHMAD");
    expect(message).toContain("ortu.andi@example.com");
    expect(message).toContain("rahasia123");
    expect(message).toContain("http://localhost:3000/portal");
    expect(message).toContain("SDN Mongisidi 1");
  });

  it("tidak mengirim WhatsApp bila siswa tautan tidak punya nomor HP", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.student.findUnique.mockResolvedValue({
      id: "s1",
      name: "Budi",
      parentName: null,
      parentPhone: null,
    });
    mockPrisma.user.create.mockResolvedValue(createdUser());

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Orang Tua Budi",
        email: "ortu.budi@example.com",
        password: "rahasia123",
        role: "ORANG_TUA",
        guardianStudentId: "s1",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockNotifyParentWhatsApp).not.toHaveBeenCalled();
  });

  it("akun tetap dibuat & notifikasi tetap dicoba walau WhatsApp tidak terkirim (non-blokir)", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.student.findUnique.mockResolvedValue({
      id: "s1",
      name: "Andi",
      parentName: null,
      parentPhone: "081234567890",
    });
    mockPrisma.user.create.mockResolvedValue(createdUser());

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Orang Tua Andi",
        email: "ortu.andi@example.com",
        password: "rahasia123",
        role: "ORANG_TUA",
        guardianStudentId: "s1",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("u-ortu");
    // Kegagalan pengiriman ditangani non-blokir di dalam notifyParentWhatsApp
    // (diuji di whatsapp.test.ts).
    expect(mockNotifyParentWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("tidak mengirim WhatsApp untuk role selain ORANG_TUA", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(createdUser({ role: "GURU" }));

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Guru Baru",
        email: "guru@example.com",
        password: "rahasia123",
        role: "GURU",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockNotifyParentWhatsApp).not.toHaveBeenCalled();
  });

  it("menolak tautan siswa tidak valid untuk ORANG_TUA", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.student.findUnique.mockResolvedValue(null);

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Orang Tua",
        email: "ortu@example.com",
        password: "rahasia123",
        role: "ORANG_TUA",
        guardianStudentId: "ghost",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockNotifyParentWhatsApp).not.toHaveBeenCalled();
  });
});
