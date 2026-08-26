import { describe, it, expect } from "vitest";
import { emailTemplates } from "@/lib/email";

/**
 * Template email notifikasi — fokus pada keamanan HTML (escapeHtml)
 * dan kelengkapan informasi yang diterima admin (kontak pelapor,
 * prioritas) saat pengaduan baru masuk.
 */
describe("emailTemplates.complaintNotification", () => {
  const base = {
    name: "Budi Santoso",
    subject: "Kantin sekolah",
    message: "Harga jajan naik.",
    category: "Fasilitas",
  };

  it("memuat nama, kategori, subjek, dan pesan pelapor", () => {
    const t = emailTemplates.complaintNotification(base);
    expect(t.subject).toContain("Pengaduan Baru");
    expect(t.subject).toContain("Kantin sekolah");
    expect(t.html).toContain("Budi Santoso");
    expect(t.html).toContain("Fasilitas");
    expect(t.html).toContain("Harga jajan naik.");
  });

  it("menyertakan kontak pelapor (email & telepon) saat tersedia", () => {
    const t = emailTemplates.complaintNotification({
      ...base,
      email: "budi@contoh.id",
      phone: "081234567890",
    });
    expect(t.html).toContain("budi@contoh.id");
    expect(t.html).toContain("081234567890");
  });

  it("anonim: tanpa baris kontak", () => {
    const t = emailTemplates.complaintNotification({
      ...base,
      name: "Anonim",
      email: null,
      phone: null,
    });
    expect(t.html).not.toContain("Email:</strong>");
    expect(t.html).not.toContain("Telepon:</strong>");
  });

  it("menampilkan label prioritas TINGGI vs NORMAL", () => {
    const high = emailTemplates.complaintNotification({ ...base, priority: "TINGGI" });
    const normal = emailTemplates.complaintNotification({ ...base, priority: "NORMAL" });
    const unset = emailTemplates.complaintNotification(base);
    expect(high.html).toContain("TINGGI");
    expect(normal.html).toContain("NORMAL");
    // Tanpa properti priority → fallback NORMAL
    expect(unset.html).toContain("NORMAL");
  });

  it("escapeHtml: input berbahaya tidak di-render sebagai HTML", () => {
    const t = emailTemplates.complaintNotification({
      ...base,
      name: "<script>alert(1)</script>",
      message: "<img src=x onerror=alert(2)>",
    });
    expect(t.html).not.toContain("<script>");
    expect(t.html).not.toContain("<img src=x");
    expect(t.html).toContain("&lt;script&gt;");
    expect(t.html).toContain("&lt;img src=x");
  });

  it("subject dengan karakter spesial tetap ter-escape", () => {
    const t = emailTemplates.complaintNotification({ ...base, subject: "<b>Urgen&t</b>" });
    expect(t.subject).toContain("&lt;b&gt;Urgen&amp;t&lt;/b&gt;");
  });

  it("memandu admin membalas lewat dashboard (link /dashboard/complaints)", () => {
    const t = emailTemplates.complaintNotification(base);
    expect(t.html).toContain("/dashboard/complaints");
    expect(t.html).toContain("Balas di Dashboard");
    // Link harus mengarah ke base URL publik, bukan relative semata
    expect(t.html).toMatch(/https?:\/\/[^"']+\/dashboard\/complaints/);
  });
});

describe("emailTemplates.contactNotification", () => {
  it("membuat subjek dan isi pesan kontak", () => {
    const t = emailTemplates.contactNotification("Siti", "Absensi", "Mohon info.");
    expect(t.subject).toContain("Pesan Baru");
    expect(t.subject).toContain("Absensi");
    expect(t.html).toContain("Siti");
    expect(t.html).toContain("Mohon info.");
  });
});
