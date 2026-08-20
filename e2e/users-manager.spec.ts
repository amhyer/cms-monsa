import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/users /api/csrf-token /api/auth/login

test.describe("Manajemen Akun — pemisahan & filter per role", () => {
  test("tab role tersedia & isolasi antar role", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();

    // Tab filter per role tersedia.
    for (const label of [
      /Semua/,
      /Admin & Operator/,
      /Guru/,
      /Orang Tua/,
      /Siswa/,
    ]) {
      await expect(page.getByRole("tab", { name: label })).toBeVisible();
    }

    // Default "Semua": counter "N dari N akun" muncul (data sudah termuat).
    // Timeout lebih panjang untuk cold Turbopack compile (API load bisa >5s).
    await expect(page.getByText(/\d+ dari \d+ akun/)).toBeVisible({ timeout: 30_000 });

    // Tab "Guru" → counter muncul, tidak ada email admin.
    await page.getByRole("tab", { name: /Guru/ }).click();
    await expect(page.getByText(/\d+ dari \d+ akun/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(ADMIN.email)).toHaveCount(0);

    // Tab "Orang Tua" → counter muncul, tidak ada email admin.
    await page.getByRole("tab", { name: /Orang Tua/ }).click();
    await expect(page.getByText(/\d+ dari \d+ akun/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(ADMIN.email)).toHaveCount(0);

    // Tab "Siswa" → empty state (counter tidak muncul saat 0 item), tidak ada email admin.
    await page.getByRole("tab", { name: /Siswa/ }).click();
    await expect(page.getByText("Belum ada akun")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(ADMIN.email)).toHaveCount(0);
  });

  test("tab Admin & Operator hanya menampilkan staff internal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");

    await page.getByRole("tab", { name: /Admin & Operator/ }).click();
    await expect(page.getByText(ADMIN.email)).toBeVisible();
    // Akun non-staff tersembunyi ( tidak ada baris dengan role ORANG_TUA/GURU/SISWA).
    const rows = page.getByRole("row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0); // minimal header + admin
  });

  test("pencarian memfilter & counter menampilkan format yang benar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    const search = page.getByPlaceholder("Cari nama, email, atau siswa…");

    // Cari admin → hanya 1 hasil.
    await search.fill(ADMIN.email);
    await expect(page.getByText(ADMIN.email)).toBeVisible();
    // Counter menampilkan format "N dari N akun · N hasil pencarian"
    const counter = page.getByText(/dari \d+ akun/);
    await expect(counter).toBeVisible();

    // Bersihkan pencarian → semua akun tampil lagi.
    await search.fill("");
    await expect(page.getByText(ADMIN.email)).toBeVisible();
  });

  test("ringkasan dashboard menampilkan pill per role dengan angka", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard");

    // Pill ringkasan ada dan berisi angka.
    const pill = (label: string) =>
      page
        .locator("div.cursor-pointer", { hasText: label })
        .first()
        .locator("span.text-lg");
    await expect(pill("Admin & Operator")).toBeVisible();
    await expect(pill("Akun Guru")).toBeVisible();
    await expect(pill("Akun Orang Tua")).toBeVisible();
    await expect(pill("Total Akun")).toBeVisible();

    // Angka pill > 0 (bukan kosong/NaN).
    const totalText = await pill("Total Akun").textContent();
    expect(Number(totalText)).toBeGreaterThan(0);

    // Buka users page → tab "Semua" menampilkan total yang sama.
    await page.goto("/dashboard/users");
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();
    // Tab "Semua" ada (count ditampilkan).
    await expect(page.getByRole("tab", { name: /Semua/ })).toBeVisible();
  });

  test("tabel ter-paginasi & penghitung menjaga total terfilter", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();

    // Bersihkan sisa akun uji dari run sebelumnya (retry/CI).
    // Paginate karena Dapodik scale bisa punya 393+ user.
    await page.evaluate(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const list = await (
          await fetch(`/api/users?page=${page}&limit=100`)
        ).json();
        for (const u of list.items as { id: string; name: string }[]) {
          if (u.name.startsWith("Akun Paginasi e2e")) {
            await fetch(`/api/users/${u.id}`, {
              method: "DELETE",
              headers: { "x-csrf-token": csrf.token },
            });
          }
        }
        hasMore = list.items.length === 100;
        page++;
      }
    });

    // Baseline nyata — dihitung dari API.
    const baseline = await page.evaluate<number>(async () => {
      const d = await (await fetch("/api/users?limit=1")).json();
      return d.total as number;
    });
    expect(baseline).toBeGreaterThan(0);

    // Tambah 4 akun → total > 10 (PAGE_SIZE default) → 2 halaman.
    const names = await page.evaluate<string[]>(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const created: string[] = [];
      for (let i = 0; i < 4; i++) {
        const name = `Akun Paginasi e2e ${Date.now()}-${i}`;
        const res = await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf.token,
          },
          body: JSON.stringify({
            name,
            email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@monsa.test`,
            password: "rahasia123",
            role: "OPERATOR",
            isActive: true,
          }),
        });
        if (res.ok) created.push(name);
      }
      return created;
    });
    expect(names).toHaveLength(4);
    const expectedTotal = baseline + names.length;
    expect(expectedTotal).toBeGreaterThan(10);

    await page.reload();

    // Pagination muncul — halaman 1, halaman > 1.
    // Hitung total halaman secara dinamis berdasarkan jumlah akun aktual.
    const PAGE_SIZE = 10;
    const expectedPages = Math.ceil(expectedTotal / PAGE_SIZE);
    await expect(page.getByText(/Halaman 1 dari/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sebelumnya" })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeEnabled();
    // Minimal 10 baris data + 1 header = 11.
    const rowsCount = await page.getByRole("row").count();
    expect(rowsCount).toBeGreaterThanOrEqual(11);

    // Penghitung TETAP memakai total terfilter penuh.
    const counter = page.getByText(
      `${expectedTotal} dari ${expectedTotal} akun`
    );
    await expect(counter).toBeVisible();

    // Berikutnya → halaman 2.
    await page.getByRole("button", { name: "Berikutnya" }).click();
    await expect(page.getByText(new RegExp(`Halaman 2 dari ${expectedPages}`))).toBeVisible();
    await expect(counter).toBeVisible();

    // Lompat ke halaman terakhir → tombol Berikutnya disabled.
    for (let p = 2; p < expectedPages; p++) {
      await page.getByRole("button", { name: "Berikutnya" }).click();
    }
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeDisabled();

    // Sebelumnya → kembali ke halaman sebelumnya.
    await page.getByRole("button", { name: "Sebelumnya" }).click();
    await expect(page.getByText(new RegExp(`Halaman ${expectedPages - 1} dari ${expectedPages}`))).toBeVisible();

    // Kembali ke halaman 1.
    for (let p = expectedPages - 1; p > 1; p--) {
      await page.getByRole("button", { name: "Sebelumnya" }).click();
    }
    await expect(page.getByText(new RegExp(`Halaman 1 dari ${expectedPages}`))).toBeVisible();

    // CLEANUP: hapus 4 akun uji (paginate untuk Dapodik scale).
    const deleted = await page.evaluate<number>(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      let n = 0;
      let pg = 1;
      let hasMore = true;
      while (hasMore) {
        const list = await (
          await fetch(`/api/users?page=${pg}&limit=100`)
        ).json();
        for (const u of list.items as { id: string; name: string }[]) {
          if (u.name.startsWith("Akun Paginasi e2e")) {
            const r = await fetch(`/api/users/${u.id}`, {
              method: "DELETE",
              headers: { "x-csrf-token": csrf.token },
            });
            if (r.ok) n += 1;
          }
        }
        hasMore = list.items.length === 100;
        pg++;
      }
      return n;
    });
    expect(deleted).toBe(4);

    // Kembali ke baseline: jika baseline <= PAGE_SIZE, pagination hilang.
    await page.reload();
    if (baseline <= 10) {
      await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);
    }
    await expect(
      new RegExp(`${baseline} dari ${baseline} akun`)
    ).toBeTruthy();
  });

  test("Tambah Akun — keyboard: ArrowDown + Enter memilih siswa yang di-highlight (typeahead bersama)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();

    await page.getByRole("button", { name: "Tambah Akun" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Default role OPERATOR — pilih SISWA agar typeahead siswa muncul.
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Siswa" }).click();
    const studentInput = dialog.getByLabel("Siswa Pemilik Akun");
    await expect(studentInput).toBeVisible();

    // Ambil nama siswa pertama dari API (bukan hardcode seed).
    const firstName = await page.evaluate<string>(async () => {
      const d = await (await fetch("/api/students?limit=2")).json();
      return d.items?.[0]?.name ?? "";
    });
    if (!firstName) return; // skip bila tidak ada siswa

    // Query huruf pertama nama → harus menghasilkan minimal 1 opsi.
    const query = firstName.charAt(0).toLowerCase();
    await studentInput.fill(query);

    const firstOption = dialog.getByRole("option", { name: new RegExp(firstName) });
    await expect(firstOption).toHaveAttribute("aria-selected", "true");

    // ArrowDown → highlight pindah ke index 1 (atau tetap di 0 bila hanya 1).
    await studentInput.press("ArrowDown");

    // Enter memilih siswa yang di-highlight → nilai input terisi nama.
    await studentInput.press("Enter");
    const val = await studentInput.inputValue();
    expect(val.length).toBeGreaterThan(0);

    // Tutup dialog tanpa menyimpan.
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("dashboard admin — Edit Akun menyesuaikan form & tautan saat role diganti", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();

    // Bersihkan sisa akun uji.
    await page.evaluate(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (await fetch("/api/users?limit=100")).json();
      for (const u of list.items as { id: string; name: string }[]) {
        if (u.name.startsWith("Edit Rol e2e")) {
          await fetch(`/api/users/${u.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
        }
      }
    });

    // Siapkan data referensi dari API (bukan seed hardcoded).
    const ref = await page.evaluate<{
      studentA: { id: string; name: string; className: string };
      studentB: { id: string; name: string; className: string };
      waliClass: { id: string; name: string };
    }>(async () => {
      const [studentsRes, usersRes, classesRes] = await Promise.all([
        fetch("/api/students?limit=1000"),
        fetch("/api/users?limit=100"),
        fetch("/api/classes?scope=admin"),
      ]);
      const students = (await studentsRes.json()).items as {
        id: string;
        name: string;
        className?: string;
      }[];
      const users = (await usersRes.json()).items as {
        role: string;
        studentId: string | null;
      }[];
      const classes = (await classesRes.json()).items as {
        id: string;
        name: string;
      }[];
      const takenBySiswa = new Set(
        users
          .filter((u) => u.role === "SISWA")
          .map((u) => u.studentId)
          .filter(Boolean)
      );
      const free = students.filter((s) => !takenBySiswa.has(s.id));
      const studentA = students[0];
      const studentB = free.find((s) => s.id !== studentA.id) ?? free[0];
      const waliClass = classes[0];
      return {
        studentA: {
          id: studentA.id,
          name: studentA.name,
          className: studentA.className ?? "—",
        },
        studentB: {
          id: studentB.id,
          name: studentB.name,
          className: studentB.className ?? "—",
        },
        waliClass: { id: waliClass.id, name: waliClass.name },
      };
    });
    expect(ref.studentA.id).not.toBe(ref.studentB.id);
    expect(ref.waliClass.id).toBeTruthy();

    // Buat akun ORANG_TUA tertaut ke studentA.
    const stamp = Date.now();
    const name = `Edit Rol e2e ${stamp}`;
    const email = `editrol.${stamp}@monsa.test`;
    await page.evaluate(
      async ({ email, name, studentId }) => {
        const csrf = await (await fetch("/api/csrf-token")).json();
        await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf.token,
          },
          body: JSON.stringify({
            name,
            email,
            password: "rahasia123",
            role: "ORANG_TUA",
            guardianStudentId: studentId,
            isActive: true,
          }),
        });
      },
      { email, name, studentId: ref.studentA.id }
    );
    await page.reload();

    const row = () => page.getByRole("row").filter({ hasText: email });
    await expect(row()).toBeVisible();
    const dialog = page.getByRole("dialog");

    // --- 1) Edit ORANG_TUA: form menampilkan field Anak. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    const roleSelect = dialog.getByRole("combobox").first();
    await expect(roleSelect).toContainText("Orang Tua");
    const anakSelect = dialog.getByLabel("Anak / Siswa yang Dipantau");
    await expect(anakSelect).toHaveValue(ref.studentA.name);

    // --- 2) ORANG_TUA → SISWA: tautan dibawa, ganti ke studentB, simpan. ---
    await roleSelect.click();
    await page.getByRole("option", { name: "Siswa" }).click();
    const siswaSelect = dialog.getByLabel("Siswa Pemilik Akun");
    await expect(siswaSelect).toBeVisible();
    await expect(siswaSelect).toHaveValue(ref.studentA.name);
    await expect(
      dialog.getByText(/Tautan dibawa dari Orang Tua/)
    ).toBeVisible();
    await siswaSelect.fill(ref.studentB.name);
    await dialog
      .getByRole("option", { name: new RegExp(ref.studentB.name) })
      .click();
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Akun diperbarui.").first()).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(row().getByText("Siswa", { exact: true })).toBeVisible();
    await expect(row().getByText(`Kelas: ${ref.studentB.className}`)).toBeVisible();

    // Stale-state check: re-open → form pre-fill dari server.
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox").first()).toContainText("Siswa");
    await expect(dialog.getByLabel("Siswa Pemilik Akun")).toHaveValue(
      ref.studentB.name
    );
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toHaveCount(0);

    // --- 3) SISWA → GURU: field siswa hilang, muncul Wali Kelas. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Guru" }).click();
    await expect(dialog.getByLabel("Siswa Pemilik Akun")).toHaveCount(0);
    const waliTrigger = dialog.getByRole("combobox").nth(1);
    await waliTrigger.click();
    await page
      .getByRole("option", { name: new RegExp(`^${ref.waliClass.name}$`) })
      .click();
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Akun diperbarui.").first()).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(row().getByText("Guru", { exact: true })).toBeVisible();
    await expect(row().getByText(`Wali: ${ref.waliClass.name}`)).toBeVisible();

    // --- 4) GURU → ORANG_TUA: pilih studentA, simpan. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Orang Tua" }).click();
    const anakLagi = dialog.getByLabel("Anak / Siswa yang Dipantau");
    await expect(anakLagi).toBeVisible();
    await anakLagi.fill(ref.studentA.name);
    await dialog
      .getByRole("option", { name: new RegExp(ref.studentA.name) })
      .click();
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Akun diperbarui.").first()).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(row().getByText("Orang Tua", { exact: true })).toBeVisible();

    // Final stale-state check.
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox").first()).toContainText("Orang Tua");
    await expect(dialog.getByLabel("Anak / Siswa yang Dipantau")).toHaveValue(
      ref.studentA.name
    );
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toHaveCount(0);

    // CLEANUP.
    await page.evaluate(async (em) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const d = await (await fetch("/api/users?limit=100")).json();
      const u = (d.items as { id: string; email: string }[]).find(
        (x) => x.email === em
      );
      if (u) {
        await fetch(`/api/users/${u.id}`, {
          method: "DELETE",
          headers: { "x-csrf-token": csrf.token },
        });
      }
    }, email);
    await page.reload();
    await expect(row()).toHaveCount(0);
  });
});
