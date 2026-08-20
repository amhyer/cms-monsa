import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/students /api/auth/login /api/users /api/csrf-token

test.describe("Data Siswa — dashboard admin (kartu identitas)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("navigasi ke manajemen siswa via sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Data Siswa" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Siswa", level: 2 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/students/);
  });

  test("kartu siswa menampilkan NIS & NISN (dari seed)", async ({ page }) => {
    await page.getByRole("button", { name: "Data Siswa" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Siswa", level: 2 })
    ).toBeVisible();

    // Ambil siswa pertama dari API (bukan hardcode seed).
    const firstStudent = await page.evaluate<{ name: string; nis: string; nisn?: string }>(
      async () => {
        const d = await (await fetch("/api/students?limit=1")).json();
        const s = d.items?.[0];
        return s ? { name: s.name, nis: s.nis, nisn: s.nisn } : null;
      }
    );
    if (!firstStudent) return;

    const card = page
      .locator("main div.rounded-xl.border")
      .filter({ hasText: firstStudent.name });
    await expect(card).toBeVisible();
    // NIS tampil di kartu (wajib diisi).
    await expect(card.getByText(`NIS: ${firstStudent.nis}`)).toBeVisible();
    // Identitas bisa disalin sekali klik (komponen CopyableId).
    await expect(
      card.getByRole("button", { name: `Salin NIS: ${firstStudent.nis}` })
    ).toBeVisible();

    // NIS selalu tampil di kartu siswa (wajib diisi); NISN opsional.
    const nisLines = await page
      .locator("main")
      .getByText(/^NIS: /)
      .count();
    console.log("NIS LINES:", nisLines);
    expect(nisLines).toBeGreaterThan(0);
    const nisnLines = await page
      .locator("main")
      .getByText(/^NISN: /)
      .count();
    console.log("NISN LINES:", nisnLines);
    expect(nisnLines).toBeGreaterThan(0);
  });

  test("quick action 'Buat akun SISWA' membuka form akun ter-link ke siswa", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Data Siswa" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Siswa", level: 2 })
    ).toBeVisible();

    // Kartu Aisyah (siswa seed pertama, urut abjad) punya tombol quick action.
    const card = page
      .locator("main div.rounded-xl.border")
      .filter({ hasText: "Aisyah Putri Ramadhani" });
    await expect(card).toBeVisible();
    const quickAction = card.getByRole("button", {
      name: "Buat akun SISWA untuk Aisyah Putri Ramadhani",
    });
    await expect(quickAction).toBeVisible();
    await quickAction.click();

    // Navigasi ke Manajemen Akun dengan query param siswa → dialog Tambah
    // Akun terbuka OTOMATIS, role Siswa, nama + typeahead ter-link ke Aisyah
    // (komponen bersama StudentTypeahead).
    await expect(page).toHaveURL(/\/dashboard\/users\?createSiswa=/);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Tambah Akun" })
    ).toBeVisible();
    await expect(dialog.getByLabel("Nama")).toHaveValue(
      "Aisyah Putri Ramadhani"
    );
    await expect(dialog.getByRole("combobox").first()).toContainText("Siswa");
    await expect(dialog.getByLabel("Siswa Pemilik Akun")).toHaveValue(
      "Aisyah Putri Ramadhani"
    );

    // Lengkapi email + password, simpan → akun SISWA dibuat ter-link.
    const email = `quick.siswa.${Date.now()}@monsa.test`;
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password").fill("rahasia123");
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Akun dibuat.").first()).toBeVisible();

    // Verifikasi lewat API: role SISWA + studentId menunjuk ke Aisyah.
    // Paginate untuk Dapodik scale — akun baru berada di halaman terakhir.
    const created = await page.evaluate<{ id: string; role: string; studentId: string | null } | null>(
      async (em) => {
        let pg = 1;
        let hasMore = true;
        while (hasMore) {
          const d = await (await fetch(`/api/users?page=${pg}&limit=100`)).json();
          const u = (d.items as { id: string; role: string; studentId: string | null; email: string }[]).find(
            (x) => x.email === em
          );
          if (u) return { id: u.id, role: u.role, studentId: u.studentId };
          hasMore = d.items.length === 100;
          pg++;
        }
        return null;
      },
      email
    );
    expect(created?.role).toBe("SISWA");
    expect(created?.studentId).toBeTruthy();

    // CLEANUP: hapus akun uji lewat API (CSRF).
    await page.evaluate(async (id) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf.token },
      });
    }, created!.id);
    await expect(dialog).toHaveCount(0);
  });
});
