import { test, expect } from "@playwright/test";
import { ADMIN, enableDarkMode, goldRef, login } from "./helpers";

/** Probe computed backgroundColor dari satu kelas Tailwind (tanpa dark:). */
async function probeBg(page: import("@playwright/test").Page, className: string) {
  return page.evaluate((cls) => {
    const probe = document.createElement("span");
    probe.className = cls;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  }, className);
}

test.describe("Dashboard dark mode — stat cards & topbar konsisten", () => {
  test("lingkaran ikon kartu statistik translucent (bukan pastel solid) di dark mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    // Kartu statistik dimuat async dari /api/stats.
    await expect(page.getByText("Total Siswa")).toBeVisible();

    // Kartu pastel yang dulu berubah jadi blok terang di dark mode.
    const pastelCards = {
      "Total Siswa": "bg-indigo-100",
      "Total Kelas": "bg-emerald-100",
      "Total Kunjungan": "bg-amber-100",
    };

    // Baseline light mode: lingkaran sama dengan pastel solid.
    for (const [label, lightCls] of Object.entries(pastelCards)) {
      const card = page.locator("div.overflow-hidden", { hasText: label }).first();
      const circle = card.locator("div.rounded-full");
      const solid = await probeBg(page, lightCls);
      const circleBg = await circle.evaluate(
        (el) => getComputedStyle(el).backgroundColor
      );
      expect(circleBg, `lingkaran ${label} pastel solid di light mode`).toBe(
        solid
      );
    }

    await enableDarkMode(page);

    // Dark mode: lingkaran harus translucent (dark:*-500/15) — bukan pastel
    // solid terang yang mencolok di kartu gelap.
    for (const [label, lightCls] of Object.entries(pastelCards)) {
      const card = page.locator("div.overflow-hidden", { hasText: label }).first();
      const circle = card.locator("div.rounded-full");
      const solid = await probeBg(page, lightCls);
      const circleBg = await circle.evaluate(
        (el) => getComputedStyle(el).backgroundColor
      );
      expect(
        circleBg,
        `lingkaran ${label} tidak boleh pastel solid di dark mode`
      ).not.toBe(solid);
    }

    await page.screenshot({ path: "test-results/dashboard-statcards-dark.png" });
  });

  test("topbar dashboard tetap navy (bukan emas) di dark mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);

    const topbar = page.locator("header").first();
    await expect(topbar).toBeVisible();

    await enableDarkMode(page);

    // Topbar harus satu navy dengan token sidebar — bukan emas (bg-primary).
    const gold = await goldRef(page);
    const sidebar = await probeBg(page, "bg-sidebar");
    const topbarBg = await topbar.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(topbarBg, "topbar tidak boleh emas di dark mode").not.toBe(gold);
    expect(topbarBg).toBe(sidebar);

    await page.screenshot({ path: "test-results/dashboard-topbar-dark.png" });
  });
});
