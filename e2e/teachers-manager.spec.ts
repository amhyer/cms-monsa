import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/teachers /api/auth/login

test.describe("Guru & Staf — dashboard admin (kartu identitas)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("navigasi ke manajemen guru via sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Guru & Staf" }).click();
    await expect(
      page.getByRole("heading", { name: "Guru & Staf", level: 2 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/teachers/);
  });

  test("kartu guru seed menampilkan NUPTK, NIP, dan NIK", async ({ page }) => {
    await page.getByRole("button", { name: "Guru & Staf" }).click();
    await expect(
      page.getByRole("heading", { name: "Guru & Staf", level: 2 })
    ).toBeVisible();

    // Identitas dari seed (prisma/seed.ts — blok TEACHERS). Guru pertama
    // (order 0) adalah Kepala Sekolah dengan NUPTK/NIP/NIK lengkap.
    const card = page
      .locator("div.rounded-xl.border")
      .filter({ hasText: "Nawawi Hamzah, S.Pd., M.Pd." });
    await expect(card).toBeVisible();
    await expect(card.getByText("NUPTK: 1998765432100001")).toBeVisible();
    await expect(card.getByText("NIP: 198007152008011001")).toBeVisible();
    await expect(card.getByText("NIK: 7371011507800001")).toBeVisible();
    // Identitas bisa disalin sekali klik (komponen CopyableId).
    await expect(
      card.getByRole("button", { name: "Salin NUPTK: 1998765432100001" })
    ).toBeVisible();

    // Manager kini memakai pagination server-side (default 10/halaman; seed
    // 12 guru → 2 halaman). Halaman 1 menampilkan 10 kartu, semuanya dengan
    // NUPTK dari seed → minimal 10 baris NUPTK.
    const nuptkLines = await page
      .locator("main")
      .getByText(/^NUPTK: /)
      .count();
    console.log("NUPTK LINES:", nuptkLines);
    expect(nuptkLines).toBeGreaterThanOrEqual(10);

    // Kontrol pagination tampil (2 halaman) dan total tetap 12 (bukan hanya
    // halaman aktif) — memastikan counter memakai total server-side.
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();
    await expect(page.getByText("10 dari 12 data")).toBeVisible();
  });
});
