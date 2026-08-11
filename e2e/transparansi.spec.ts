import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

test.describe("Transparansi Anggaran (ARKAS / Dana BOS)", () => {
  test("halaman publik menampilkan belanja BOS & total", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/transparansi");
    await expect(
      page.getByRole("heading", { level: 1, name: "Transparansi Anggaran Sekolah" })
    ).toBeVisible();

    // Data seed BOS deterministik (prisma/seed.ts).
    await expect(
      page.getByRole("cell", { name: "Honorarium guru tidak tetap" })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Pembelian buku & alat peraga" })
    ).toBeVisible();
    await expect(page.getByText("BOS Reguler", { exact: true }).first()).toBeVisible();

    // Ringkasan: total belanja tampil (bukan nol).
    const totalCell = page.getByRole("cell", { name: /^Rp/ }).last();
    await expect(totalCell).toBeVisible();
    await expect(totalCell).not.toHaveText(/Rp0\b/);
  });

  test("dashboard admin — navigasi ke modul transparansi", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);

    await page.getByRole("button", { name: "Transparansi Anggaran" }).click();
    await expect(page).toHaveURL(/\/dashboard\/transparansi/);
    await expect(
      page.getByRole("heading", { name: "Transparansi Anggaran (ARKAS / Dana BOS)" })
    ).toBeVisible();
  });

  test("dashboard admin — CRUD belanja BOS lengkap", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(page.getByRole("button", { name: "Tambah Belanja" })).toBeVisible();

    // Nama unik per run → aman dari sisa data run sebelumnya & substring.
    const name = `Belanja test e2e ${Date.now()}`;
    const nameEdited = `${name} (edit)`;

    // CREATE
    await page.getByRole("button", { name: "Tambah Belanja" }).click();
    await page.getByLabel("Uraian Belanja").fill(name);
    await page.getByLabel("Kategori Belanja").fill("Operasional");
    await page.getByLabel("Nominal (Rp)").fill("2500000");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Belanja ditambahkan.")).toBeVisible();
    const cell = (text: string) =>
      page.getByRole("cell", { name: text, exact: true });
    await expect(cell(name)).toBeVisible();

    // READ — baris baru tampil dengan nominal.
    const row = page.getByRole("row").filter({ has: cell(name) });
    // id-ID memakai non-breaking space setelah "Rp" → cukup cocokkan digit.
    await expect(row.getByRole("cell", { name: /2\.500\.000/ })).toBeVisible();

    // UPDATE
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Uraian Belanja").fill(nameEdited);
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Belanja diperbarui.")).toBeVisible();
    await expect(cell(nameEdited)).toBeVisible();

    // DELETE (ConfirmDialog)
    await page
      .getByRole("row")
      .filter({ has: cell(nameEdited) })
      .getByRole("button", { name: "Hapus" })
      .click();
    await page.getByRole("button", { name: "Hapus", exact: true }).click();
    await expect(page.getByText("Belanja dihapus.")).toBeVisible();
    await expect(cell(name)).toHaveCount(0);
    await expect(cell(nameEdited)).toHaveCount(0);
  });
});
