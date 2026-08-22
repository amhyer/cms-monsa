// warmup: /api/news /api/agenda /api/achievements /api/settings
import { test, expect } from "./mutation-log";

const TABLET = { width: 768, height: 1024 };

test.describe("Tablet layout — iPad (768px)", () => {
  // ─── Header ──────────────────────────────────────────────────────
  test.describe("Header", () => {
    test("desktop nav is hidden; hamburger button is visible", async ({
      page,
    }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      // Desktop nav hidden below xl (1280px)
      const desktopNav = page.getByRole("navigation", {
        name: "Navigasi utama",
      });
      await expect(desktopNav).toBeHidden();

      // Hamburger visible below xl
      const hamburger = page.getByRole("button", {
        name: "Buka menu navigasi",
      });
      await expect(hamburger).toBeVisible();
    });

    test("hamburger opens mobile sheet with all nav items", async ({
      page,
    }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      await page.getByRole("button", { name: "Buka menu navigasi" }).click();

      const mobileNav = page.getByRole("navigation", {
        name: "Navigasi mobile",
      });
      await expect(mobileNav).toBeVisible();

      for (const label of [
        "Beranda",
        "Profil",
        "Akademik",
        "Berita",
        "Galeri",
        "Kontak",
      ]) {
        await expect(
          mobileNav.getByRole("button", { name: label }),
        ).toBeVisible();
      }
    });

    test("navigating via mobile sheet closes the sheet", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      await page.getByRole("button", { name: "Buka menu navigasi" }).click();
      const mobileNav = page.getByRole("navigation", {
        name: "Navigasi mobile",
      });
      await expect(mobileNav).toBeVisible();

      await mobileNav.getByRole("button", { name: "Profil" }).click();
      await expect(page).toHaveURL(/\/profile/);
      await expect(mobileNav).toBeHidden();
    });
  });

  // ─── Home page ───────────────────────────────────────────────────
  test.describe("Home page", () => {
    test("hero section renders and is visible", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      const hero = page
        .locator('[aria-label="Berita terkini"], section.bg-sidebar')
        .first();
      await expect(hero).toBeVisible();
    });

    test("stats section uses 2-column grid at sm+ breakpoint", async ({
      page,
    }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      await expect(
        page.getByRole("heading", { name: "Statistik Cepat" }),
      ).toBeVisible();

      // Stats grid should render with sm:grid-cols-2 layout
      const statsGrid = page.locator(
        '[class*="grid-cols-1"][class*="sm:grid-cols-2"]',
      );
      await expect(statsGrid.first()).toBeVisible();
    });

    test("principal welcome section uses md:grid-cols-3 layout", async ({
      page,
    }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      // Principal photo + welcome text in a 3-column grid at md
      const welcomeSection = page.locator(
        '[class*="md:grid-cols-3"]',
      );
      await expect(welcomeSection.first()).toBeVisible();
    });

    test("SPMB CTA section is visible and not clipped", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      const spmbHeading = page.getByRole("heading", {
        name: /Sistem Penerimaan Murid Baru/,
      });
      await spmbHeading.scrollIntoViewIfNeeded();
      await expect(spmbHeading).toBeVisible();

      // No horizontal overflow
      const overflows = await page.evaluate(
        () => document.body.scrollWidth > window.innerWidth,
      );
      expect(overflows).toBe(false);
    });

    test("no horizontal overflow on the entire page", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const overflows = await page.evaluate(
        () => document.body.scrollWidth > window.innerWidth,
      );
      expect(overflows).toBe(false);
    });
  });

  // ─── Contact page ────────────────────────────────────────────────
  test.describe("Contact page", () => {
    test("contact form renders with all fields", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/contact");

      await expect(
        page.getByRole("heading", { name: "Hubungi Kami & SPMB" }),
      ).toBeVisible();

      await expect(page.getByPlaceholder("Nama Anda")).toBeVisible();
      await expect(page.getByPlaceholder("email@contoh.com")).toBeVisible();
      await expect(page.getByPlaceholder("Subjek pesan")).toBeVisible();
      await expect(
        page.getByPlaceholder("Tulis pesan Anda di sini…"),
      ).toBeVisible();
    });

    test("SPMB quota cards are all visible", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/contact");

      const spmbHeading = page.getByRole("heading", {
        name: "Info SPMB 2025/2026",
      });
      await spmbHeading.scrollIntoViewIfNeeded();
      await expect(spmbHeading).toBeVisible();

      await expect(page.getByRole("heading", { name: "Zonasi" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Afirmasi" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Prestasi" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Perpindahan Tugas" }),
      ).toBeVisible();
    });

    test("no horizontal overflow on contact page", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/contact");
      await page.waitForLoadState("networkidle");

      const overflows = await page.evaluate(
        () => document.body.scrollWidth > window.innerWidth,
      );
      expect(overflows).toBe(false);
    });
  });

  // ─── Footer ──────────────────────────────────────────────────────
  test.describe("Footer", () => {
    test("footer renders with 3-column grid at md breakpoint", async ({
      page,
    }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      const footer = page.getByRole("contentinfo", { name: "Footer situs" });
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();

      // md:grid-cols-3 should be active — all 3 sections render
      await expect(footer.getByText("Mongisidi").first()).toBeVisible();
      await expect(footer.getByText("Tautan Cepat")).toBeVisible();
      await expect(footer.getByText("Sosial Media")).toBeVisible();
    });

    test("footer quick links are accessible", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      const footer = page.getByRole("contentinfo", { name: "Footer situs" });
      await footer.scrollIntoViewIfNeeded();

      for (const label of ["Beranda", "Profil", "Berita", "Galeri"]) {
        await expect(
          footer.getByRole("button", { name: label }),
        ).toBeVisible();
      }
    });

    test("Portal Admin button is visible", async ({ page }) => {
      await page.setViewportSize(TABLET);
      await page.goto("/");

      const footer = page.getByRole("contentinfo", { name: "Footer situs" });
      await footer.scrollIntoViewIfNeeded();
      await expect(
        footer.getByRole("button", { name: "Portal Admin" }),
      ).toBeVisible();
    });
  });
});
