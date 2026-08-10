import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe("Agenda CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("should navigate to agenda management via the sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Agenda Sekolah" }).click();
    await expect(
      page.getByRole("heading", { name: "Agenda Sekolah", level: 2 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/agenda/);
  });

  test("should create, read, edit and delete an agenda item", async ({ page }) => {
    await page.getByRole("button", { name: "Agenda Sekolah" }).click();
    await expect(
      page.getByRole("heading", { name: "Agenda Sekolah", level: 2 })
    ).toBeVisible();

    const title = uniqueTitle("E2E Agenda");

    // --- CREATE ---
    await page.getByRole("button", { name: "Tambah Agenda" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Tambah Agenda" })
    ).toBeVisible();

    await page.getByLabel("Nama Kegiatan", { exact: true }).fill(title);
    await page.getByLabel("Tanggal", { exact: true }).fill("2026-12-31");
    await page.getByLabel("Waktu", { exact: true }).fill("07.00 - 08.00 WIB");
    await page.getByLabel("Lokasi", { exact: true }).fill("Lapangan Utama");
    await page
      .getByLabel("Deskripsi", { exact: true })
      .fill("Deskripsi agenda dari test E2E.");
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("Agenda ditambahkan.")).toBeVisible();
    // Filter the table with the search box to make the row deterministic.
    await page.getByPlaceholder("Cari kegiatan atau lokasi…").fill(title);
    const row = page.getByRole("row").filter({ hasText: title });
    // formatDate uses month: "long" (id-ID) → "31 Desember 2026".
    await expect(row).toContainText("31 Desember 2026");
    await expect(row).toContainText("Lapangan Utama");

    // --- UPDATE ---
    const editedTitle = `${title} (diubah)`;
    await row.getByRole("button", { name: "Edit agenda" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Edit Agenda" })
    ).toBeVisible();
    await page.getByLabel("Nama Kegiatan", { exact: true }).fill(editedTitle);
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("Agenda diperbarui.")).toBeVisible();
    await page.getByPlaceholder("Cari kegiatan atau lokasi…").fill(editedTitle);
    const editedRow = page.getByRole("row").filter({ hasText: editedTitle });
    await expect(editedRow).toContainText(editedTitle);

    // --- DELETE ---
    await editedRow.getByRole("button", { name: "Hapus agenda" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Hapus", exact: true })
      .click();

    await expect(page.getByText("Agenda dihapus.")).toBeVisible();
    await expect(editedRow).toHaveCount(0);
  });
});
