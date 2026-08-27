import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/notifications/test-telegram/route";

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
  sendTelegram: vi.fn().mockResolvedValue(true),
}));

function makeReq(body?: object, method = "POST"): Request {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new Request("http://localhost:3000/api/notifications/test-telegram", init);
}

describe("POST /api/notifications/test-telegram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("berhasil mengirim Telegram ke TELEGRAM_CHAT_ID", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "-1001234567890";

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.chatId).toBe("-1001234567890");
    expect(json.telegramConfigured).toBe(true);
    expect(json.message).toContain("terkirim");
  });

  it("menggunakan chatId dari body jika disediakan", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";

    const res = await POST(makeReq({ chatId: "99999" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.chatId).toBe("99999");
  });

  it("mengembalikan error jika tidak ada chat ID", async () => {
    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.error).toContain("chat ID");
  });

  it("gagal kirim mengembalikan error yang sesuai", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "-1001234567890";
    const { sendTelegram } = await import("@/lib/notifications");
    vi.mocked(sendTelegram).mockResolvedValueOnce(false);

    const res = await POST(makeReq());
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.error).toContain("Gagal mengirim Telegram");
  });

  it("menyebutkan Telegram belum dikonfigurasi jika token kosong", async () => {
    // chatId disediakan agar lolos pengecekan "no recipient", tapi token kosong
    const res = await POST(makeReq({ chatId: "12345" }));
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.telegramConfigured).toBe(false);
    expect(json.error).toContain("Set TELEGRAM_BOT_TOKEN");
  });

  it("GET mengembalikan 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});

async function GET() {
  const mod = await import("@/app/api/notifications/test-telegram/route");
  return mod.GET();
}
