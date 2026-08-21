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

  test("kartu guru menampilkan NUPTK, NIP, dan NIK dari data seed", async ({ page }) => {
    await page.getByRole("button", { name: "Guru & Staf" }).click();
    await expect(
      page.getByRole("heading", { name: "Guru & Staf", level: 2 })
    ).toBeVisible();

    // Ambil guru pertama dari API (bukan hardcode seed).
    const firstTeacher = await page.evaluate<
      { name: string; nuptk?: string; nip?: string; nik?: string } | null
    >(async () => {
      const d = await (await fetch("/api/teachers?scope=admin&limit=1000")).json();
      return (d.items as { name: string; nuptk?: string; nip?: string; nik?: string }[])[0] ?? null;
    });
    if (!firstTeacher) return;

    // Cari kartu guru berdasarkan nama (dynamic).
    const card = page
      .locator("div.rounded-xl.border")
      .filter({ hasText: firstTeacher.name });
    await expect(card).toBeVisible();

    // Jika guru punya NUPTK/NIP/NIK, assert tampil.
    if (firstTeacher.nuptk) {
      await expect(card.getByText(`NUPTK: ${firstTeacher.nuptk}`)).toBeVisible();
    }
    if (firstTeacher.nip) {
      await expect(card.getByText(`NIP: ${firstTeacher.nip}`)).toBeVisible();
    }
    if (firstTeacher.nik) {
      await expect(card.getByText(`NIK: ${firstTeacher.nik}`)).toBeVisible();
    }
    // Identitas bisa disalin sekali klik (komponen CopyableId) jika ada NUPTK.
    if (firstTeacher.nuptk) {
      await expect(
        card.getByRole("button", { name: `Salin NUPTK: ${firstTeacher.nuptk}` })
      ).toBeVisible();
    }

    // Manager kini memakai pagination server-side (default 10/halaman; seed
    // 12 guru → 2 halaman). Halaman 1 menampilkan 10 kartu, semuanya dengan
    // NUPTK dari seed → minimal 10 baris NUPTK.
    const nuptkLines = await page
      .locator("main")
      .getByText(/^NUPTK: /)
      .count();
    console.log("NUPTK LINES:", nuptkLines);
    expect(nuptkLines).toBeGreaterThanOrEqual(10);

    // Kontrol pagination tampil — memastikan counter memakai total server-side.
    // Total bisa berbeda antara seed (12) dan Dapodik (lebih banyak).
    await expect(page.getByText(/Halaman 1 dari/)).toBeVisible();
    await expect(page.getByText(/dari \d+ data/)).toBeVisible();
  });
});
