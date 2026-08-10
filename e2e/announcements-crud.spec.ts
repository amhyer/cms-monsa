import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe("Announcements CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("should navigate to announcements management via the sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Pengumuman" }).click();
    await expect(
      page.getByRole("heading", { name: "Pengumuman", level: 2 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/announcements/);
  });

  test("should create, read, edit and delete an announcement", async ({ page }) => {
    await page.getByRole("button", { name: "Pengumuman" }).click();
    await expect(
      page.getByRole("heading", { name: "Pengumuman", level: 2 })
    ).toBeVisible();

    const title = uniqueTitle("E2E Pengumuman");

    // --- CREATE ---
    await page.getByRole("button", { name: "Buat Pengumuman" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Buat Pengumuman" })
    ).toBeVisible();

    await page.getByLabel("Judul", { exact: true }).fill(title);
    await page.getByLabel("Isi Pengumuman", { exact: true }).fill(
      "Isi pengumuman dari test E2E."
    );
    // Radix Switch — the label "Sematkan" also matches the pinned badges
    // (aria-label="Disematkan") in already-rendered cards, so target the
    // switch role explicitly.
    await page.getByRole("switch", { name: "Sematkan" }).click();
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("Pengumuman dibuat.")).toBeVisible();
    // Card grid (no search) — scope by the card that owns the title.
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(title, { exact: true }) });
    await expect(card).toContainText(title);

    // --- READ (badges reflect saved flags) ---
    await expect(card).toContainText("Aktif");
    await expect(card).toContainText("Disematkan");

    // --- UPDATE ---
    const editedTitle = `${title} (diubah)`;
    await card.getByRole("button", { name: "Edit pengumuman" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Edit Pengumuman" })
    ).toBeVisible();
    await page.getByLabel("Judul", { exact: true }).fill(editedTitle);
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("Pengumuman diperbarui.")).toBeVisible();
    const editedCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(editedTitle, { exact: true }) });
    await expect(editedCard).toContainText(editedTitle);

    // --- DELETE ---
    await editedCard.getByRole("button", { name: "Hapus pengumuman" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Hapus", exact: true })
      .click();

    await expect(page.getByText("Pengumuman dihapus.")).toBeVisible();
    await expect(editedCard).toHaveCount(0);
  });
});
