import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/cron/cron-failure/route";

vi.mock("@/lib/notifications", () => ({
  notifyAdmin: vi.fn().mockResolvedValue({ whatsapp: true, telegram: true }),
}));
import { notifyAdmin } from "@/lib/notifications";

const SECRET = "test-cron-secret";

function makeReq(body?: unknown, auth = `Bearer ${SECRET}`): Request {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = auth;
  const init: RequestInit = { method: "POST", headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  return new Request("http://localhost:3000/api/cron/cron-failure", init);
}

describe("POST /api/cron/cron-failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
  });

  it("CRON_SECRET belum di-set → 503", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeReq({ job: "x", attempts: 1 }));
    expect(res.status).toBe(503);
    expect(notifyAdmin).not.toHaveBeenCalled();
  });

  it("token salah → 401", async () => {
    const res = await POST(makeReq({ job: "x", attempts: 1 }, "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(notifyAdmin).not.toHaveBeenCalled();
  });

  it("body bukan JSON → 400", async () => {
    const req = new Request("http://localhost:3000/api/cron/cron-failure", {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
      body: "bukan-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it.each([
    { label: "job kosong", body: { attempts: 1 } },
    { label: "job kosong 2", body: { job: "", attempts: 1 } },
    { label: "job spasi", body: { job: "   ", attempts: 1 } },
    { label: "job > 100", body: { job: "x".repeat(101), attempts: 1 } },
    { label: "attempts hilang", body: { job: "x" } },
    { label: "attempts < 1", body: { job: "x", attempts: 0 } },
    { label: "attempts > 10", body: { job: "x", attempts: 11 } },
    { label: "attempts desimal", body: { job: "x", attempts: 1.5 } },
    { label: "attempts string", body: { job: "x", attempts: "2" } },
  ])("body tidak valid — $label", async ({ body }: { body: unknown }) => {
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(notifyAdmin).not.toHaveBeenCalled();
  });

  it("laporan valid → notifyAdmin dengan job, percobaan, dan detail", async () => {
    const res = await POST(
      makeReq({
        job: "cleanup-uploads",
        attempts: 2,
        lastError: "wget: server returned error: HTTP/1.1 502 Bad Gateway",
        lastBody: `{"ok":false,"error":"boom"}`,
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.channels).toEqual({ whatsapp: true, telegram: true });
    expect(json.timestamp).toEqual(expect.any(String));

    expect(notifyAdmin).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(notifyAdmin).mock.calls[0][0];
    expect(msg).toContain("cleanup-uploads");
    expect(msg).toContain("2×");
    expect(msg).toContain("HTTP/1.1 502");
    expect(msg).toContain("boom");
  });

  it("detail opsional boleh kosong — pesan tanpa baris Detail", async () => {
    const res = await POST(makeReq({ job: "backup", attempts: 1 }));
    expect(res.status).toBe(200);
    const msg = vi.mocked(notifyAdmin).mock.calls[0][0];
    expect(msg).not.toContain("Detail:");
  });

  it("lastError/lastBody non-string diabaikan; string panjang dipotong", async () => {
    const res = await POST(
      makeReq({
        job: "x",
        attempts: 1,
        lastError: 123,
        lastBody: "y".repeat(1000),
      })
    );
    expect(res.status).toBe(200);
    const msg = vi.mocked(notifyAdmin).mock.calls[0][0];
    expect(msg).toContain("…");
    // 300 + ellipsis, tidak pernah 1000.
    expect(msg.length).toBeLessThan(1000);
  });

  it("semua kanal gagal (belum dikonfigurasi) → tetap 200 ok dengan channels false", async () => {
    vi.mocked(notifyAdmin).mockResolvedValueOnce({ whatsapp: false, telegram: false });
    const res = await POST(makeReq({ job: "x", attempts: 2 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.channels).toEqual({ whatsapp: false, telegram: false });
  });

  it("notifyAdmin melempar → 502", async () => {
    vi.mocked(notifyAdmin).mockRejectedValueOnce(new Error("network down"));
    const res = await POST(makeReq({ job: "x", attempts: 2 }));
    expect(res.status).toBe(502);
  });
});
