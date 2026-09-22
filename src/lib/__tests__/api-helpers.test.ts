import { describe, expect, it, vi } from "vitest";
import { safeJson, withErrorHandling } from "@/lib/api-helpers";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

describe("safeJson (C1 audit fix)", () => {
  it("mem-parse body JSON valid", async () => {
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      body: JSON.stringify({ title: "halo", n: 1 }),
      headers: { "content-type": "application/json" },
    });
    const parsed = await safeJson<{ title: string; n: number }>(req);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.title).toBe("halo");
      expect(parsed.data.n).toBe(1);
    }
  });

  it("mengembalikan 400 (bukan melempar) saat body bukan JSON", async () => {
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      body: "ini bukan json",
      headers: { "content-type": "application/json" },
    });
    const parsed = await safeJson(req);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400);
      const data = (await parsed.response.json()) as { error?: string };
      expect(data.error).toBeTruthy();
    }
  });

  it("mengembalikan 400 saat body kosong", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST" });
    const parsed = await safeJson(req);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.response.status).toBe(400);
  });

  it("menerima tipe generik tanpa merusak runtime", async () => {
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      body: JSON.stringify({ dryRun: true }),
    });
    const parsed = await safeJson<{ dryRun?: boolean }>(req);
    expect(parsed.ok).toBe(true);
  });
});

describe("withErrorHandling (P1-1 konsistensi error handling)", () => {
  it("meneruskan handler + argumen ctx apa adanya saat sukses", async () => {
    const handler = vi.fn(
      async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
        const { id } = await ctx.params;
        return Response.json({ id });
      }
    );
    const wrapped = withErrorHandling(handler);
    const res = await wrapped(
      new Request("http://localhost/api/x", { method: "PUT" }),
      { params: Promise.resolve({ id: "42" }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "42" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("mengembalikan 500 safe (tanpa stack/pesan internal) + logger.error saat melempar", async () => {
    const { logger } = await import("@/lib/logger");
    const wrapped = withErrorHandling(async () => {
      throw new Error("rahasia internal: connection string bocor");
    });
    const res = await wrapped(new Request("http://localhost/api/x", { method: "POST" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, string>;
    expect(body.error).toBe("Terjadi kesalahan server.");
    expect(JSON.stringify(body)).not.toContain("connection string");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
