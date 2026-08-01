import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, asNextRequest } from "../test-utils";

// We need to mock the auth module before importing the route
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

import { POST } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/password";

// Mock rate-limit to avoid state leakage between tests
vi.mock("@/lib/rate-limit", () => ({
  isLocked: vi.fn(() => false),
  lockSecondsRemaining: vi.fn(() => 0),
  recordFailure: vi.fn(),
  clearFailures: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  it("returns 400 when email is missing", async () => {
    const req = createMockRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: { password: "test123" },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 400 when password is missing", async () => {
    const req = createMockRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: { email: "test@test.com" },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 400 when both email and password are empty", async () => {
    const req = createMockRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: { email: "", password: "" },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid credentials", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = createMockRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: { email: "nonexistent@test.com", password: "wrong" },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toContain("Email atau password salah");
  });

  it("returns 403 for inactive user", async () => {
    // Use a properly hashed password so verification passes
    const hashedPw = hashPassword("test123");
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "1",
      name: "Inactive User",
      email: "inactive@test.com",
      password: hashedPw,
      role: "OPERATOR",
      isActive: false,
    });

    const req = createMockRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: { email: "inactive@test.com", password: "test123" },
    });
    const res = await POST(asNextRequest(req));
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toContain("dinonaktifkan");
  });

  it("returns 400 for password too long", async () => {
    const req = createMockRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: { email: "test@test.com", password: "a".repeat(1025) },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(400);
  });
});
