import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/notifications/test-whatsapp/route";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: "u1", name: "Operator", role: "OPERATOR" },
  }),
}));

vi.mock("@/lib/csrf", () => ({
  requireCsrf: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/log", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/whatsapp", () => ({
  sendWhatsApp: vi.fn().mockResolvedValue({ ok: true, detail: "Success" }),
}));

function makeReq(body?: object, method = "POST"): Request {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new Request("http://localhost:3000/api/notifications/test-whatsapp", init);
}

describe("POST /api/notifications/test-whatsapp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_PHONE;
    delete process.env.FONNTE_TOKEN;
  });

  it("berhasil mengirim WhatsApp ke ADMIN_PHONE", async () => {
    process.env.ADMIN_PHONE = "6281234567890";
    process.env.FONNTE_TOKEN = "test-token";

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.recipient).toBe("6281234567890");
    expect(json.fonnteConfigured).toBe(true);
    expect(json.message).toContain("terkirim");
  });

  it("menggunakan nomor dari body jika disediakan", async () => {
    process.env.FONNTE_TOKEN = "test-token";

    const res = await POST(makeReq({ phone: "6289876543210" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.recipient).toBe("6289876543210");
  });

  it("mengembalikan error jika tidak ada nomor tujuan", async () => {
    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.error).toContain("nomor tujuan");
  });

  it("gagal kirim mengembalikan error yang sesuai", async () => {
    process.env.ADMIN_PHONE = "6281234567890";
    process.env.FONNTE_TOKEN = "test-token";
    const { sendWhatsApp } = await import("@/lib/whatsapp");
    vi.mocked(sendWhatsApp).mockResolvedValueOnce({
      ok: false,
      message: "Invalid target",
    });

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.error).toContain("Gagal mengirim WhatsApp");
  });

  it("menyebutkan Fonnte belum dikonfigurasi jika token kosong", async () => {
    process.env.ADMIN_PHONE = "6281234567890";

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.fonnteConfigured).toBe(false);
    expect(json.error).toContain("Fonnte belum dikonfigurasi");
  });

  it("GET mengembalikan 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});

async function GET() {
  const mod = await import("@/app/api/notifications/test-whatsapp/route");
  return mod.GET();
}
