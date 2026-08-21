import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// warmup: /api/bos-expenditures /api/bos-documents /api/auth/login

/**
 * Baca log server live (server → %TEMP%/monsa-e2e-server-<pid>.log + .log.err,
 * yang DIGABUNG ke E2E_SERVER_LOG/artifact saat suite selesai). Karena pid
 * wrapper tidak diketahui test, ambil file terbaru dengan prefiks itu, dan
 * gabungkan stdout + stderr (console.warn/error rute masuk ke stderr).
 */
function latestServerLog(): string {
  const dir = tmpdir();
  const logs = readdirSync(dir).filter(
    (f) => f.startsWith("monsa-e2e-server-") && f.endsWith(".log")
  );
  const base = logs
    // Urutkan berdasarkan mtime (bukan nama — nama memakai pid wrapper yang
    // tidak berurutan antar run; sort leksikografis bisa memilih run lama).
    .sort(
      (a, b) =>
        statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs
    )[0];
  const out = readFileSync(join(dir, base), "utf8");
  const errFile = join(dir, `${base}.err`);
  const err = existsSync(errFile) ? readFileSync(errFile, "utf8") : "";
  return `${out}\n${err}`;
}

test.describe("Transparansi Anggaran (ARKAS / Dana BOS)", () => {
  test("halaman publik menampilkan belanja BOS & total", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/transparansi");
    await expect(
      page.getByRole("heading", { level: 1, name: "Transparansi Anggaran Sekolah" })
    ).toBeVisible();

    // Ambil baseline dari API — tidak hardcode seed.
    const baseline = await page.evaluate<{ total: number; years: number[] }>(
      async () => {
        const r = await fetch("/api/bos-expenditures?limit=1");
        const d = await r.json();
        // Dapatkan daftar tahun unik.
        const r2 = await fetch("/api/bos-expenditures?limit=1000");
        const d2 = await r2.json();
        const years = [...new Set(d2.items.map((i: { year: number }) => i.year))];
        return { total: d.total, years };
      }
    );

    if (baseline.total > 0) {
      // Ada data belanja — tabel minimal punya header + 1 baris data.
      const rows = page.getByRole("row");
      await expect(rows.first()).toBeVisible({ timeout: 10_000 });
      // Minimal 1 kolom amount menampilkan "Rp".
      await expect(page.getByRole("cell", { name: /Rp/ }).first()).toBeVisible();
    } else {
      // Tidak ada data — tampilkan empty state.
      await expect(page.getByText(/belum ada data|Data anggaran belum tersedia/)).toBeVisible();
    }

    // Seksi dokumen pendukung tampil.
    await expect(
      page.getByRole("heading", { name: "Dokumen Pendukung (PDF)" })
    ).toBeVisible();
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

  test("dashboard admin — dropdown tahun menampilkan chip ringkasan per tahun", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(page.getByRole("button", { name: "Tambah Belanja" })).toBeVisible();

    // Buka dropdown tahun → minimal 1 opsi dengan chip ringkasan.
    // Format chip: "N item • N dokumen • Rp X".
    const trigger = page.getByRole("combobox").first();
    await trigger.click();

    // Cari semua opsi tahun.
    const options = page.getByRole("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(1);

    // Setiap opsi tahun (bukan 'Semua Tahun') harus memuat info ringkasan.
    for (let i = 0; i < optionCount; i++) {
      const opt = options.nth(i);
      const text = await opt.textContent();
      if (text && !text.includes("Semua")) {
        await expect(opt).toContainText(/item/);
        await expect(opt).toContainText(/dokumen/);
        await expect(opt).toContainText(/Rp/);
      }
    }

    // Pilih tahun pertama (bukan 'Semua Tahun') → trigger tertutup hanya menampilkan tahun.
    let yearOption = null;
    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent();
      if (text && /\d{4}/.test(text) && !text.includes("Semua")) {
        yearOption = options.nth(i);
        break;
      }
    }
    if (yearOption) {
      await yearOption.click();
      await expect(trigger).toHaveText(/\d{4}/);
      // Trigger tidak menampilkan chip (N item...) setelah ditutup.
      await expect(trigger).not.toContainText("item");
    }
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

  test("dashboard admin — upload PDF ARKAS & tampil di halaman publik", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(page.getByRole("button", { name: "Tambah Belanja" })).toBeVisible();

    // Buka tab Dokumen (PDF).
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    const title = `Output ARKAS test ${Date.now()}`;
    await page.getByLabel("Tahun Anggaran").fill("2026");
    await page.getByLabel("Judul Dokumen").fill(title);
    await page.getByLabel("Deskripsi (opsional)").fill("Dokumen uji e2e");
    // PDF minimal dengan magic bytes %PDF- (validasi isi file di server).
    await page.setInputFiles('input[type="file"]', {
      name: "arkas-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.7\n%mock\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
      ),
    });
    await page.getByRole("button", { name: "Upload PDF" }).click();
    await expect(
      page.getByText("Dokumen diunggah dan dipublikasikan.")
    ).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    // Publik: dokumen tampil dengan tombol unduh.
    await page.goto("/transparansi");
    await expect(
      page.getByRole("heading", { level: 1, name: "Transparansi Anggaran Sekolah" })
    ).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    // Cari link unduh spesifik untuk dokumen ini (bisa banyak "Unduh PDF" lain).
    const unduhLink = page.locator(`a[href*="/api/bos-documents/"]`).filter({ hasText: "Unduh PDF" }).first();
    await expect(unduhLink).toBeVisible();
    await expect(unduhLink).toHaveAttribute("href", /\/api\/bos-documents\//);

    // Bersihkan: hapus dokumen + file-nya.
    await page.goto("/dashboard/transparansi");
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "Hapus" })
      .click();
    await page.getByRole("button", { name: "Hapus", exact: true }).click();
    await expect(page.getByText("Dokumen dihapus.")).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("dashboard admin — non-PDF yang menyamar ditolak (magic bytes)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(page.getByRole("button", { name: "Tambah Belanja" })).toBeVisible();

    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    // Catat jumlah dokumen SEBELUM upload — bukan hardcode 0.
    const beforeCount = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents?limit=1");
      const d = await r.json();
      return d.total;
    });

    const title = `Output ARKAS palsu test ${Date.now()}`;
    await page.getByLabel("Tahun Anggaran").fill("2026");
    await page.getByLabel("Judul Dokumen").fill(title);
    // Penyamaran terkuat: nama .pdf + MIME application/pdf, tapi isi file
    // teks biasa tanpa magic bytes "%PDF-" → server wajib menolak berdasarkan
    // isi file (detectPdf), bukan klaim ekstensi/MIME dari klien.
    await page.setInputFiles('input[type="file"]', {
      name: "fake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "Ini bukan PDF — hanya teks biasa tanpa magic bytes."
      ),
    });
    await page.getByRole("button", { name: "Upload PDF" }).click();

    // Toast error dari API (HTTP 400) tampil utuh.
    await expect(
      page.getByText(
        "Isi file bukan PDF yang valid. Gunakan file PDF (output ARKAS / bukti belanja)."
      )
    ).toBeVisible();

    // Form pulih dengan baik: judul & file tetap terisi untuk diganti.
    await expect(page.getByLabel("Judul Dokumen")).toHaveValue(title);
    await expect(page.getByText(/fake\.pdf/)).toBeVisible();

    // Jumlah dokumen tidak bertambah (tolakan berhasil).
    const afterCount = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents?limit=1");
      const d = await r.json();
      return d.total;
    });
    expect(afterCount).toBe(beforeCount);
  });

  test("dashboard admin — file >15 MB ditolak dengan pesan batas ukuran", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(page.getByRole("button", { name: "Tambah Belanja" })).toBeVisible();

    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    // Catat jumlah dokumen SEBELUM upload — bukan hardcode 0.
    const beforeCount = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents?limit=1");
      const d = await r.json();
      return d.total;
    });

    await page.getByLabel("Tahun Anggaran").fill("2026");
    await page.getByLabel("Judul Dokumen").fill(`Output ARKAS oversize test ${Date.now()}`);
    // File 16 MB dengan magic bytes %PDF- VALID → hanya cek UKURAN
    // (MAX_SIZE 15MB di route) yang boleh menolak, bukan cek magic bytes.
    // Proxy Next mem-buffer body (proxyClientMaxBodySize di next.config.ts)
    // harus lebih besar dari 15MB agar body utuh sampai ke route.
    const oversize = Buffer.alloc(16 * 1024 * 1024 + 1);
    oversize.write("%PDF-", 0, "latin1");
    await page.setInputFiles('input[type="file"]', {
      name: "oversize.pdf",
      mimeType: "application/pdf",
      buffer: oversize,
    });
    await page.getByRole("button", { name: "Upload PDF" }).click();

    // Toast error dari API (HTTP 400) dengan pesan batas ukuran yang spesifik.
    await expect(page.getByText("Ukuran file maksimal 15 MB.")).toBeVisible();

    // Jumlah dokumen tidak bertambah (tolakan berhasil).
    const afterCount = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents?limit=1");
      const d = await r.json();
      return d.total;
    });
    expect(afterCount).toBe(beforeCount);

    // Jejak audit: route mencatat penolakan ke log server dengan reason
    // "terlalu-besar" + nama file yang dicoba (bukan hanya status 400).
    // latestServerLog() sudah mengembalikan ISI (stdout + stderr) —
    // console.warn rute masuk ke stderr, jadi tidak cukup stdout saja.
    const serverLog = latestServerLog();
    expect(serverLog).toContain("[bos-documents] unggahan ditolak");
    expect(serverLog).toContain("terlalu-besar");
    expect(serverLog).toContain("oversize.pdf");
  });

  test("dashboard admin — pagination belanja muncul & bekerja saat >10 baris", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(
      page.getByRole("button", { name: "Tambah Belanja" })
    ).toBeVisible();

    // Baseline dari API — tidak hardcode seed.
    const baseline = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-expenditures?limit=1");
      const d = await r.json();
      return d.total;
    });
    expect(baseline).toBeGreaterThanOrEqual(0);

    // Jika sudah > 10, pagination sudah muncul. Jika ≤ 10, tambah item.
    const EXP_LIMIT = 10;
    let needAdd = 0;
    if (baseline <= EXP_LIMIT) {
      needAdd = EXP_LIMIT - baseline + 1; // buat supaya total > 10
    }

    const names: string[] = [];
    for (let i = 0; i < needAdd; i++) {
      const name = `Belanja paginasi ${Date.now()}-${i}`;
      names.push(name);
      await page.getByRole("button", { name: "Tambah Belanja" }).click();
      await page.getByLabel("Uraian Belanja").fill(name);
      await page.getByLabel("Kategori Belanja").fill("Operasional");
      await page.getByLabel("Nominal (Rp)").fill("100000");
      await page.getByRole("button", { name: "Simpan" }).click();
      // Toast auto-dismiss bisa menumpuk antar iterasi loop yang cepat →
      // strict mode violation; .first() cukup (semua toast berteks sama).
      await expect(page.getByText("Belanja ditambahkan.").first()).toBeVisible();
    }

    const totalAfter = baseline + needAdd;
    const totalPages = Math.ceil(totalAfter / EXP_LIMIT);

    if (totalAfter > EXP_LIMIT) {
      // Pagination harus muncul.
      await expect(page.getByText(new RegExp(`Halaman 1 dari ${totalPages}`))).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sebelumnya" })
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Berikutnya" })
      ).toBeEnabled();

      // Berikutnya → halaman terakhir.
      for (let p = 1; p < totalPages; p++) {
        await page.getByRole("button", { name: "Berikutnya" }).click();
      }
      await expect(
        page.getByText(new RegExp(`Halaman ${totalPages} dari ${totalPages}`))
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Berikutnya" })
      ).toBeDisabled();

      // Sebelumnya → kembali ke halaman 1.
      for (let p = totalPages - 1; p > 0; p--) {
        await page.getByRole("button", { name: "Sebelumnya" }).click();
      }
      await expect(page.getByText(new RegExp(`Halaman 1 dari ${totalPages}`))).toBeVisible();
    }

    // CLEANUP: hapus belanja uji lewat API.
    const deleted = await page.evaluate<number>(async (items) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      let pg = 1;
      let hasMore = true;
      let n = 0;
      while (hasMore) {
        const list = await (
          await fetch(`/api/bos-expenditures?page=${pg}&limit=100`)
        ).json();
        for (const it of list.items) {
          if (items.includes(it.item)) {
            const r = await fetch(`/api/bos-expenditures/${it.id}`, {
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
    }, names);
    expect(deleted).toBe(needAdd);

    // Kembali ke baseline → pagination kondisi awal.
    await page.reload();
    const finalTotal = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-expenditures?limit=1");
      const d = await r.json();
      return d.total;
    });
    expect(finalTotal).toBe(baseline);
    if (baseline <= EXP_LIMIT) {
      await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);
    }
  });

  test("dashboard admin — pagination dokumen PDF muncul & bekerja saat >10 dokumen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(
      page.getByRole("button", { name: "Tambah Belanja" })
    ).toBeVisible();

    // Cleanup semua dokumen uji sebelumnya (paginate untuk Dapodik scale).
    await page.evaluate(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      let pg = 1;
      let hasMore = true;
      while (hasMore) {
        const list = await (
          await fetch(`/api/bos-documents?page=${pg}&limit=100`)
        ).json();
        for (const d of list.items) {
          if (d.title.startsWith("Dokumen paginasi") || d.title.startsWith("Output ARKAS")) {
            await fetch(`/api/bos-documents/${d.id}`, {
              method: "DELETE",
              headers: { "x-csrf-token": csrf.token },
            });
          }
        }
        hasMore = list.items.length === 100;
        pg++;
      }
    });

    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    // Baseline dokumen dari API.
    const baseline = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents?limit=1");
      const d = await r.json();
      return d.total;
    });

    // Buat 11 dokumen lewat API (sesi admin + CSRF, isi %PDF- valid) →
    // total = baseline + 11. Nama unik per run.
    const titles = await page.evaluate<string[]>(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const out: string[] = [];
      const stamp = Date.now();
      for (let i = 0; i < 11; i++) {
        const title = `Dokumen paginasi ${stamp}-${i}`;
        out.push(title);
        const fd = new FormData();
        fd.append("year", "2026");
        fd.append("title", title);
        fd.append("description", "Dokumen uji pagination e2e");
        fd.append(
          "file",
          new File(
            ["%PDF-1.7\n%mock\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"],
            `paginasi-${i}.pdf`,
            { type: "application/pdf" }
          )
        );
        const r = await fetch("/api/bos-documents", {
          method: "POST",
          headers: { "x-csrf-token": csrf.token },
          body: fd,
        });
        if (!r.ok) throw new Error(`upload ${i} gagal: ${r.status}`);
      }
      return out;
    });
    expect(titles).toHaveLength(11);

    // Muat ulang agar fetchDocs membaca halaman 1 yang baru.
    await page.reload();
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    const totalAfter = baseline + titles.length;
    const DOC_LIMIT = 10;
    const totalPages = Math.ceil(totalAfter / DOC_LIMIT);

    if (totalAfter > DOC_LIMIT) {
      // Pagination harus muncul.
      await expect(page.getByText(new RegExp(`Halaman 1 dari ${totalPages}`))).toBeVisible();
      await expect(page.getByText(`${totalAfter} dokumen`)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sebelumnya" })
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Berikutnya" })
      ).toBeEnabled();

      // Berikutnya → halaman terakhir.
      for (let p = 1; p < totalPages; p++) {
        await page.getByRole("button", { name: "Berikutnya" }).click();
      }
      await expect(
        page.getByText(new RegExp(`Halaman ${totalPages} dari ${totalPages}`))
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Berikutnya" })
      ).toBeDisabled();

      // Sebelumnya → kembali ke halaman 1.
      for (let p = totalPages - 1; p > 0; p--) {
        await page.getByRole("button", { name: "Sebelumnya" }).click();
      }
      await expect(page.getByText(new RegExp(`Halaman 1 dari ${totalPages}`))).toBeVisible();
    }

    // CLEANUP: hapus 11 dokumen uji lewat API (paginate).
    const deleted = await page.evaluate<number>(async (names) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      let pg = 1;
      let hasMore = true;
      let n = 0;
      while (hasMore) {
        const list = await (
          await fetch(`/api/bos-documents?page=${pg}&limit=100`)
        ).json();
        for (const d of list.items) {
          if (names.includes(d.title)) {
            const r = await fetch(`/api/bos-documents/${d.id}`, {
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
    }, titles);
    expect(deleted).toBe(11);

    // Kembali ke baseline.
    await page.reload();
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();
    const finalTotal = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents?limit=1");
      const d = await r.json();
      return d.total;
    });
    expect(finalTotal).toBe(baseline);
    if (baseline === 0) {
      await expect(page.getByText("Belum ada dokumen")).toBeVisible();
    }
    if (baseline <= DOC_LIMIT) {
      await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);
    }
  });
});
