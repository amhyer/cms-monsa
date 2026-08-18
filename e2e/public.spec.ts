import { test, expect } from "./mutation-log";

// warmup: /api/news /api/announcements /api/gallery /api/agenda
test.describe("Public Site", () => {
  test("should load the home page with navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
    for (const label of ["Beranda", "Profil", "Akademik", "Berita", "Galeri", "Pengaduan", "Kontak"]) {
      await expect(page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("should render profile page", async ({ page }) => {
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Profil Sekolah" })
    ).toBeVisible();
  });

  test("should render news page", async ({ page }) => {
    await page.goto("/news");
    await expect(
      page.getByRole("heading", { name: "Berita & Pengumuman" })
    ).toBeVisible();
  });

  test("should render gallery page", async ({ page }) => {
    await page.goto("/gallery");
    await expect(
      page.getByRole("heading", { name: "Galeri Kegiatan" })
    ).toBeVisible();
  });

  test("should render contact page", async ({ page }) => {
    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { name: "Hubungi Kami & SPMB" })
    ).toBeVisible();
  });

  test("should render complaint page", async ({ page }) => {
    await page.goto("/complaint");
    await expect(
      page.getByRole("heading", { name: "Pengaduan & Aspirasi" })
    ).toBeVisible();
  });

  test("should render academic page", async ({ page }) => {
    await page.goto("/academic");
    await expect(
      page.getByRole("heading", { name: "Akademik & Direktori" })
    ).toBeVisible();
  });
});
