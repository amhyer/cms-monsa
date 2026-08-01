import { test, expect, type Page } from "@playwright/test";

const ADMIN = {
  email: "admin@mongisidi1.sch.id",
  password: "admin123",
};

const OPERATOR = {
  email: "operator@mongisidi1.sch.id",
  password: "operator123",
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("RBAC - Role-Based Access Control", () => {
  test("unauthenticated user should be redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("operator should not access user management", async ({ page }) => {
    await login(page, OPERATOR.email, OPERATOR.password);
    // Admin-only module → dashboard shell shows "Akses Ditolak".
    // CardTitle is a <div>, so assert by text, not heading role.
    await page.goto("/dashboard#/dashboard/users");
    await expect(page.getByText("Akses Ditolak")).toBeVisible();
    await expect(
      page.getByText(/Halaman ini hanya tersedia untuk Super Admin/)
    ).toBeVisible();
  });

  test("super admin should access user management", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard#/dashboard/users");
    // The module's own <h2> is "Manajemen Akun"; "Manajemen Operator" only
    // appears in the topbar as an <h1>, so match the module heading here.
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();
  });

  test("operator can access content management (news)", async ({ page }) => {
    await login(page, OPERATOR.email, OPERATOR.password);
    await page.goto("/dashboard#/dashboard/news");
    await expect(
      page.getByRole("heading", { name: "Berita & Artikel", level: 2 })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tambah Berita" })
    ).toBeVisible();
  });
});
