import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe("Gallery CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("should navigate to gallery management via the sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Galeri Media" }).click();
    await expect(
      page.getByRole("heading", { name: "Galeri Media", level: 2 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/gallery/);
  });

  test("should create, read, edit and delete a gallery item", async ({ page }) => {
    await page.getByRole("button", { name: "Galeri Media" }).click();
    await expect(
      page.getByRole("heading", { name: "Galeri Media", level: 2 })
    ).toBeVisible();

    const title = uniqueTitle("E2E Media");
    const imgUrl = "https://placehold.co/600x400?text=E2E";

    // --- CREATE ---
    await page.getByRole("button", { name: "Tambah Media" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Tambah Media" })
    ).toBeVisible();

    await page.getByLabel("Judul", { exact: true }).fill(title);
    // Switch the image picker to URL mode (avoids file upload).
    await page.getByRole("button", { name: "Gunakan URL" }).click();
    await page.getByPlaceholder("https://...").fill(imgUrl);
    await page.getByLabel("Deskripsi", { exact: true }).fill("Deskripsi media dari test E2E.");
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("Media ditambahkan.")).toBeVisible();
    // The grid has no search — scope by the card that owns the title. Cards
    // render as <div data-slot="card"> (see ui/card.tsx).
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(title, { exact: true }) });
    await expect(card).toContainText(title);

    // --- READ (category badge visible in the card) ---
    await expect(card).toContainText("Kegiatan");
    await expect(card).toContainText("PHOTO");

    // --- UPDATE ---
    const editedTitle = `${title} (diubah)`;
    await card.getByRole("button", { name: "Edit media" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Edit Media" })
    ).toBeVisible();
    await page.getByLabel("Judul", { exact: true }).fill(editedTitle);
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("Media diperbarui.")).toBeVisible();
    const editedCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(editedTitle, { exact: true }) });
    await expect(editedCard).toContainText(editedTitle);

    // --- DELETE ---
    await editedCard.getByRole("button", { name: "Hapus media" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Hapus", exact: true })
      .click();

    await expect(page.getByText("Media dihapus.")).toBeVisible();
    await expect(editedCard).toHaveCount(0);
  });
});
