import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/users /api/csrf-token /api/auth/login

test.describe("Manajemen Akun — pemisahan & filter per role", () => {
  test("akun seed terpisah per tab role dengan label peran yang benar", async ({
    page,
  }) => {
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

    // Default "Semua": akun staff & non-staff tampil.
    await expect(page.getByText(ADMIN.email)).toBeVisible();
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toBeVisible();

    // Tab "Guru" → hanya akun guru (Andi Mappangara), tanpa akun admin.
    await page.getByRole("tab", { name: /Guru/ }).click();
    await expect(page.getByText("Andi Mappangara, S.Pd.")).toBeVisible();
    await expect(page.getByText(ADMIN.email)).toHaveCount(0);
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toHaveCount(0);

    // Tab "Orang Tua" → akun orang tua dengan tautan siswa (Anak: …).
    await page.getByRole("tab", { name: /Orang Tua/ }).click();
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toBeVisible();
    await expect(
      page.getByText("Anak: Aisyah Putri Ramadhani (Kelas 1.a)")
    ).toBeVisible();
    await expect(page.getByText(ADMIN.email)).toHaveCount(0);

    // Tab "Siswa" → akun siswa dengan kelasnya.
    await page.getByRole("tab", { name: /Siswa/ }).click();
    await expect(page.getByText("Bima Arya Saputra")).toBeVisible();
    await expect(page.getByText("Kelas: Kelas 1.a")).toBeVisible();
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
    await expect(page.getByText("operator@mongisidi1.sch.id")).toBeVisible();
    // Akun non-staff tersembunyi.
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toHaveCount(0);
    await expect(page.getByText("Bima Arya Saputra")).toHaveCount(0);
  });

  test("pencarian mencocokkan nama akun, email, dan nama siswa tertaut", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    const search = page.getByPlaceholder("Cari nama, email, atau siswa…");

    // 1) Nama akun → baris ORANG_TUA.
    await search.fill("Orang tua Aisyah");
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toBeVisible();
    await expect(page.getByText("Bima Arya Saputra")).toHaveCount(0);

    // 2) Email akun → baris SISWA.
    await search.fill("bima.siswa");
    await expect(page.getByText("bima.siswa@mongisidi1.sch.id")).toBeVisible();
    await expect(page.getByText("Bima Arya Saputra")).toBeVisible();
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toHaveCount(0);

    // 3) Nama siswa tertaut (guardianStudentName — bukan nama akun) →
    //    baris ORANG_TUA ikut cocok lewat kolom "Anak: …".
    await search.fill("Aisyah Putri Ramadhani");
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toBeVisible();
    await expect(
      page.getByText("Anak: Aisyah Putri Ramadhani (Kelas 1.a)")
    ).toBeVisible();
    await expect(page.getByText("Bima Arya Saputra")).toHaveCount(0);

    // 4) Petunjuk pencarian ikut mengecil (1 hasil dari 7 akun).
    await expect(
      page.getByText("1 dari 7 akun · 1 hasil pencarian")
    ).toBeVisible();

    // 5) Bersihkan pencarian → semua akun tampil lagi.
    await search.fill("");
    await expect(page.getByText(ADMIN.email)).toBeVisible();
    await expect(
      page.getByText("Orang tua Aisyah Putri Ramadhani")
    ).toBeVisible();
  });

  test("ringkasan dashboard menampilkan jumlah akun per role (sama dgn tab users)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard");

    // Baseline ringkasan (dari /api/stats → userRoleCounts, bentuk sama dgn
    // counts /api/users). Seed: 4 STAFF (1 SUPER_ADMIN + 3 OPERATOR), 1 GURU,
    // 1 ORANG_TUA, 1 SISWA → total 7.
    await expect(
      page.getByText("Admin & Operator").locator("..")
    ).toBeVisible();
    await expect(page.getByText("Total Akun")).toBeVisible();
    await expect(page.getByText("Akun Guru")).toBeVisible();
    await expect(page.getByText("Akun Orang Tua")).toBeVisible();
    await expect(page.getByText("Akun Siswa")).toBeVisible();

    // Nilai tiap pill sesuai counts seed (4/1/1/1/7).
    const pill = (label: string) =>
      page
        .locator("div.cursor-pointer", { hasText: label })
        .first()
        .locator("span.text-lg");
    await expect(pill("Admin & Operator")).toHaveText("4");
    await expect(pill("Akun Guru")).toHaveText("1");
    await expect(pill("Akun Orang Tua")).toHaveText("1");
    await expect(pill("Akun Siswa")).toHaveText("1");
    await expect(pill("Total Akun")).toHaveText("7");

    // Buka users page → tab "Semua" memuat total yang SAMA (7) dan tab
    // per-role mencocokkan pill ringkasan (4/1/1/1).
    await page.goto("/dashboard/users");
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Semua \(7\)/ })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Admin & Operator \(4\)/ })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Guru \(1\)/ })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Orang Tua \(1\)/ })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Siswa \(1\)/ })).toBeVisible();
  });

  test("dashboard admin — tabel ter-paginasi & penghitung menjaga total terfilter", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/users");
    await expect(
      page.getByRole("heading", { name: "Manajemen Akun", level: 2 })
    ).toBeVisible();

    // Bersihkan sisa akun uji dari run sebelumnya (retry/CI) agar baseline
    // jujur — akun uji memakai prefiks unik.
    await page.evaluate(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (await fetch("/api/users?limit=100")).json();
      for (const u of list.items as { id: string; name: string }[]) {
        if (u.name.startsWith("Akun Paginasi e2e")) {
          await fetch(`/api/users/${u.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
        }
      }
    });

    // Baseline nyata (seed + akun lain yang sah) — dihitung dari API.
    const baseline = await page.evaluate<number>(async () => {
      const d = await (await fetch("/api/users?limit=1")).json();
      return d.total as number;
    });

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

    // Pagination muncul; halaman 1 memuat 10 baris data + 1 header.
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sebelumnya" })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeEnabled();
    await expect(page.getByRole("row")).toHaveCount(11);

    // Penghitung TETAP memakai total terfilter penuh (N dari N akun), bukan
    // jumlah baris halaman (10) — itulah jaminan "penghitung" ini.
    const counter = page.getByText(
      `${expectedTotal} dari ${expectedTotal} akun`
    );
    await expect(counter).toBeVisible();

    // Berikutnya → halaman 2 (1 baris data + header), penghitung tak berubah.
    await page.getByRole("button", { name: "Berikutnya" }).click();
    await expect(page.getByText(/Halaman 2 dari 2/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeDisabled();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(counter).toBeVisible();

    // Sebelumnya → kembali ke halaman 1.
    await page.getByRole("button", { name: "Sebelumnya" }).click();
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();

    // Ukuran halaman: ganti ke 25 → semua akun muat 1 halaman → pagination
    // hilang, tapi penghitung tetap total penuh.
    await page
      .getByRole("combobox", { name: "Baris per halaman" })
      .click();
    await page.getByRole("option", { name: "25 / hal." }).click();
    await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toHaveCount(0);
    await expect(counter).toBeVisible();

    // CLEANUP: hapus 4 akun uji lewat API.
    const deleted = await page.evaluate<number>(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (await fetch("/api/users?limit=100")).json();
      let n = 0;
      for (const u of list.items as { id: string; name: string }[]) {
        if (u.name.startsWith("Akun Paginasi e2e")) {
          const r = await fetch(`/api/users/${u.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
          if (r.ok) n += 1;
        }
      }
      return n;
    });
    expect(deleted).toBe(4);

    // Kembali ke seed: pagination hilang, total pulih.
    await page.reload();
    await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);
    await expect(
      page.getByText(`${baseline} dari ${baseline} akun`)
    ).toBeVisible();
    const total = await page.evaluate<number>(async () => {
      const d = await (await fetch("/api/users?limit=1")).json();
      return d.total as number;
    });
    expect(total).toBe(baseline);
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

    // Query multi-hasil (huruf "a" ada di banyak nama seed). Daftar siswa
    // diurutkan name asc → Aisyah (index 0), Bima (index 1), Citra, …
    // (komponen bersama StudentTypeahead — perilaku sama dengan form
    // Data Prestasi).
    await studentInput.fill("a");

    const aisyah = dialog.getByRole("option", { name: /Aisyah Putri Ramadhani/ });
    const bima = dialog.getByRole("option", { name: /Bima Arya Saputra/ });
    await expect(aisyah).toHaveAttribute("aria-selected", "true");
    await expect(bima).toHaveAttribute("aria-selected", "false");

    // ArrowDown → highlight pindah ke index 1 (Bima), Aisyah tidak lagi
    // ter-highlight.
    await studentInput.press("ArrowDown");
    await expect(bima).toHaveAttribute("aria-selected", "true");
    await expect(aisyah).toHaveAttribute("aria-selected", "false");

    // Enter memilih siswa yang sedang di-highlight → nilai input terisi nama
    // siswa terpilih (bukan yang pertama).
    await studentInput.press("Enter");
    await expect(studentInput).toHaveValue("Bima Arya Saputra");

    // Tutup dialog tanpa menyimpan — fokus tes ini hanya navigasi keyboard.
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

    // Bersihkan sisa akun uji dari run sebelumnya (retry/CI).
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

    // Siapkan data referensi: dua siswa beda (untuk tautan ORANG_TUA & SISWA)
    // dan satu kelas (untuk wali GURU). Siswa SISWA dipilih yang belum punya
    // akun (cek daftar akun SISWA) agar tidak kena 409 "sudah punya akun".
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

    // Buat akun ORANG_TUA tertaut ke studentA lewat API.
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

    // --- 1) Edit ORANG_TUA: form menampilkan "Anak / Siswa yang Dipantau"
    //        dan select-nya sudah memuat studentA. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    const roleSelect = dialog.getByRole("combobox").first();
    await expect(roleSelect).toContainText("Orang Tua");
    // Pemilih siswa kini typeahead (sama seperti Data Prestasi) — nilai input
    // adalah NAMA siswa, bukan id.
    const anakSelect = dialog.getByLabel("Anak / Siswa yang Dipantau");
    await expect(anakSelect).toHaveValue(ref.studentA.name);

    // --- 2) ORANG_TUA → SISWA: label berubah jadi "Siswa Pemilik Akun";
    //        tautan siswa DIBWA dari guardianStudentId (tidak hilang), lalu
    //        ganti ke studentB dan simpan. ---
    await roleSelect.click();
    await page.getByRole("option", { name: "Siswa" }).click();
    const siswaSelect = dialog.getByLabel("Siswa Pemilik Akun");
    await expect(siswaSelect).toBeVisible();
    await expect(anakSelect).toHaveCount(0); // field lama hilang
    // Carry-over: field baru sudah terisi NAMA studentA (dibawa dari
    // guardianStudentId via handleRoleChange).
    await expect(siswaSelect).toHaveValue(ref.studentA.name);
    // Petunjuk carry muncul — auto-fill itu disengaja, bukan bug.
    await expect(
      dialog.getByText(/Tautan dibawa dari Orang Tua/)
    ).toBeVisible();
    // Ganti ke studentB lewat typeahead (ketik nama parsial → pilih opsi).
    await siswaSelect.fill(ref.studentB.name);
    await dialog
      .getByRole("option", { name: new RegExp(ref.studentB.name) })
      .click();
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Akun diperbarui.").first()).toBeVisible();
    await expect(dialog).toHaveCount(0); // dialog tertutup
    await expect(row().getByText("Siswa", { exact: true })).toBeVisible();
    await expect(row().getByText(`Kelas: ${ref.studentB.className}`)).toBeVisible();

    // --- Stale-state check 1: re-open → form harus pre-fill dari SERVER
    //        (role Siswa + tautan studentB), bukan sisa state sesi edit yang
    //        mengetik studentB lewat typeahead. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox").first()).toContainText("Siswa");
    await expect(dialog.getByLabel("Siswa Pemilik Akun")).toHaveValue(
      ref.studentB.name
    );
    // Petunjuk carry tidak persisten — re-open pre-fill dari server tanpa hint.
    await expect(dialog.getByText(/Tautan dibawa dari/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toHaveCount(0);
    // Batal tidak menyimpan apa pun → baris tetap Siswa + studentB.
    await expect(row().getByText("Siswa", { exact: true })).toBeVisible();
    await expect(
      row().getByText(`Kelas: ${ref.studentB.className}`)
    ).toBeVisible();

    // --- 3) SISWA → GURU: field siswa hilang, muncul "Wali Kelas";
    //        pilih wali kelas lalu simpan. ---
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

    // --- Stale-state check 2: re-open → role Guru + wali kelas ter-prefill
    //        (nilai tersimpan), bukan field siswa basi dari transisi
    //        sebelumnya. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox").first()).toContainText("Guru");
    await expect(dialog.getByLabel("Siswa Pemilik Akun")).toHaveCount(0);
    // Label "Wali Kelas" tanpa htmlFor → pakai trigger (combobox kedua).
    await expect(dialog.getByRole("combobox").nth(1)).toContainText(
      ref.waliClass.name
    );
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toHaveCount(0);

    // --- 4) GURU → kembali ORANG_TUA: field wali hilang, "Anak / Siswa yang
    //        Dipantau" muncul lagi; pilih studentA lalu simpan. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Orang Tua" }).click();
    await expect(dialog.getByLabel("Wali Kelas")).toHaveCount(0);
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
    await expect(
      row().getByText(`Anak: ${ref.studentA.name} (${ref.studentA.className})`)
    ).toBeVisible();

    // --- Stale-state check 3: re-open terakhir → role Orang Tua + studentA
    //        ter-prefill penuh; bukti tidak ada sisa state dari siklus
    //        SISWA/GURU sebelumnya. ---
    await row().getByRole("button", { name: "Edit akun" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox").first()).toContainText(
      "Orang Tua"
    );
    await expect(dialog.getByLabel("Anak / Siswa yang Dipantau")).toHaveValue(
      ref.studentA.name
    );
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toHaveCount(0);

    // Konfirmasi final lewat API: role ORANG_TUA dengan tautan studentA,
    // tanpa tautan SISWA/GURU yang basi dari transisi sebelumnya.
    const finalUser = await page.evaluate<Record<string, unknown> | null>(
      async (em) => {
        const d = await (await fetch("/api/users?limit=100")).json();
        const u = (d.items as { email: string }[]).find(
          (x) => x.email === em
        );
        return u ?? null;
      },
      email
    );
    expect(finalUser?.role).toBe("ORANG_TUA");
    expect(finalUser?.guardianStudentId).toBe(ref.studentA.id);
    expect(finalUser?.studentId).toBe(null);
    expect(finalUser?.guardianClassId).toBe(null);

    // CLEANUP: hapus akun uji lewat API.
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
