import { test, expect } from "@playwright/test";
import { ADMIN, OPERATOR, GURU, login } from "./helpers";

test.describe("RBAC - Role-Based Access Control", () => {
  test("unauthenticated user should be redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    // Redirect membawa query string (?redirect=...), jadi pola harus longgar.
    await page.waitForURL("**/login**");
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("operator should not access user management", async ({ page }) => {
    await login(page, OPERATOR.email, OPERATOR.password);
    // Admin-only module → dashboard shell shows "Akses Ditolak".
    // CardTitle is a <div>, so assert by text, not heading role.
    await page.goto("/dashboard/users");
    await expect(page.getByText("Akses Ditolak")).toBeVisible();
    await expect(
      page.getByText(/Halaman ini hanya tersedia untuk Super Admin/)
    ).toBeVisible();
  });

  test("super admin should access user management", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    // The module's own <h2> is "Manajemen Akun"; "Manajemen Operator" only
    // appears in the topbar as an <h1>, so match the module heading here.
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();
  });

  test("operator can access content management (news)", async ({ page }) => {
    await login(page, OPERATOR.email, OPERATOR.password);
    await page.goto("/dashboard/news");
    await expect(
      page.getByRole("heading", { name: "Berita & Artikel", level: 2 })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tambah Berita" })
    ).toBeVisible();
  });

  test("guru can access dashboard and attendance (wali kelas)", async ({ page }) => {
    await login(page, GURU.email, GURU.password);
    // GURU diizinkan di /dashboard (Ringkasan) dan /dashboard/attendance.
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/dashboard/attendance");
    await expect(
      page.getByRole("heading", { name: "Kehadiran (Absensi)", level: 2 })
    ).toBeVisible();
  });

  test("guru should be denied content management (news)", async ({ page }) => {
    await login(page, GURU.email, GURU.password);
    // GURU diblokir di level URL untuk semua modul selain Ringkasan/Kehadiran.
    await page.goto("/dashboard/news");
    await expect(page.getByText("Akses Ditolak")).toBeVisible();
    await expect(
      page.getByText(/Akun Guru hanya dapat mengakses Ringkasan/)
    ).toBeVisible();
  });
});
