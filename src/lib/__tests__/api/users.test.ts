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

import { GET, POST } from "@/app/api/users/route";
import { PUT } from "@/app/api/users/[id]/route";

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

function fullUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    name: "Admin Sekolah",
    email: "admin@x.sch.id",
    role: "SUPER_ADMIN",
    isActive: true,
    guardianClassId: null,
    guardianStudentId: null,
    studentId: null,
    ...overrides,
  };
}

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    name: "Admin Sekolah",
    email: "admin@x.sch.id",
    role: "SUPER_ADMIN",
    isActive: true,
    guardianClassId: null,
    guardianStudentId: null,
    studentId: null,
    guardianClass: null,
    guardianStudent: null,
    student: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  it("mengembalikan daftar ter-paginasi + counts per peran", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.count.mockResolvedValue(7);
    mockPrisma.user.findMany.mockResolvedValue([userRow()]);
    mockPrisma.user.groupBy.mockResolvedValue([
      { role: "SUPER_ADMIN", _count: { _all: 1 } },
      { role: "OPERATOR", _count: { _all: 2 } },
      { role: "GURU", _count: { _all: 2 } },
      { role: "ORANG_TUA", _count: { _all: 1 } },
      { role: "SISWA", _count: { _all: 1 } },
    ]);

    const req = createMockRequest("http://localhost/api/users?limit=10");
    const res = await GET(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(7);
    expect(data.counts).toEqual({
      all: 7,
      STAFF: 3,
      GURU: 2,
      ORANG_TUA: 1,
      SISWA: 1,
    });
    // Cursor-based: findMany uses take: limit + 1, orderBy: id
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 11, orderBy: { id: "asc" } })
    );
    expect(mockPrisma.user.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["role"], _count: { _all: true } })
    );
  });

  it("returns hasMore and nextCursor when there are more items", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.count.mockResolvedValue(23);
    // Return 11 items (limit + 1) to signal there are more
    const manyItems = Array.from({ length: 11 }, (_, i) => userRow({ id: `u-${i}` }));
    mockPrisma.user.findMany.mockResolvedValue(manyItems);
    mockPrisma.user.groupBy.mockResolvedValue([]);

    const req = createMockRequest("http://localhost/api/users?limit=10");
    const res = await GET(asNextRequest(req));
    const data = await res.json();

    expect(data.items).toHaveLength(10);
    expect(data.hasMore).toBe(true);
    expect(data.nextCursor).toBeTruthy();
  });

  it("meneruskan filter peran STAFF sebagai in [SUPER_ADMIN, OPERATOR]", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.count.mockResolvedValue(3);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.groupBy.mockResolvedValue([]);

    const req = createMockRequest("http://localhost/api/users?role=STAFF");
    await GET(asNextRequest(req));

    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { role: { in: ["SUPER_ADMIN", "OPERATOR"] } },
    });
  });

  it("meneruskan filter peran GURU secara eksak", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.count.mockResolvedValue(2);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.groupBy.mockResolvedValue([]);

    const req = createMockRequest("http://localhost/api/users?role=GURU");
    await GET(asNextRequest(req));

    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { role: "GURU" },
    });
  });

  it("pencarian q mencakup nama, email, dan nama siswa tertaut", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.groupBy.mockResolvedValue([]);

    const req = createMockRequest(
      "http://localhost/api/users?q=Aisyah%20Putri"
    );
    await GET(asNextRequest(req));

    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "Aisyah Putri" } },
          { email: { contains: "Aisyah Putri" } },
          { guardianStudent: { name: { contains: "Aisyah Putri" } } },
          { student: { name: { contains: "Aisyah Putri" } } },
        ],
      },
    });
  });

  it("menolak tanpa role SUPER_ADMIN", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const req = createMockRequest("http://localhost/api/users");
    const res = await GET(asNextRequest(req));
    expect(res.status).toBe(403);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("menjalankan cursor-based pagination dengan benar", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.count.mockResolvedValue(50);
    mockPrisma.user.findMany.mockResolvedValue(
      Array.from({ length: 11 }, (_, i) => userRow({ id: `u-${i}` }))
    );
    mockPrisma.user.groupBy.mockResolvedValue([
      { role: "GURU", _count: { _all: 3 } },
    ]);

    const req = createMockRequest("http://localhost/api/users?limit=10");
    const res = await GET(asNextRequest(req));
    const data = await res.json();

    expect(data.items).toHaveLength(10);
    expect(data.hasMore).toBe(true);
    expect(data.nextCursor).toBeTruthy();
    // should not use skip
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ skip: expect.any(Number) })
    );
  });
});

describe("PUT /api/users/[id] — adaptasi tautan saat role diganti", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  it("ORANG_TUA → SISWA: set studentId, bersihkan guardianStudentId & guardianClassId", async () => {
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockPrisma.user.findUnique.mockResolvedValue(
      fullUserRow({ id: "u-ortu", role: "ORANG_TUA", guardianStudentId: "s1" })
    );
    mockPrisma.student.findUnique.mockResolvedValue({ id: "s2", name: "Bima" });
    mockPrisma.user.findFirst.mockResolvedValue(null); // siswa s2 belum punya akun
    mockPrisma.user.update.mockResolvedValue(fullUserRow({ id: "u-ortu", role: "SISWA" }));

    const req = createMockRequest("http://localhost/api/users/u-ortu", {
      method: "PUT",
      body: { role: "SISWA", studentId: "s2" },
    });
    const res = await PUT(asNextRequest(req), {
      params: Promise.resolve({ id: "u-ortu" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "SISWA",
          studentId: "s2",
          guardianStudentId: null,
        }),
      })
    );
  });

  it("SISWA → GURU: set guardianClassId, bersihkan studentId & guardianStudentId", async () => {
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockPrisma.user.findUnique.mockResolvedValue(
      fullUserRow({ id: "u-siswa", role: "SISWA", studentId: "s1" })
    );
    mockPrisma.user.update.mockResolvedValue(fullUserRow({ id: "u-siswa", role: "GURU" }));

    const req = createMockRequest("http://localhost/api/users/u-siswa", {
      method: "PUT",
      body: { role: "GURU", guardianClassId: "c1" },
    });
    const res = await PUT(asNextRequest(req), {
      params: Promise.resolve({ id: "u-siswa" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "GURU",
          guardianClassId: "c1",
          studentId: null,
          guardianStudentId: null,
        }),
      })
    );
  });

  it("GURU → ORANG_TUA: set guardianStudentId, bersihkan studentId & guardianClassId walau body tidak menyertakannya", async () => {
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockPrisma.user.findUnique.mockResolvedValue(
      fullUserRow({ id: "u-guru", role: "GURU", guardianClassId: "c1" })
    );
    mockPrisma.student.findUnique.mockResolvedValue({ id: "s1", name: "Aisyah" });
    mockPrisma.user.update.mockResolvedValue(fullUserRow({ id: "u-guru", role: "ORANG_TUA" }));

    const req = createMockRequest("http://localhost/api/users/u-guru", {
      method: "PUT",
      body: { role: "ORANG_TUA", guardianStudentId: "s1" },
    });
    const res = await PUT(asNextRequest(req), {
      params: Promise.resolve({ id: "u-guru" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "ORANG_TUA",
          guardianStudentId: "s1",
          studentId: null,
          // Form hanya mengirim guardianClassId untuk GURU — saat pindah ke
          // ORANG_TUA, guardianClassId lama WAJIB dibersihkan (fix staleness).
          guardianClassId: null,
        }),
      })
    );
  });
});

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

  it("membuat akun SISWA yang tertaut ke siswa", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null); // email belum terdaftar
    mockPrisma.student.findUnique.mockResolvedValue({ id: "s2", name: "Bima" });
    mockPrisma.user.findFirst.mockResolvedValue(null); // siswa belum punya akun
    mockPrisma.user.create.mockResolvedValue(
      createdUser({ id: "u-siswa", role: "SISWA" })
    );

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Bima Arya Saputra",
        email: "bima.siswa@example.com",
        password: "rahasia123",
        role: "SISWA",
        studentId: "s2",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("u-siswa");
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "SISWA", studentId: "s2" }),
      })
    );
    expect(mockNotifyParentWhatsApp).not.toHaveBeenCalled();
  });

  it("menolak akun SISWA tanpa studentId", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Siswa Tanpa Tautan",
        email: "siswa@example.com",
        password: "rahasia123",
        role: "SISWA",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("menolak akun SISWA bila siswa sudah punya akun", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.student.findUnique.mockResolvedValue({ id: "s2", name: "Bima" });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u-lama" }); // sudah ada akun

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Bima Arya Saputra",
        email: "bima.dua@example.com",
        password: "rahasia123",
        role: "SISWA",
        studentId: "s2",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(409);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("men-set mustChangePassword: true saat admin membuat akun baru", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null); // email belum terdaftar
    mockPrisma.user.create.mockResolvedValue(
      createdUser({ id: "u-guru-baru", role: "GURU" })
    );

    const req = createMockRequest("http://localhost:3000/api/users", {
      method: "POST",
      body: {
        name: "Guru Baru",
        email: "guru.baru@example.com",
        password: "rahasia123",
        role: "GURU",
      },
    });
    const res = await POST(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mustChangePassword: true }),
      })
    );
  });
});
