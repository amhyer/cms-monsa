import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/notifications/test-alert/route";

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

vi.mock("@/lib/notifications", () => ({
  notifyAdmin: vi.fn().mockResolvedValue({ whatsapp: true, telegram: true }),
}));

function makeReq(body?: object, method = "POST"): Request {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new Request("http://localhost:3000/api/notifications/test-alert", init);
}

describe("POST /api/notifications/test-alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_PHONE;
    delete process.env.FONNTE_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("berhasil mengirim ke kedua kanal yang dikonfigurasi", async () => {
    process.env.ADMIN_PHONE = "628123456789";
    process.env.FONNTE_TOKEN = "fonnte-token";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "-1001234567890";

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.channels).toEqual({ whatsapp: true, telegram: true });
    expect(json.message).toContain("WhatsApp dan Telegram");
    expect(json.error).toBeUndefined();
  });

  it("sukses parsial: satu kanal gagal dilaporkan, tetap success", async () => {
    process.env.ADMIN_PHONE = "628123456789";
    process.env.FONNTE_TOKEN = "fonnte-token";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "-1001234567890";
    const { notifyAdmin } = await import("@/lib/notifications");
    vi.mocked(notifyAdmin).mockResolvedValueOnce({
      whatsapp: false,
      telegram: true,
    });

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.channels).toEqual({ whatsapp: false, telegram: true });
    expect(json.message).toContain("via Telegram");
    expect(json.message).toContain("WhatsApp gagal atau dilewati");
  });

  it("tanpa kanal terkonfigurasi → error tanpa memanggil notifyAdmin", async () => {
    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.whatsappConfigured).toBe(false);
    expect(json.telegramConfigured).toBe(false);
    expect(json.error).toContain("Tidak ada kanal aktif");

    const { notifyAdmin } = await import("@/lib/notifications");
    expect(notifyAdmin).not.toHaveBeenCalled();
  });

  it("kanal terkonfigurasi tapi semua gagal kirim → error", async () => {
    process.env.ADMIN_PHONE = "628123456789";
    process.env.FONNTE_TOKEN = "fonnte-token";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "-1001234567890";
    const { notifyAdmin } = await import("@/lib/notifications");
    vi.mocked(notifyAdmin).mockResolvedValueOnce({
      whatsapp: false,
      telegram: false,
    });

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.channels).toEqual({ whatsapp: false, telegram: false });
    expect(json.error).toContain("Gagal mengirim alert ke semua kanal");
  });

  it("mencatat log aktivitas AdminNotification saat sukses", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "-1001234567890";

    await POST(makeReq());

    const { logActivity } = await import("@/lib/log");
    expect(logActivity).toHaveBeenCalledWith(
      expect.anything(),
      "CREATE",
      "AdminNotification",
      expect.stringContaining("Uji kirim alert admin")
    );
  });

  it("GET mengembalikan 405", async () => {
    const mod = await import("@/app/api/notifications/test-alert/route");
    const res = await mod.GET();
    expect(res.status).toBe(405);
  });
});
