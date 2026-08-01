import { test, expect, type Page } from "@playwright/test";

const ADMIN = {
  email: "admin@mongisidi1.sch.id",
  password: "admin123",
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test.describe("Login Flow", () => {
  test("should render the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Masuk" })
    ).toBeVisible();
  });

  test("should show error for empty credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Email dan password wajib diisi.")).toBeVisible();
  });

  test("should show error for wrong password", async ({ page }) => {
    await login(page, ADMIN.email, "salah-password");
    // Scope to the alert — the same text also appears in a sonner toast.
    await expect(
      page.getByRole("alert").getByText("Email atau password salah.")
    ).toBeVisible();
    // Still on the login page (no session created).
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("should navigate to dashboard after successful login", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: /Selamat datang kembali/ })
    ).toBeVisible();
  });

  test("should logout successfully", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.waitForURL("**/dashboard");

    // Open the user dropdown and choose Logout.
    await page.getByRole("button", { name: "Menu pengguna" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).click();

    // Back on the login page, and the dashboard is no longer accessible.
    await page.waitForURL("**/login");
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
