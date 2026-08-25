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

import { POST } from "@/app/api/users/[id]/reset-password/route";

describe("POST /api/users/[id]/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  it("mereset password dan men-set mustChangePassword: true", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-target",
      name: "Guru A",
      email: "guru.a@example.com",
    });
    mockPrisma.user.update.mockResolvedValue({ id: "u-target" });

    const req = createMockRequest("http://localhost:3000/api/users/u-target/reset-password", {
      method: "POST",
      body: { currentPassword: "dummy", newPassword: "baru12345" },
    });
    const res = await POST(asNextRequest(req), {
      params: Promise.resolve({ id: "u-target" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-target" },
      data: {
        password: expect.any(String),
        mustChangePassword: true,
      },
    });
  });

  it("menolak jika user tidak ditemukan", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = createMockRequest("http://localhost:3000/api/users/ghost/reset-password", {
      method: "POST",
      body: { currentPassword: "dummy", newPassword: "baru12345" },
    });
    const res = await POST(asNextRequest(req), {
      params: Promise.resolve({ id: "ghost" }),
    });

    expect(res.status).toBe(404);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("menolak tanpa role SUPER_ADMIN", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const req = createMockRequest("http://localhost:3000/api/users/u-target/reset-password", {
      method: "POST",
      body: { currentPassword: "dummy", newPassword: "baru12345" },
    });
    const res = await POST(asNextRequest(req), {
      params: Promise.resolve({ id: "u-target" }),
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("menolak body tidak valid (password kosong)", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-target",
      name: "Guru A",
      email: "guru.a@example.com",
    });

    const req = createMockRequest("http://localhost:3000/api/users/u-target/reset-password", {
      method: "POST",
      body: { currentPassword: "dummy", newPassword: "" },
    });
    const res = await POST(asNextRequest(req), {
      params: Promise.resolve({ id: "u-target" }),
    });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
