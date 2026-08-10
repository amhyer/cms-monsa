import { test, expect } from "@playwright/test";

test.describe("Header desktop — navy + emas", () => {
  test("nav tengah tampil di desktop, item aktif emas, hover konsisten tema", async ({
    page,
  }) => {
    // Viewport desktop lebar (> breakpoint xl 1280px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const header = page.locator("header").first();
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });

    // 1. Latar header solid navy (kelas bg-sidebar) — bukan transparan/putih
    await expect(header).toHaveClass(/bg-sidebar/);
    const headerBg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(headerBg).not.toBe("rgba(0, 0, 0, 0)");

    // 2. Nav tengah tampil di viewport desktop lebar
    await expect(nav).toBeVisible();

    // Referensi warna emas: underline item aktif (span.bg-gold)
    const gold = await page.evaluate(() => {
      const underline = document.querySelector(
        "nav[aria-label='Navigasi utama'] button[aria-current='page'] span.bg-gold"
      );
      return underline ? getComputedStyle(underline).backgroundColor : null;
    });
    expect(gold).not.toBeNull();

    // 3. Item aktif (Beranda) beraksen emas
    const beranda = nav.getByRole("button", { name: "Beranda" });
    await expect(beranda).toHaveAttribute("aria-current", "page");
    await expect
      .poll(() => beranda.evaluate((el) => getComputedStyle(el).color))
      .toBe(gold);

    // 4. Item non-aktif tidak emas, dan menjadi emas saat hover (state nyata)
    const profil = nav.getByRole("button", { name: "Profil" });
    const beforeColor = await profil.evaluate((el) => getComputedStyle(el).color);
    expect(beforeColor).not.toBe(gold);
    await profil.hover();
    await expect
      .poll(() => profil.evaluate((el) => getComputedStyle(el).color))
      .toBe(gold);

    // Screenshot bukti visual: header desktop + item aktif emas
    await page.screenshot({ path: "test-results/header-desktop-top.png" });

    // Hover state pada item lain yang tidak aktif
    const akademik = nav.getByRole("button", { name: "Akademik" });
    await akademik.hover();
    await expect
      .poll(() => akademik.evaluate((el) => getComputedStyle(el).color))
      .toBe(gold);
    await page.screenshot({ path: "test-results/header-desktop-hover.png" });
  });

  test("item aktif mengikuti route di halaman publik (struktur-organisasi, news)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    const goldOf = () =>
      page.evaluate(() => {
        const underline = document.querySelector(
          "nav[aria-label='Navigasi utama'] button[aria-current='page'] span.bg-gold"
        );
        return underline ? getComputedStyle(underline).backgroundColor : null;
      });
    const itemColor = (label: string) =>
      nav
        .getByRole("button", { name: label })
        .evaluate((el) => getComputedStyle(el).color);

    // Halaman publik baru /struktur-organisasi — item aktif sesuai route
    await page.goto("/struktur-organisasi");
    await expect(
      page.getByRole("heading", { name: "Struktur Organisasi" })
    ).toBeVisible();
    const strukturItem = nav.getByRole("button", { name: "Struktur Organisasi" });
    // toHaveAttribute menunggu hydration/setting aria-current selesai
    await expect(strukturItem).toHaveAttribute("aria-current", "page");
    const goldStruktur = await goldOf();
    expect(goldStruktur).not.toBeNull();
    await expect.poll(() => itemColor("Struktur Organisasi")).toBe(goldStruktur);

    // Halaman lain: /news → item Berita aktif
    await page.goto("/news");
    await expect(
      page.getByRole("heading", { name: "Berita & Pengumuman" })
    ).toBeVisible();
    const beritaItem = nav.getByRole("button", { name: "Berita" });
    await expect(beritaItem).toHaveAttribute("aria-current", "page");
    const goldNews = await goldOf();
    expect(goldNews).not.toBeNull();
    await expect.poll(() => itemColor("Berita")).toBe(goldNews);

    // Screenshot: header konsisten di /struktur-organisasi (item aktif emas)
    await page.goto("/struktur-organisasi");
    // Tunggu settings termuat (PublicSite baru render header setelah fetchSettings)
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(strukturItem).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: "test-results/header-struktur-organisasi.png" });
  });
});
