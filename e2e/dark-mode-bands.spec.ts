import { test, expect, type Page } from "@playwright/test";

/** Halaman publik yang memakai PageBanner (band hero navy). */
const PAGES_WITH_BANNER = [
  "/profile",
  "/academic",
  "/gallery",
  "/news",
  "/contact",
  "/struktur-organisasi",
];

/** Nyalakan dark mode lewat toggle sungguhan, lalu tunggu `.dark` terpasang. */
async function enableDarkMode(page: Page) {
  await page.getByRole("button", { name: "Aktifkan mode gelap" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark"))
    )
    .toBe(true);
}

/** Referensi warna emas pada tema berjalan (probe elemen `bg-gold`). */
const goldRef = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "bg-gold";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });

test.describe("Band navy + emas — tidak berubah emas di dark mode", () => {
  for (const path of PAGES_WITH_BANNER) {
    test(`PageBanner di ${path} tetap navy (bukan emas) di dark mode`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);
      // PublicSite baru render setelah fetchSettings — tunggu h1 banner.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const banner = page.locator("section.bg-sidebar", {
        has: page.getByRole("heading", { level: 1 }),
      });
      await expect(banner).toBeVisible();

      const header = page.locator("header").first();

      await enableDarkMode(page);

      const gold = await goldRef(page);
      const headerBg = await header.evaluate(
        (el) => getComputedStyle(el).backgroundColor
      );
      const bannerBg = await banner.evaluate(
        (el) => getComputedStyle(el).backgroundColor
      );
      // Regresi lama: band memakai bg-primary → berubah emas di dark mode.
      expect(bannerBg, "PageBanner tidak boleh emas di dark mode").not.toBe(gold);
      // Harus satu navy dengan header (bg-sidebar).
      expect(bannerBg).toBe(headerBg);
    });
  }

  test("band home (hero, CTA SPMB, marquee) tetap navy (bukan emas) di dark mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();

    const hero = page.locator('section[aria-label="Berita terkini"]');
    const cta = page.locator("section.bg-sidebar", {
      hasText: "Sistem Penerimaan Murid Baru",
    });
    const marquee = page.locator('[aria-label="Pengumuman berjalan"]');
    await expect(hero).toBeVisible();
    await expect(cta).toBeVisible();
    await expect(marquee).toBeVisible();

    const header = page.locator("header").first();

    await enableDarkMode(page);

    const gold = await goldRef(page);
    const headerBg = await header.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    for (const band of [hero, cta, marquee]) {
      const bg = await band.evaluate(
        (el) => getComputedStyle(el).backgroundColor
      );
      expect(bg, "band tidak boleh emas di dark mode").not.toBe(gold);
      expect(bg).toBe(headerBg);
    }

    await page.screenshot({ path: "test-results/bands-home-dark.png" });
  });
});
