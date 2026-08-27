import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notifyComplaintToAdmin,
  buildPriorityComplaintMessage,
} from "@/lib/notifications";

// WhatsApp di-mock agar tidak ada side effect; Telegram memakai fetch global
// yang di-stub per test.
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsApp: vi.fn(() => Promise.resolve({ ok: true, message: "sent" })),
}));

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

  it("prioritas NORMAL hanya mengirim satu pesan Telegram (tanpa alert)", async () => {
    fetchMock.mockResolvedValue(telegramOk());

    await notifyComplaintToAdmin({ ...base, priority: "NORMAL" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});