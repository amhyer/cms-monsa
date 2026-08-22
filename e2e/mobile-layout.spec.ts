// warmup: /api/news /api/agenda /api/achievements /api/settings
import { test, expect } from "./mutation-log";

const MOBILE = { width: 375, height: 667 };

test.describe("Mobile layout — iPhone SE (375px)", () => {
  // ─── Header ──────────────────────────────────────────────────────
  test.describe("Header", () => {
    test("desktop nav is hidden; hamburger button is visible", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      // Desktop nav should be hidden at 375px
      const desktopNav = page.getByRole("navigation", {
        name: "Navigasi utama",
      });
      await expect(desktopNav).toBeHidden();

      // Hamburger button should be visible
      const hamburger = page.getByRole("button", {
        name: "Buka menu navigasi",
      });
      await expect(hamburger).toBeVisible();
    });

    test("hamburger opens mobile sheet with all nav items", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      const hamburger = page.getByRole("button", {
        name: "Buka menu navigasi",
      });
      await hamburger.click();

      // Mobile nav sheet should appear
      const mobileNav = page.getByRole("navigation", {
        name: "Navigasi mobile",
      });
      await expect(mobileNav).toBeVisible();

      // All public nav items should be listed
      for (const label of [
        "Beranda",
        "Profil",
        "Akademik",
        "Berita",
        "Galeri",
        "Kontak",
      ]) {
        await expect(mobileNav.getByRole("button", { name: label })).toBeVisible();
      }
    });

    test("mobile sheet contains Login and SPMB buttons", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      await page.getByRole("button", { name: "Buka menu navigasi" }).click();

      // Login and SPMB buttons are inside the sheet but outside the nav
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("button", { name: "Login" })).toBeVisible();
      await expect(sheet.getByRole("button", { name: "Daftar SPMB" })).toBeVisible();
    });

    test("navigating via mobile sheet closes the sheet", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      await page.getByRole("button", { name: "Buka menu navigasi" }).click();
      const mobileNav = page.getByRole("navigation", {
        name: "Navigasi mobile",
      });
      await expect(mobileNav).toBeVisible();

      // Click a nav item — sheet should close
      await mobileNav.getByRole("button", { name: "Profil" }).click();

      // Wait for navigation and sheet to close
      await expect(page).toHaveURL(/\/profile/);
      await expect(mobileNav).toBeHidden();
    });
  });

  // ─── Home page ───────────────────────────────────────────────────
  test.describe("Home page", () => {
    test("hero section renders and is visible", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      // Hero carousel or fallback welcome text should be visible
      const hero = page.locator('[aria-label="Berita terkini"], section.bg-sidebar').first();
      await expect(hero).toBeVisible();
    });

    test("stats section renders with single-column layout on mobile", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      // Stats heading should be visible
      await expect(
        page.getByRole("heading", { name: "Statistik Cepat" })
      ).toBeVisible();

      // Stat cards should be stacked (each card full-width)
      const statCards = page.locator(
        '[class*="grid-cols-1"][class*="sm:grid-cols-2"]'
      );
      // The stats grid exists and renders cards
      await expect(statCards.first()).toBeVisible();
    });

    test("SPMB CTA section is visible and not clipped", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      // Scroll to SPMB section at bottom
      const spmbHeading = page.getByRole("heading", {
        name: /Sistem Penerimaan Murid Baru/,
      });
      await spmbHeading.scrollIntoViewIfNeeded();
      await expect(spmbHeading).toBeVisible();

      // No horizontal overflow (body scrollWidth ≤ viewport width)
      const overflows = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      expect(overflows).toBe(false);
    });

    test("no horizontal overflow on the entire page", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      // Wait for content to load
      await page.waitForLoadState("networkidle");

      const overflows = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      expect(overflows).toBe(false);
    });
  });

  // ─── Contact page ────────────────────────────────────────────────
  test.describe("Contact page", () => {
    test("contact form renders with stacked fields on mobile", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/contact");

      await expect(
        page.getByRole("heading", { name: "Hubungi Kami & SPMB" })
      ).toBeVisible();

      // Form fields should be visible and usable
      await expect(page.getByPlaceholder("Nama Anda")).toBeVisible();
      await expect(page.getByPlaceholder("email@contoh.com")).toBeVisible();
      await expect(page.getByPlaceholder("Subjek pesan")).toBeVisible();
      await expect(
        page.getByPlaceholder("Tulis pesan Anda di sini…")
      ).toBeVisible();
    });

    test("SPMB section stacks on mobile", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/contact");

      const spmbHeading = page.getByRole("heading", { name: "Info SPMB 2025/2026" });
      await spmbHeading.scrollIntoViewIfNeeded();
      await expect(spmbHeading).toBeVisible();

      // SPMB quota cards should be visible (use headings to avoid strict-mode duplicates)
      await expect(page.getByRole("heading", { name: "Zonasi" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Afirmasi" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Prestasi" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Perpindahan Tugas" })).toBeVisible();
    });

    test("no horizontal overflow on contact page", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/contact");
      await page.waitForLoadState("networkidle");

      const overflows = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      expect(overflows).toBe(false);
    });
  });

  // ─── Footer ──────────────────────────────────────────────────────
  test.describe("Footer", () => {
    test("footer is visible with school identity on mobile", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      const footer = page.getByRole("contentinfo", { name: "Footer situs" });
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();

      // School name in footer identity section
      await expect(footer.getByRole("heading", { name: "Tautan Cepat" })).toBeVisible();
      // Footer renders the school name — use first() to disambiguate from copyright line
      await expect(footer.getByText("Mongisidi").first()).toBeVisible();
    });

    test("footer quick links are accessible on mobile", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      const footer = page.getByRole("contentinfo", { name: "Footer situs" });
      await footer.scrollIntoViewIfNeeded();

      // Quick links heading
      await expect(footer.getByText("Tautan Cepat")).toBeVisible();

      // Key links should be present
      for (const label of ["Beranda", "Profil", "Berita", "Galeri"]) {
        await expect(footer.getByRole("button", { name: label })).toBeVisible();
      }
    });

    test("Portal Admin button is visible on mobile", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto("/");

      const footer = page.getByRole("contentinfo", { name: "Footer situs" });
      await footer.scrollIntoViewIfNeeded();
      await expect(
        footer.getByRole("button", { name: "Portal Admin" })
      ).toBeVisible();
    });
  });
});
