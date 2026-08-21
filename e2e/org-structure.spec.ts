import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/org-structure /api/auth/login

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe("Struktur Organisasi — halaman publik", () => {
  test("banner + anggota (foto, nama, jabatan) tampil", async ({ page }) => {
    await page.goto("/struktur-organisasi");

    await expect(
      page.getByRole("heading", { name: "Struktur Organisasi" })
    ).toBeVisible();

    // Ambil data dari API (bukan hardcode seed) — skala-agnostic.
    const members = await page.evaluate<
      { name: string; position: string; photo?: string }[]
    >(async () => {
      const d = await (await fetch("/api/org-structure")).json();
      return d.items ?? [];
    });
    expect(members.length).toBeGreaterThanOrEqual(1);

    // Setiap anggota harus punya kartu dengan nama + jabatan.
    for (const m of members) {
      await expect(
        page.getByRole("heading", { name: m.name, level: 3 })
      ).toBeVisible();
      await expect(page.getByText(m.position, { exact: true })).toBeVisible();
      // Foto opsional — ada avatar atau placeholder.
      const hasPhoto = m.photo && m.photo.length > 0;
      if (hasPhoto) {
        await expect(page.locator(`img[alt="${m.name}"]`)).toBeVisible();
      }
    }
  });

  test("klik kartu membuka modal profil (bio/kontak, tanpa NUPTK/NIP/NIK)", async ({
    page,
  }) => {
    await page.goto("/struktur-organisasi");

    // Ambil anggota pertama dari API (bukan hardcode seed).
    const firstMember = await page.evaluate<
      { name: string; position: string; bio?: string; contact?: string } | null
    >(async () => {
      const d = await (await fetch("/api/org-structure")).json();
      const items = d.items ?? [];
      return items[0] ?? null;
    });
    if (!firstMember) return;

    // Buka modal anggota pertama.
    const kartu = page.getByRole("button", {
      name: `Lihat profil ${firstMember.name}`,
    });
    await expect(kartu).toBeVisible();
    await kartu.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: firstMember.name })
    ).toBeVisible();
    await expect(dialog.getByText(firstMember.position, { exact: true })).toBeVisible();

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

  test("kartu anggota admin menampilkan NUPTK, NIP, dan NIK (dari API)", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Struktur Organisasi" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Struktur Organisasi Sekolah",
        level: 2,
      })
    ).toBeVisible();

    // Ambil data anggota dari API admin scope (bukan hardcode seed).
    const members = await page.evaluate<
      { name: string; nuptk?: string | null; nip?: string | null; nik?: string | null }[]
    >(async () => {
      const d = await (await fetch("/api/org-structure?scope=admin")).json();
      return d.items ?? [];
    });
    expect(members.length).toBeGreaterThanOrEqual(1);

    // Minimal 1 anggota punya identifier — cari yang pertama.
    const withIds = members.find((m) => m.nuptk || m.nip || m.nik);
    if (withIds) {
      const card = page
        .locator("div.bg-card")
        .filter({ hasText: withIds.name });
      await expect(card).toBeVisible();

      // Cek identifier yang ada.
      if (withIds.nuptk) {
        await expect(card.getByText(`NUPTK: ${withIds.nuptk}`)).toBeVisible();
      }
      if (withIds.nip) {
        await expect(card.getByText(`NIP: ${withIds.nip}`)).toBeVisible();
      }
      if (withIds.nik) {
        await expect(card.getByText(`NIK: ${withIds.nik}`)).toBeVisible();
      }
    }

    // Minimal 1 baris NUPTK harus ada di seluruh daftar.
    const nuptkLines = await page
      .locator("main")
      .getByText(/^NUPTK: /)
      .count();
    expect(nuptkLines).toBeGreaterThanOrEqual(1);
  });
});
