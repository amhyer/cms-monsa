import { describe, it, expect, vi, beforeEach } from "vitest";

// Track cookie store for rotation tests
let cookieStore: Record<string, string> = {};

// Mock next/headers so we can test requireCsrf without a Next.js server
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) => cookieStore[name] !== undefined ? { value: cookieStore[name], name } : undefined,
    set: (name: string, value: string) => { cookieStore[name] = value; },
    delete: (name: string) => { delete cookieStore[name]; },
  }),
}));

import { requireCsrf, generateCsrfToken, getCsrfToken, validateCsrfToken } from "@/lib/csrf";

describe("requireCsrf", () => {
  it("returns null (allows) for GET requests", async () => {
    const req = new Request("http://localhost/api/users", { method: "GET" });
    const result = await requireCsrf(req);
    expect(result).toBeNull();
  });

  it("returns null (allows) for HEAD requests", async () => {
    const req = new Request("http://localhost/api/users", { method: "HEAD" });
    const result = await requireCsrf(req);
    expect(result).toBeNull();
  });

  it("returns null (allows) for OPTIONS requests", async () => {
    const req = new Request("http://localhost/api/users", { method: "OPTIONS" });
    const result = await requireCsrf(req);
    expect(result).toBeNull();
  });

  it("returns null (allows) for POST to public endpoint /api/auth/login", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
    });
    const result = await requireCsrf(req);
    expect(result).toBeNull();
  });

  it("returns null (allows) for POST to public endpoint /api/complaints", async () => {
    const req = new Request("http://localhost/api/complaints", {
      method: "POST",
    });
    const result = await requireCsrf(req);
    expect(result).toBeNull();
  });

  it("returns null (allows) for POST to public endpoint /api/contact", async () => {
    const req = new Request("http://localhost/api/contact", {
      method: "POST",
    });
    const result = await requireCsrf(req);
    expect(result).toBeNull();
  });

  it("returns null (allows) for POST to /api/dapodik/ingest (jembatan Bearer)", async () => {
    const req = new Request("http://localhost/api/dapodik/ingest", {
      method: "POST",
    });
    const result = await requireCsrf(req);
    expect(result).toBeNull();
  });

  it("returns 403 for POST without CSRF token header", async () => {
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    // No x-csrf-token header → should fail
    const result = await requireCsrf(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("returns 403 for PUT without CSRF token header", async () => {
    const req = new Request("http://localhost/api/users/1", {
      method: "PUT",
      body: JSON.stringify({ name: "test" }),
    });
    const result = await requireCsrf(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("returns 403 for DELETE without CSRF token header", async () => {
    const req = new Request("http://localhost/api/users/1", {
      method: "DELETE",
    });
    const result = await requireCsrf(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });
});

describe("CSRF token generation and rotation", () => {
  beforeEach(() => {
    cookieStore = {};
    vi.clearAllMocks();
  });

  it("generateCsrfToken returns a 64-char hex string", async () => {
    const token = await generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateCsrfToken stores token in cookie store", async () => {
    const token = await generateCsrfToken();
    expect(cookieStore["monsa_csrf"]).toBe(token);
  });

  it("getCsrfToken returns the stored token", async () => {
    await generateCsrfToken();
    const retrieved = await getCsrfToken();
    expect(retrieved).toBe(cookieStore["monsa_csrf"]);
  });

  it("getCsrfToken returns null when no token exists", async () => {
    cookieStore = {};
    const retrieved = await getCsrfToken();
    expect(retrieved).toBeNull();
  });

  it("token rotation: new token replaces old one", async () => {
    const token1 = await generateCsrfToken();
    const token2 = await generateCsrfToken();
    // Each call generates a new unique token
    expect(token1).not.toBe(token2);
    // Cookie store has the latest token
    expect(cookieStore["monsa_csrf"]).toBe(token2);
  });

  it("validateCsrfToken returns true when header matches cookie", async () => {
    const token = await generateCsrfToken();
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "x-csrf-token": token },
    });
    const result = await validateCsrfToken(req);
    expect(result).toBe(true);
  });

  it("validateCsrfToken returns false when header does not match cookie", async () => {
    await generateCsrfToken();
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "x-csrf-token": "wrong-token-value" },
    });
    const result = await validateCsrfToken(req);
    expect(result).toBe(false);
  });

  it("validateCsrfToken returns false when no header is provided", async () => {
    await generateCsrfToken();
    const req = new Request("http://localhost/api/users", {
      method: "POST",
    });
    const result = await validateCsrfToken(req);
    expect(result).toBe(false);
  });

  it("validateCsrfToken returns false when no cookie exists", async () => {
    cookieStore = {};
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "x-csrf-token": "some-token" },
    });
    const result = await validateCsrfToken(req);
    expect(result).toBe(false);
  });

  it("timing-safe: tokens of different lengths are rejected", async () => {
    cookieStore["monsa_csrf"] = "short";
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "x-csrf-token": "a-much-longer-token-that-is-not-the-same" },
    });
    const result = await validateCsrfToken(req);
    expect(result).toBe(false);
  });
});
