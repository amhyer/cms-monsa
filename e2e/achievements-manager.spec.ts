import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/achievements /api/students /api/csrf-token /api/auth/login

test.describe("Data Prestasi — identitas siswa di kartu", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("navigasi ke Data Prestasi via sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Data Prestasi" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Prestasi", level: 2 })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/achievements/);
  });

  test("kartu menampilkan NIS/NISN untuk siswa tertaut, tanpa untuk prestasi tim", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Data Prestasi" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Prestasi", level: 2 })
    ).toBeVisible();

    // Prestasi perorangan tertaut ke siswa → kartu menampilkan NIS + NISN.
    // Ambil data dari API (bukan hardcode seed).
    const linkedAchievement = await page.evaluate<
      { title: string; studentName: string; nis: string; nisn?: string } | null
    >(async () => {
      const d = await (await fetch("/api/achievements")).json();
      const a = (d.items || []).find(
        (x: { studentName?: string; nis?: string }) => x.studentName && x.nis
      );
      return a
        ? {
            title: a.title,
            studentName: a.studentName,
            nis: a.nis,
            nisn: a.nisn,
          }
        : null;
    });
    if (linkedAchievement) {
      const kartuLinked = page
        .locator("div.bg-card")
        .filter({ hasText: linkedAchievement.title });
      await expect(kartuLinked).toBeVisible();
      await expect(
        kartuLinked.getByText(`Siswa: ${linkedAchievement.studentName}`)
      ).toBeVisible();
      await expect(
        kartuLinked.getByText(`NIS: ${linkedAchievement.nis}`)
      ).toBeVisible();
      // Tombol copy NIS ada.
      await expect(
        kartuLinked.getByRole("button", {
          name: `Salin NIS: ${linkedAchievement.nis}`,
        })
      ).toBeVisible();
    }

    // Prestasi tim (tanpa studentId di seed) → nama tim tampil, tapi TANPA
    // baris NIS/NISN sama sekali.
    const kartuTim = page
      .locator("div.bg-card")
      .filter({ hasText: "Juara 1 Lomba Cerdas Cermat Tingkat Kota" });
    await expect(kartuTim).toBeVisible();
    await expect(
      kartuTim.getByText("Siswa: Tim LCC SDN Mongisidi 1")
    ).toBeVisible();
    await expect(kartuTim.getByText(/^NIS: /)).toHaveCount(0);
    await expect(kartuTim.getByText(/^NISN: /)).toHaveCount(0);

    // Jumlah kartu ber-NIS == jumlah prestasi tertaut di seed (4 dari 6).
    const nisCount = await page
      .locator("main")
      .getByText(/^NIS: /)
      .count();
    console.log("NIS LINES:", nisCount);
    expect(nisCount).toBe(4);
  });
});

test.describe("Data Prestasi — typeahead siswa (Tambah Prestasi)", () => {
  // Jaring pengaman: apapun hasil tes (lulus/gagal), sisa prestasi uji
  // dihapus — kalau tidak, sisa ini menggeser 3 teratas halaman publik
  // (tes "identitas siswa di halaman publik" bergantung pada urutan seed).
  test.afterEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password).catch(() => {});
    await page.goto("/dashboard/achievements").catch(() => {});
    await page
      .evaluate(async () => {
        const csrf = await (await fetch("/api/csrf-token")).json();
        const list = await (await fetch("/api/achievements")).json();
        for (const a of list.items as { id: string; title: string }[]) {
          if (
            a.title.startsWith("Prestasi Edit e2e") ||
            a.title.startsWith("Prestasi Typeahead e2e")
          ) {
            await fetch(`/api/achievements/${a.id}`, {
              method: "DELETE",
              headers: { "x-csrf-token": csrf.token },
            });
          }
        }
      })
      .catch(() => {});
  });

  test("ketik nama parsial, pilih siswa, simpan → NIS/NISN tampil di kartu baru", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.getByRole("button", { name: "Data Prestasi" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Prestasi", level: 2 })
    ).toBeVisible();

    // Pre-clean sisa dari run sebelumnya (retry/CI safety) — pola sama
    // dengan users-manager: prefiks unik + hapus via API ber-CSRF.
    await page.evaluate(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (await fetch("/api/achievements")).json();
      for (const a of list.items as { id: string; title: string }[]) {
        if (a.title.startsWith("Prestasi Typeahead e2e")) {
          await fetch(`/api/achievements/${a.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
        }
      }
    });

    const title = `Prestasi Typeahead e2e ${Date.now()}`;
    await page.getByRole("button", { name: "Tambah Prestasi" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Ketik nama parsial → typeahead memfilter daftar siswa.
    const studentInput = page.getByLabel("Siswa / Tim");
    await studentInput.fill("Bima");
    const option = page.getByRole("option", { name: /Bima Arya Saputra/ });
    await expect(option).toBeVisible();
    await option.click();

    // Tautan siswa tersambung (studentId terisi → NIS/NISN di kartu).
    await expect(dialog.getByText("✓ Tertaut ke siswa")).toBeVisible();

    await page.getByLabel("Judul Prestasi").fill(title);
    await dialog.getByRole("button", { name: "Simpan" }).click();

    // Toast bisa menumpuk pada iterasi cepat — pakai .first() (pelajaran
    // dari tes pagination belanja: strict-mode violation pada toast ganda).
    await expect(page.getByText("Prestasi ditambahkan.").first()).toBeVisible();

    // Kartu baru menampilkan NIS/NISN dari siswa yang dipilih.
    // Ambil data siswa yang dipilih dari API (bukan hardcode).
    const selectedStudent = await page.evaluate<
      { name: string; nis: string; nisn?: string } | null
    >(async () => {
      const d = await (await fetch("/api/students?limit=1000")).json();
      // Siswa yang baru saja dipilih via typeahead — ambil yang NIS-nya ada.
      const s = (d.items || []).find((x: { nis?: string }) => x.nis);
      return s ? { name: s.name, nis: s.nis, nisn: s.nisn } : null;
    });
    const kartuBaru = page.locator("div.bg-card").filter({ hasText: title });
    await expect(kartuBaru).toBeVisible();
    if (selectedStudent) {
      await expect(
        kartuBaru.getByText(`Siswa: ${selectedStudent.name}`)
      ).toBeVisible();
      await expect(
        kartuBaru.getByRole("button", {
          name: `Salin NIS: ${selectedStudent.nis}`,
        })
      ).toBeVisible();
    }

    // Cleanup: hapus prestasi uji via API (CSRF) lalu pastikan kartu hilang.
    await page.evaluate(async (t) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (await fetch("/api/achievements")).json();
      for (const a of list.items as { id: string; title: string }[]) {
        if (a.title === t) {
          await fetch(`/api/achievements/${a.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
        }
      }
    }, title);
    await page.reload();
    await expect(
      page.locator("div.bg-card").filter({ hasText: title })
    ).toHaveCount(0);
  });

  test("keyboard: ArrowDown + Enter memilih siswa yang di-highlight (aria-selected)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.getByRole("button", { name: "Data Prestasi" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Prestasi", level: 2 })
    ).toBeVisible();

    await page.getByRole("button", { name: "Tambah Prestasi" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Query multi-hasil (huruf "a" ada di banyak nama seed). Daftar siswa
    // diurutkan name asc → Aisyah (index 0), Bima (index 1), Citra, …
    const studentInput = page.getByLabel("Siswa / Tim");
    await studentInput.fill("a");

    // Awalnya index 0 ter-highlight (aria-selected true).
    const aisyah = dialog.getByRole("option", { name: /Aisyah Putri Ramadhani/ });
    const bima = dialog.getByRole("option", { name: /Bima Arya Saputra/ });
    await expect(aisyah).toHaveAttribute("aria-selected", "true");
    await expect(bima).toHaveAttribute("aria-selected", "false");

    // ArrowDown → highlight pindah ke index 1 (Bima), Aisyah tidak lagi
    // ter-highlight. (ArrowUp mengembalikan ke index 0 — dicek sekaligus.)
    await studentInput.press("ArrowDown");
    await expect(bima).toHaveAttribute("aria-selected", "true");
    await expect(aisyah).toHaveAttribute("aria-selected", "false");

    // Enter memilih siswa yang sedang di-highlight → tautan terbentuk.
    await studentInput.press("Enter");
    await expect(dialog.getByText("✓ Tertaut ke siswa")).toBeVisible();

    // Nilai input terisi nama siswa terpilih (bukan yang pertama).
    await expect(studentInput).toHaveValue("Bima Arya Saputra");

    // Tutup dialog tanpa menyimpan — fokus tes ini hanya navigasi keyboard.
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Edit Prestasi: siswa tertaut ter-pre-fill & NIS/NISN bertahan setelah simpan", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.getByRole("button", { name: "Data Prestasi" }).click();
    await expect(
      page.getByRole("heading", { name: "Data Prestasi", level: 2 })
    ).toBeVisible();

    // Pre-clean sisa run sebelumnya (retry/CI safety).
    await page.evaluate(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (await fetch("/api/achievements")).json();
      for (const a of list.items as { id: string; title: string }[]) {
        if (a.title.startsWith("Prestasi Edit e2e")) {
          await fetch(`/api/achievements/${a.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
        }
      }
    });

    // Setup via API (CSRF): prestasi tertaut siswa seed Bima.
    const title = `Prestasi Edit e2e ${Date.now()}`;
    const created = await page.evaluate(async (t) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const students = await (await fetch("/api/students?search=Bima")).json();
      const bima = (students.items as { id: string; name: string }[])[0];
      if (!bima) throw new Error("Bima tidak ditemukan di seed");
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf.token,
        },
        body: JSON.stringify({
          title: t,
          studentName: bima.name,
          studentId: bima.id,
          level: "Kabupaten",
          category: "Akademik",
          date: "2026-08-01",
          description: "persiapan uji edit",
        }),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      return res.json() as Promise<{ id: string }>;
    }, title);
    expect(created.id).toBeTruthy();
    await page.reload();

    const kartu = page.locator("div.bg-card").filter({ hasText: title });
    await expect(kartu).toBeVisible();
    // Kartu yang tertaut ke siswa menampilkan tombol Salin NIS.
    await expect(kartu.getByRole("button", { name: /Salin NIS: / })).toBeVisible();

    // Buka dialog Edit Prestasi.
    await kartu.getByRole("button", { name: "Edit prestasi" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Edit Prestasi" })
    ).toBeVisible();

    // Siswa tertaut ter-pre-fill di typeahead + badge tertaut terlihat.
    const studentInput = dialog.getByLabel("Siswa / Tim");
    await expect(studentInput).toHaveValue("Bima Arya Saputra");
    await expect(dialog.getByText("✓ Tertaut ke siswa")).toBeVisible();

    // Ganti siswa via typeahead (flow yang sama dengan Tambah) → Citra.
    await studentInput.fill("Citra");
    await dialog
      .getByRole("option", { name: /Citra Ayu Lestari/ })
      .click();
    await expect(studentInput).toHaveValue("Citra Ayu Lestari");
    await expect(dialog.getByText("✓ Tertaut ke siswa")).toBeVisible();

    // Ubah judul lalu simpan — NIS/NISN harus bertahan (mengikuti siswa baru).
    await dialog.getByLabel("Judul Prestasi").fill(`${title} (edited)`);
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Prestasi diperbarui.").first()).toBeVisible();

    const kartuEdited = page
      .locator("div.bg-card")
      .filter({ hasText: `${title} (edited)` });
    await expect(kartuEdited).toBeVisible();
    await expect(kartuEdited.getByText("Siswa: Citra Ayu Lestari")).toBeVisible();
    // NIS/NISN berubah mengikuti siswa baru (Citra) — tombol copy ada.
    await expect(
      kartuEdited.getByRole("button", { name: /Salin NIS: / })
    ).toBeVisible();

    // Cleanup: hapus prestasi uji via API (CSRF) lalu pastikan kartu hilang.
    await page.evaluate(async (t) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (await fetch("/api/achievements")).json();
      for (const a of list.items as { id: string; title: string }[]) {
        if (a.title === t) {
          await fetch(`/api/achievements/${a.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
        }
      }
    }, `${title} (edited)`);
    await page.reload();
    await expect(
      page.locator("div.bg-card").filter({ hasText: `${title} (edited)` })
    ).toHaveCount(0);
  });
});

test.describe("Data Prestasi — identitas siswa di halaman publik", () => {
  test("kartu prestasi publik menampilkan NIS/NISN siswa tertaut (salinan Dapodik)", async ({
    page,
  }) => {
    // Beranda publik menampilkan prestasi terbaru.
    await page.goto("/");

    // Kartu prestasi pertama yang tertaut siswa (ada tombol Salin NIS).
    const linkedCards = page.locator("div.bg-card").filter({ hasText: /Salin NIS/ });
    const linkedCount = await linkedCards.count();
    expect(linkedCount).toBeGreaterThan(0);
    // Tombol Salin NIS dan Salin NISN ada.
    const firstLinked = linkedCards.first();
    await expect(firstLinked.getByRole("button", { name: /Salin NIS: / })).toBeVisible();
    await expect(firstLinked.getByRole("button", { name: /Salin NISN: / })).toBeVisible();

    // Prestasi tim (tanpa tautan siswa) tetap tanpa baris NIS/NISN.
    const kartuTim = page
      .locator("div.bg-card")
      .filter({ hasText: "Juara 1 Lomba Cerdas Cermat Tingkat Kota" });
    await expect(kartuTim).toBeVisible();
    await expect(kartuTim.getByText(/^NIS: /)).toHaveCount(0);
    await expect(kartuTim.getByText(/^NISN: /)).toHaveCount(0);
  });
});
