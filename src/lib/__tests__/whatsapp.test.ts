import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizePhone,
  announcementMessage,
  sppReminderMessage,
  parentAccountCreatedMessage,
  paymentConfirmationMessage,
  notifyParentWhatsApp,
  monthLabel,
  sendWhatsApp,
  sendBulkWhatsApp,
} from "@/lib/whatsapp";

describe("normalizePhone (format HP Indonesia)", () => {
  it("mengubah 08xx menjadi 628xx", () => {
    expect(normalizePhone("081234567890")).toBe("6281234567890");
  });

  it("mengubah 08xx dengan spasi/strip menjadi digit bersih", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("0812 3456 7890")).toBe("6281234567890");
  });

  it("membiarkan nomor yang sudah berformat 62", () => {
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
    expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("mengembalikan null untuk nomor tidak valid", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("08123")).toBeNull(); // terlalu pendek
    expect(normalizePhone("12345678901234567890")).toBeNull(); // terlalu panjang
  });

  it("mengembalikan null untuk nomor asing (bukan 0/62)", () => {
    expect(normalizePhone("+1 555 123 4567")).toBeNull();
  });
});

describe("monthLabel", () => {
  it("mengubah YYYY-MM menjadi nama bulan Indonesia", () => {
    expect(monthLabel("2026-07")).toBe("Juli 2026");
    expect(monthLabel("2026-01")).toBe("Januari 2026");
  });

  it("mengembalikan input apa adanya jika tidak valid", () => {
    expect(monthLabel("abc")).toBe("abc");
  });
});

describe("sppReminderMessage", () => {
  it("menyertakan periode, nama siswa, dan penutup sekolah", () => {
    const msg = sppReminderMessage({
      schoolName: "SDN Mongisidi 1",
      monthPeriod: "2026-07",
      studentNames: ["A. UNAYSAH BANI AHMAD"],
    });
    expect(msg).toContain("Kepada Bapak/Ibu Orang Tua/Wali Siswa");
    expect(msg).toContain("Juli 2026");
    expect(msg).toContain("A. UNAYSAH BANI AHMAD");
    expect(msg).toContain("belum tercatat di sekolah");
    expect(msg).toContain("SDN Mongisidi 1");
  });

  it("menggabungkan nama jika satu nomor dipakai 2+ anak", () => {
    const msg = sppReminderMessage({
      schoolName: "SDN",
      monthPeriod: "2026-08",
      studentNames: ["Ani", "Budi"],
    });
    expect(msg).toContain("Ani, Budi");
  });
});

describe("announcementMessage", () => {
  it("menyertakan sapaan, judul, isi, dan penutup sekolah", () => {
    const msg = announcementMessage({
      schoolName: "SDN Mongisidi 1",
      title: "Libur Hari Raya",
      content: "Kegiatan belajar diliburkan.",
      parentName: "Bapak Andi",
    });
    expect(msg).toContain("Kepada Bapak/Ibu Bapak Andi");
    expect(msg).toContain("Libur Hari Raya");
    expect(msg).toContain("Kegiatan belajar diliburkan.");
    expect(msg).toContain("SDN Mongisidi 1");
  });

  it("memotong isi yang sangat panjang", () => {
    const msg = announcementMessage({
      schoolName: "SDN",
      title: "T",
      content: "x".repeat(2000),
    });
    expect(msg.length).toBeLessThan(2000);
    expect(msg).toContain("…");
  });

  it("memakai sapaan umum jika parentName tidak ada", () => {
    const msg = announcementMessage({
      schoolName: "SDN",
      title: "T",
      content: "c",
    });
    expect(msg).toContain("Kepada Bapak/Ibu Orang Tua/Wali Siswa");
  });
});

describe("parentAccountCreatedMessage", () => {
  it("menyertakan sapaan, siswa, email, password, link portal, dan penutup sekolah", () => {
    const msg = parentAccountCreatedMessage({
      schoolName: "SDN Mongisidi 1",
      parentName: "Bapak Andi",
      studentName: "A. UNAYSAH BANI AHMAD",
      email: "ortu.andi@example.com",
      password: "rahasia123",
      portalUrl: "https://sekolah.sch.id/portal",
    });
    expect(msg).toContain("Kepada Bapak/Ibu Bapak Andi");
    expect(msg).toContain("A. UNAYSAH BANI AHMAD");
    expect(msg).toContain("ortu.andi@example.com");
    expect(msg).toContain("rahasia123");
    expect(msg).toContain("https://sekolah.sch.id/portal");
    expect(msg).toContain("SDN Mongisidi 1");
  });

  it("memakai sapaan umum bila parentName tidak ada", () => {
    const msg = parentAccountCreatedMessage({
      schoolName: "SDN",
      studentName: "Budi",
      email: "a@b.c",
      password: "pw123456",
      portalUrl: "http://localhost:3000/portal",
    });
    expect(msg).toContain("Kepada Bapak/Ibu Orang Tua/Wali Siswa");
  });
});

describe("paymentConfirmationMessage", () => {
  it("menyertakan siswa, periode, nominal Rupiah, dan penutup sekolah", () => {
    const msg = paymentConfirmationMessage({
      schoolName: "SDN Mongisidi 1",
      parentName: "Ibu Siti",
      studentName: "A. UNAYSAH BANI AHMAD",
      amount: 50000,
      monthPeriod: "2026-07",
      note: "Tunai",
    });
    expect(msg).toContain("Kepada Bapak/Ibu Ibu Siti");
    expect(msg).toContain("A. UNAYSAH BANI AHMAD");
    expect(msg).toContain("Juli 2026");
    expect(msg).toContain("Rp50.000");
    expect(msg).toContain("Tunai");
    expect(msg).toContain("SDN Mongisidi 1");
  });

  it("menyertakan nominal besar dengan pemisah ribuan", () => {
    const msg = paymentConfirmationMessage({
      schoolName: "SDN",
      studentName: "Budi",
      amount: 1500000,
      monthPeriod: "2026-08",
    });
    expect(msg).toContain("Rp1.500.000");
    expect(msg).toContain("Agustus 2026");
  });
});

describe("sendWhatsApp (Fonnte API)", () => {
  const originalEnv = process.env.FONNTE_TOKEN;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv === undefined) delete process.env.FONNTE_TOKEN;
    else process.env.FONNTE_TOKEN = originalEnv;
  });

  it("melewatkan pengiriman jika FONNTE_TOKEN tidak di-set", async () => {
    delete process.env.FONNTE_TOKEN;
    const res = await sendWhatsApp("6281234567890", "halo");
    expect(res.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mengirim dengan header Authorization dan form-urlencoded", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: true, id: "wa-1", detail: "sent" }),
    });

    const res = await sendWhatsApp("6281234567890", "halo orang tua");

    expect(res.ok).toBe(true);
    expect(res.id).toBe("wa-1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("api.fonnte.com");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token"
    );
    expect(String(init.body)).toContain("target=6281234567890");
    // URLSearchParams meng-encode spasi sebagai '+'
    expect(String(init.body)).toContain("message=halo+orang+tua");
  });

  it("mengembalikan gagal jika Fonnte menjawab status false", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: false, detail: "number not on whatsapp" }),
    });

    const res = await sendWhatsApp("6281234567890", "halo");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("number not on whatsapp");
  });

  it("mengembalikan gagal saat network error", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("ECONNREFUSED")
    );

    const res = await sendWhatsApp("6281234567890", "halo");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("ECONNREFUSED");
  });
});

describe("notifyParentWhatsApp", () => {
  const originalEnv = process.env.FONNTE_TOKEN;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv === undefined) delete process.env.FONNTE_TOKEN;
    else process.env.FONNTE_TOKEN = originalEnv;
  });

  it("membangun pesan secara lazy dan meneruskan ke sendWhatsApp", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: true }),
    });
    const builder = vi.fn(() => "Halo orang tua");

    await notifyParentWhatsApp("6281234567890", builder);

    expect(builder).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("tidak melempar & hanya mencatat warning saat pengiriman gagal", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 200,
      json: async () => ({ status: false, detail: "number not on whatsapp" }),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      notifyParentWhatsApp("6281234567890", () => "pesan")
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("tidak melempar bila pembuat pesan error (mis. DB mati)", async () => {
    process.env.FONNTE_TOKEN = "test-token";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      notifyParentWhatsApp("6281234567890", () => {
        throw new Error("db down");
      })
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("sendBulkWhatsApp", () => {
  const originalEnv = process.env.FONNTE_TOKEN;

  beforeEach(() => {
    process.env.FONNTE_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: true, id: "wa-x" }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv === undefined) delete process.env.FONNTE_TOKEN;
    else process.env.FONNTE_TOKEN = originalEnv;
  });

  it("memakai pesan per-nomor bila message berupa fungsi", async () => {
    const res = await sendBulkWhatsApp(
      ["6281234567891", "6281234567892"],
      (phone) => `Halo ${phone}`,
      { delayMs: 0 }
    );
    expect(res.sent).toBe(2);
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][1].body)).toContain("Halo+6281234567891");
    expect(String(calls[1][1].body)).toContain("Halo+6281234567892");
  });

  it("memakai pesan yang sama bila message berupa string", async () => {
    await sendBulkWhatsApp(["6281234567891"], "Sama semua", { delayMs: 0 });
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][1].body)).toContain("Sama+semua");
  });
});
