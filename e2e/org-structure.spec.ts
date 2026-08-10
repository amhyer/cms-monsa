import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe("Struktur Organisasi — halaman publik", () => {
  test("banner + 6 anggota (foto, nama, jabatan) tampil", async ({ page }) => {
    await page.goto("/struktur-organisasi");

    await expect(
      page.getByRole("heading", { name: "Struktur Organisasi" })
    ).toBeVisible();

    // Data dari seed (lihat prisma/seed.ts — blok STRUKTUR ORGANISASI).
    const anggota = [
      { name: "Nawawi Hamzah, S.Pd., M.Pd.", position: "Kepala Sekolah" },
      { name: "Muhammad Yusuf, S.Pd.", position: "Wakil Kepala Sekolah" },
      { name: "Siti Aminah, S.Pd.", position: "Bendahara Sekolah" },
      { name: "Andi Mappangara, S.Pd.", position: "Koordinator Kurikulum" },
      { name: "Rahmat Hidayat, S.Pd.", position: "Koordinator Kesiswaan" },
      { name: "Nurul Aini, S.Pd.", position: "Koordinator Sarana Prasarana" },
    ];
    for (const a of anggota) {
      await expect(
        page.getByRole("heading", { name: a.name, level: 3 })
      ).toBeVisible();
      await expect(page.getByText(a.position, { exact: true })).toBeVisible();
      await expect(page.locator(`img[alt="${a.name}"]`)).toBeVisible();
    }
  });
});

test.describe("Struktur Organisasi — dashboard admin (CRUD)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("navigasi ke manajemen via sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Struktur Organisasi" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Struktur Organisasi Sekolah",
        level: 2,
      })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/org-structure/);
  });

  test("buat, baca, ubah, dan hapus anggota", async ({ page }) => {
    await page.getByRole("button", { name: "Struktur Organisasi" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Struktur Organisasi Sekolah",
        level: 2,
      })
    ).toBeVisible();

    const name = uniqueName("E2E Anggota");

    // --- CREATE ---
    await page.getByRole("button", { name: "Tambah Anggota" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Tambah Anggota Struktur" })
    ).toBeVisible();
    await dialog.getByLabel("Nama", { exact: true }).fill(name);
    await dialog.getByLabel("Jabatan", { exact: true }).fill("Koordinator E2E");
    await dialog.getByRole("button", { name: "Simpan" }).click();

    await expect(
      page.getByText("Struktur organisasi ditambahkan.")
    ).toBeVisible();

    // --- READ (kartu anggota muncul di daftar) ---
    const card = page.locator("div.bg-card").filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Koordinator E2E");

    // --- UPDATE ---
    const edited = `${name} (diubah)`;
    await card.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog");
    await expect(
      editDialog.getByRole("heading", { name: "Edit Anggota Struktur" })
    ).toBeVisible();
    await editDialog.getByLabel("Nama", { exact: true }).fill(edited);
    await editDialog.getByRole("button", { name: "Simpan" }).click();

    await expect(
      page.getByText("Struktur organisasi diperbarui.")
    ).toBeVisible();
    await expect(
      page.locator("div.bg-card").filter({ hasText: edited })
    ).toBeVisible();

    // --- DELETE ---
    const editedCard = page.locator("div.bg-card").filter({ hasText: edited });
    await editedCard.getByRole("button", { name: "Hapus" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Hapus", exact: true })
      .click();

    await expect(
      page.getByText("Struktur organisasi dihapus.")
    ).toBeVisible();
    await expect(
      page.locator("div.bg-card").filter({ hasText: edited })
    ).toHaveCount(0);
  });
});
