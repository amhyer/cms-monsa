import { describe, expect, it } from "vitest";
import { safeJson } from "@/lib/api-helpers";

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
