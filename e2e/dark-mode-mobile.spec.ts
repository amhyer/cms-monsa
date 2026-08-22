// warmup: /api/news /api/agenda /api/achievements /api/settings
import { test, expect } from "./mutation-log";

const MOBILE = { width: 375, height: 667 };

/**
 * Helper: navigate to a page at mobile viewport, toggle dark mode, and
 * wait for the `.dark` class to appear on the document.
 */
async function enableDarkMode(page: import("@playwright/test").Page, path = "/") {
  await page.setViewportSize(MOBILE);
  await page.goto(path, { waitUntil: "networkidle" });

  // The ThemeToggle renders a disabled placeholder on first paint; wait for
  // it to become interactive (mounted = true).
  const toggle = page.getByRole("button", {
    name: /Aktifkan mode (gelap|terang)/,
  });
  // It may already be in dark or light — check what aria-label it has.
  const label = await toggle.getAttribute("aria-label");

  // Only click if we're in light mode (need to switch to dark)
  if (label === "Aktifkan mode gelap") {
    // Already dark
    return;
  }
  await toggle.click();

  // Wait for the `.dark` class to appear on <html>
  await expect(page.locator("html")).toHaveClass(/dark/);
}

test.describe("Dark mode — mobile (375px)", () => {
  // ─── Theme toggle ────────────────────────────────────────────────
  test.describe("Theme toggle", () => {
    test("theme toggle is visible and accessible on mobile", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      // Wait for mount
      const toggle = page.getByRole("button", {
        name: /Aktifkan mode (gelap|terang)/,
      });
      await expect(toggle).toBeVisible();
    });

    test("clicking toggle switches from light to dark mode", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      const toggle = page.getByRole("button", {
        name: /Aktifkan mode (gelap|terang)/,
      });
      await expect(toggle).toBeVisible();

      const initialLabel = await toggle.getAttribute("aria-label");

      // Toggle to the opposite mode
      await toggle.click();

      // The label should change
      const newLabel = await toggle.getAttribute("aria-label");
      expect(newLabel).not.toBe(initialLabel);

      // .dark class should be present on <html>
      await expect(page.locator("html")).toHaveClass(/dark/);
    });

    test("clicking toggle again switches back to light mode", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      const toggle = page.getByRole("button", {
        name: /Aktifkan mode (gelap|terang)/,
      });
      await expect(toggle).toBeVisible();

      // Click twice: light → dark → light
      await toggle.click();
      await toggle.click();

      // Should be back in light mode — no .dark class
      const htmlClass = await page.locator("html").getAttribute("class");
      expect(htmlClass).not.toMatch(/dark/);
    });
  });

  // ─── Home page dark mode ─────────────────────────────────────────
  test.describe("Home page", () => {
    test("background color changes in dark mode", async ({ page }) => {
      await enableDarkMode(page);

      // Body should use dark background (dark cards use oklch(0.22 0.03 264))
      const bgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });

      // Dark mode background is noticeably darker than light mode
      // oklch(0.17 0.02 264) ≈ rgb(22, 22, 37) — parse the rgb values
      const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      expect(match).toBeTruthy();
      if (match) {
        const [, r, g, b] = match.map(Number);
        // Dark background: all channels should be below ~80
        expect(r).toBeLessThan(80);
        expect(g).toBeLessThan(80);
        expect(b).toBeLessThan(80);
      }
    });

    test("heading text is visible in dark mode", async ({ page }) => {
      await enableDarkMode(page);

      // School branding / hero text
      await expect(
        page.getByRole("heading", { name: "Statistik Cepat" })
      ).toBeVisible();
    });

    test("no horizontal overflow in dark mode", async ({ page }) => {
      await enableDarkMode(page);

      const overflows = await page.evaluate(
        () => document.body.scrollWidth > window.innerWidth
      );
      expect(overflows).toBe(false);
    });

    test("stat cards are visible in dark mode", async ({ page }) => {
      await enableDarkMode(page);

      // Stats section should render with visible cards
      await expect(
        page.getByRole("heading", { name: "Statistik Cepat" })
      ).toBeVisible();

      // At least one stat card should be visible
      const statCards = page.locator(
        '[class*="grid-cols-1"][class*="sm:grid-cols-2"]'
      );
      await expect(statCards.first()).toBeVisible();
    });

    test("SPMB section renders correctly in dark mode", async ({ page }) => {
      await enableDarkMode(page);

      const spmbHeading = page.getByRole("heading", {
        name: /Sistem Penerimaan Murid Baru/,
      });
      await spmbHeading.scrollIntoViewIfNeeded();
      await expect(spmbHeading).toBeVisible();
    });

    test("footer renders correctly in dark mode", async ({ page }) => {
      await enableDarkMode(page);

      const footer = page.getByRole("contentinfo", { name: "Footer situs" });
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();

      await expect(footer.getByText("Tautan Cepat")).toBeVisible();
    });
  });

  // ─── Contact page dark mode ──────────────────────────────────────
  test.describe("Contact page", () => {
    test("contact form renders in dark mode", async ({ page }) => {
      await enableDarkMode(page, "/contact");

      await expect(
        page.getByRole("heading", { name: "Hubungi Kami & SPMB" })
      ).toBeVisible();

      await expect(page.getByPlaceholder("Nama Anda")).toBeVisible();
      await expect(page.getByPlaceholder("email@contoh.com")).toBeVisible();
    });

    test("no horizontal overflow on contact page in dark mode", async ({
      page,
    }) => {
      await enableDarkMode(page, "/contact");

      const overflows = await page.evaluate(
        () => document.body.scrollWidth > window.innerWidth
      );
      expect(overflows).toBe(false);
    });

    test("SPMB quota cards visible in dark mode", async ({ page }) => {
      await enableDarkMode(page, "/contact");

      const spmbHeading = page.getByRole("heading", {
        name: "Info SPMB 2025/2026",
      });
      await spmbHeading.scrollIntoViewIfNeeded();
      await expect(spmbHeading).toBeVisible();

      await expect(page.getByRole("heading", { name: "Zonasi" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Afirmasi" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Prestasi" })
      ).toBeVisible();
    });
  });

  // ─── Header dark mode ────────────────────────────────────────────
  test.describe("Header", () => {
    test("hamburger menu works in dark mode", async ({ page }) => {
      await enableDarkMode(page);

      const hamburger = page.getByRole("button", {
        name: "Buka menu navigasi",
      });
      await expect(hamburger).toBeVisible();

      await hamburger.click();

      const mobileNav = page.getByRole("navigation", {
        name: "Navigasi mobile",
      });
      await expect(mobileNav).toBeVisible();

      // Nav items should be visible
      await expect(
        mobileNav.getByRole("button", { name: "Beranda" })
      ).toBeVisible();
    });

    test("Login button visible in dark mode mobile sheet", async ({ page }) => {
      await enableDarkMode(page);

      await page.getByRole("button", { name: "Buka menu navigasi" }).click();

      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("button", { name: "Login" })).toBeVisible();
    });
  });
});
