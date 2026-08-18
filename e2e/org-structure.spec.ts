import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/org-structure /api/auth/login

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

  test("klik kartu membuka modal profil (bio/kontak, tanpa NUPTK/NIP/NIK)", async ({
    page,
  }) => {
    await page.goto("/struktur-organisasi");

    // Buka modal Kepala Sekolah (bio + kontak email dari seed).
    const kartu = page.getByRole("button", {
      name: "Lihat profil Nawawi Hamzah, S.Pd., M.Pd.",
    });
    await expect(kartu).toBeVisible();
    await kartu.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Nawawi Hamzah, S.Pd., M.Pd." })
    ).toBeVisible();
    await expect(dialog.getByText("Kepala Sekolah", { exact: true })).toBeVisible();
    // Bio dari seed.
    await expect(
      dialog.getByText(/Memimpin SDN Unggulan Mongisidi 1 sejak 2019/)
    ).toBeVisible();
    // Kontak email → tautan mailto.
    const contact = dialog.getByRole("link", {
      name: "kepala.sekolah@mongisidi1.sch.id",
    });
    await expect(contact).toBeVisible();
    await expect(contact).toHaveAttribute("href", "mailto:kepala.sekolah@mongisidi1.sch.id");

    // Identitas (NUPTK/NIP/NIK) tidak boleh muncul di modal publik.
    await expect(dialog.getByText(/NUPTK|NIP|NIK/, { exact: false })).toHaveCount(0);

    // Tutup lewat tombol.
    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).not.toBeVisible();
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

  test("kartu anggota seed menampilkan NUPTK, NIP, dan NIK yang bisa disalin", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Struktur Organisasi" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Struktur Organisasi Sekolah",
        level: 2,
      })
    ).toBeVisible();

    // Identitas dari seed (prisma/seed.ts — blok STRUKTUR ORGANISASI).
    // Kepala Sekolah membawa NUPTK + NIP + NIK lengkap.
    const card = page
      .locator("div.bg-card")
      .filter({ hasText: "Nawawi Hamzah, S.Pd., M.Pd." });
    await expect(card).toBeVisible();
    await expect(card.getByText("NUPTK: 1345752663130001")).toBeVisible();
    await expect(card.getByText("NIP: 196806121994031002")).toBeVisible();
    await expect(card.getByText("NIK: 7371011206680001")).toBeVisible();
    // Identitas bisa disalin sekali klik (komponen CopyableId).
    await expect(
      card.getByRole("button", { name: "Salin NUPTK: 1345752663130001" })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Salin NIP: 196806121994031002" })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Salin NIK: 7371011206680001" })
    ).toBeVisible();

    // Anggota tanpa NIP di seed (nip: null) tetap menampilkan NUPTK + NIK.
    const kartuAndi = page
      .locator("div.bg-card")
      .filter({ hasText: "Andi Mappangara, S.Pd." });
    await expect(kartuAndi.getByText("NUPTK: 9351765667130004")).toBeVisible();
    await expect(kartuAndi.getByText("NIK: 7371011205780004")).toBeVisible();
    await expect(kartuAndi.getByText(/^NIP: /)).toHaveCount(0);

    // Semua anggota seed membawa NUPTK → tepat 6 baris NUPTK di daftar.
    const nuptkLines = await page
      .locator("main")
      .getByText(/^NUPTK: /)
      .count();
    console.log("NUPTK LINES:", nuptkLines);
    expect(nuptkLines).toBe(6);
  });
});
