import { test, expect } from "@playwright/test";
import { login, ADMIN } from "./helpers";

test.describe("Activity Logs", () => {
  test("admin can view activity logs page", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/dashboard/logs");
    await page.waitForLoadState("networkidle");

    // Should show the page heading
    await expect(page.getByText("Log Aktivitas")).toBeVisible();
    await expect(
      page.getByText("Catatan ini merekam semua aktivitas")
    ).toBeVisible();
  });

  test("activity logs shows filter and export buttons", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/dashboard/logs");
    await page.waitForLoadState("networkidle");

    // Should have filter selector
    await expect(page.getByText("Filter entitas:")).toBeVisible();
    // Should have export button
    await expect(page.getByRole("button", { name: /Export CSV/i })).toBeVisible();
  });

  test("filter dropdown has entity options", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/dashboard/logs");
    await page.waitForLoadState("networkidle");

    // Open filter dropdown
    const filterTrigger = page.locator("[class*='select-trigger']").first();
    if (await filterTrigger.isVisible()) {
      await filterTrigger.click();
      // Should show "Semua Entitas" option
      await expect(page.getByText("Semua Entitas")).toBeVisible();
    }
  });
});
