import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notifyAdmin,
  notifyComplaintToAdmin,
  buildPriorityComplaintMessage,
} from "@/lib/notifications";

// WhatsApp & email di-mock agar tidak ada side effect; Telegram memakai
// fetch global yang di-stub per test.
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsApp: vi.fn(() => Promise.resolve({ ok: true, message: "sent" })),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(() => Promise.resolve(true)),
}));

import { sendWhatsApp } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";

const fetchMock = vi.fn();

function telegramOk() {
  return { ok: true, json: async () => ({ ok: true }) };
}

const base = {
  id: "c-abc-123",
  name: "Budi Santoso",
  subject: "Kantin sekolah",
  message: "Harga jajan naik.",
  category: "Fasilitas",
  isAnonymous: false,
  priority: "TINGGI",
  email: "budi@contoh.id",
  phone: "081234567890",
};

describe("buildPriorityComplaintMessage", () => {
  it("memuat label TINGGI, subjek, dan kontak pelapor", () => {
    const m = buildPriorityComplaintMessage(base);
    expect(m).toContain("PRIORITAS TINGGI");
    expect(m).toContain("Kantin sekolah");
    expect(m).toContain("budi@contoh.id");
    expect(m).toContain("081234567890");
    expect(m).toContain("/dashboard/complaints?highlight=c-abc-123");
  });

  it("menyembunyikan kontak saat anonim", () => {
    const m = buildPriorityComplaintMessage({
      ...base,
      isAnonymous: true,
      name: "Anonim",
      email: null,
      phone: null,
    });
    expect(m).not.toContain("Email:");
    expect(m).not.toContain("Telepon:");
    expect(m).toContain("Anonim");
  });

  it("escape underscore di email agar Markdown Telegram tidak rusak", () => {
    const m = buildPriorityComplaintMessage({
      ...base,
      email: "budi_anto@contoh.id",
    });
    expect(m).toContain("budi\\_anto@contoh.id");
  });
});

describe("notifyComplaintToAdmin — prioritas TINGGI", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.ADMIN_PHONE;
  });

  it("mengirim pesan ringkas tambahan ke Telegram dengan kontak pelapor", async () => {
    fetchMock.mockResolvedValue(telegramOk());

    await notifyComplaintToAdmin(base);

    // 1 pesan standar + 1 alert khusus TINGGI (tanpa ADMIN_PHONE → tanpa WhatsApp)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((c) =>
      JSON.parse(String(c[1].body)).text
    );
    const alert = bodies.find((b) => b.includes("PRIORITAS TINGGI"));
    expect(alert).toBeDefined();
    expect(alert).toContain("budi@contoh.id");
    expect(alert).toContain("081234567890");
  });

  it("mengirim alert TINGGI juga ke WhatsApp jika ADMIN_PHONE di-set", async () => {
    fetchMock.mockResolvedValue(telegramOk());
    process.env.ADMIN_PHONE = "6281234567890";

    const { sendWhatsApp } = await import("@/lib/whatsapp");
    vi.mocked(sendWhatsApp).mockClear();
    vi.mocked(sendWhatsApp).mockResolvedValue({ ok: true });

    await notifyComplaintToAdmin(base);

    // WhatsApp: 1 pesan standar + 1 alert TINGGI
    expect(sendWhatsApp).toHaveBeenCalledTimes(2);
    const waCalls = vi.mocked(sendWhatsApp).mock.calls;
    const alertWa = waCalls.find((c) =>
      typeof c[1] === "string" && c[1].includes("PRIORITAS TINGGI")
    );
    expect(alertWa).toBeDefined();
    expect(alertWa![1]).toContain("budi@contoh.id");
  });

  it("prioritas NORMAL hanya mengirim satu pesan Telegram (tanpa alert)", async () => {
    fetchMock.mockResolvedValue(telegramOk());

    await notifyComplaintToAdmin({ ...base, priority: "NORMAL" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("notifyAdmin — alert storage/quota", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(sendWhatsApp).mockReset();
    vi.mocked(sendWhatsApp).mockResolvedValue({ ok: true });
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.ADMIN_PHONE;
    delete process.env.ADMIN_EMAIL;
  });

  it("mengirim ke WhatsApp (ADMIN_PHONE) dan Telegram", async () => {
    fetchMock.mockResolvedValue(telegramOk());
    process.env.ADMIN_PHONE = "6281234567890";

    const result = await notifyAdmin("🚨 PERINGATAN STORAGE");

    expect(result).toEqual({ whatsapp: true, telegram: true, email: false });
    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(sendWhatsApp).toHaveBeenCalledWith(
      "6281234567890",
      expect.stringContaining("PERINGATAN STORAGE"),
      expect.objectContaining({ timeoutMs: 10_000 })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tanpa ADMIN_PHONE hanya Telegram", async () => {
    fetchMock.mockResolvedValue(telegramOk());

    const result = await notifyAdmin("alert");

    expect(result).toEqual({ whatsapp: false, telegram: true, email: false });
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it("WhatsApp gagal → whatsapp false, tidak melempar, Telegram tetap terkirim", async () => {
    fetchMock.mockResolvedValue(telegramOk());
    process.env.ADMIN_PHONE = "6281234567890";
    vi.mocked(sendWhatsApp).mockResolvedValue({ ok: false, message: "token invalid" });

    const result = await notifyAdmin("alert");

    expect(result.whatsapp).toBe(false);
    expect(result.telegram).toBe(true);
  });
});

describe("notifyAdmin — kanal email", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(telegramOk());
    vi.mocked(sendWhatsApp).mockReset();
    vi.mocked(sendWhatsApp).mockResolvedValue({ ok: true });
    vi.mocked(sendEmail).mockReset();
    vi.mocked(sendEmail).mockResolvedValue(true);
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.ADMIN_PHONE;
    delete process.env.ADMIN_EMAIL;
  });

  it("ADMIN_EMAIL diset → email terkirim ke alamat itu berisi pesan", async () => {
    process.env.ADMIN_EMAIL = "admin@mongisidi1.sch.id";

    const result = await notifyAdmin("🚨 Sync GAGAL");

    expect(result.email).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@mongisidi1.sch.id",
        text: expect.stringContaining("Sync GAGAL"),
      })
    );
  });

  it("tanpa ADMIN_EMAIL → email dilewati tanpa error", async () => {
    const result = await notifyAdmin("alert");

    expect(result.email).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sendEmail gagal (false) → email false, tidak melempar, kanal lain tetap jalan", async () => {
    process.env.ADMIN_EMAIL = "admin@mongisidi1.sch.id";
    vi.mocked(sendEmail).mockResolvedValue(false);

    const result = await notifyAdmin("alert");

    expect(result.email).toBe(false);
    expect(result.telegram).toBe(true);
  });

  it("sendEmail melempar → tertelan (fire-and-forget), email false", async () => {
    process.env.ADMIN_EMAIL = "admin@mongisidi1.sch.id";
    vi.mocked(sendEmail).mockRejectedValue(new Error("smtp down"));

    const result = await notifyAdmin("alert");

    expect(result.email).toBe(false);
    expect(result.telegram).toBe(true);
  });
});