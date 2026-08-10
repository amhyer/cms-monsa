import { test, expect } from "@playwright/test";
import { ADMIN, enableDarkMode, goldRef, login } from "./helpers";

test.describe("Footer navy + emas — konsisten di dark mode", () => {
  test("footer publik tetap navy (bukan emas) di dark mode", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    // PublicSite baru render header setelah fetchSettings selesai
    await expect(page.getByRole("banner")).toBeVisible();

    const header = page.locator("header").first();
    const footer = page.locator('footer[aria-label="Footer situs"]');
    await expect(footer).toBeVisible();

    // Baseline light mode: footer satu navy dengan header, dan bukan emas.
    const goldLight = await goldRef(page);
    const headerLight = await header.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const footerLight = await footer.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(footerLight).not.toBe("rgba(0, 0, 0, 0)");
    expect(footerLight).toBe(headerLight);
    expect(footerLight).not.toBe(goldLight);

    // Dark mode: regresi lama membuat footer berubah emas (bg-primary).
    await enableDarkMode(page);
    const goldDark = await goldRef(page);
    const headerDark = await header.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const footerDark = await footer.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(footerDark).not.toBe(goldDark);
    expect(footerDark).toBe(headerDark);

    await page.screenshot({ path: "test-results/footer-public-dark.png" });
  });

  test("footer dashboard tetap navy (bukan emas) di dark mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);

    const topbar = page.locator("header").first();
    const footer = page.locator("footer").first();
    await expect(footer).toBeVisible();

    // Baseline light mode: topbar & footer satu navy.
    const goldLight = await goldRef(page);
    const topbarLight = await topbar.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const footerLight = await footer.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(footerLight).not.toBe("rgba(0, 0, 0, 0)");
    expect(footerLight).toBe(topbarLight);
    expect(footerLight).not.toBe(goldLight);

    // Dark mode: footer harus tetap navy, identik dengan topbar.
    await enableDarkMode(page);
    const goldDark = await goldRef(page);
    const topbarDark = await topbar.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const footerDark = await footer.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(footerDark).not.toBe(goldDark);
    expect(footerDark).toBe(topbarDark);

    await page.screenshot({ path: "test-results/footer-dashboard-dark.png" });
  });
});
