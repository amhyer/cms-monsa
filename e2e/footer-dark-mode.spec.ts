import { test, expect, type Page } from "@playwright/test";

const ADMIN = {
  email: "admin@mongisidi1.sch.id",
  password: "admin123",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
}

/** Nyalakan dark mode lewat toggle sungguhan, lalu tunggu `.dark` terpasang. */
async function enableDarkMode(page: Page) {
  await page.getByRole("button", { name: "Aktifkan mode gelap" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark"))
    )
    .toBe(true);
}

/**
 * Referensi warna emas pada tema berjalan: probe elemen ber-kelas `bg-gold`
 * lalu baca computed backgroundColor (format sama dengan elemen lain).
 */
const goldRef = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "bg-gold";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });

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
    await login(page);

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
