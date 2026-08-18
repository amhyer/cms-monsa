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

    // Data seed BOS deterministik (prisma/seed.ts).
    await expect(
      page.getByRole("cell", { name: "Honorarium guru tidak tetap" })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Pembelian buku & alat peraga" })
    ).toBeVisible();
    await expect(page.getByText("BOS Reguler", { exact: true }).first()).toBeVisible();

    // Seksi dokumen pendukung tampil (seed belum punya dokumen).
    await expect(
      page.getByRole("heading", { name: "Dokumen Pendukung (PDF)" })
    ).toBeVisible();
    await expect(
      page.getByText("Belum ada dokumen pendukung yang diunggah untuk tahun ini.")
    ).toBeVisible();

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

  test("dashboard admin — dropdown tahun menampilkan chip ringkasan per tahun", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(
      page.getByRole("button", { name: "Tambah Belanja" })
    ).toBeVisible();

    // Buka dropdown tahun → tiap opsi memuat chip ringkasan (jumlah item +
    // jumlah dokumen + total nominal) dari yearStats API, agar admin lihat
    // total sebelum pilih. Seed kini memuat DUA tahun anggaran dengan total
    // yang BERBEDA: 2026 = 8 item Rp 82,5 jt, 2025 = 2 item Rp 12 jt (keduanya
    // tanpa dokumen → 0 dokumen).
    const trigger = page.getByRole("combobox").first();
    await trigger.click();
    const opt2026 = page.getByRole("option", { name: /2026/ });
    await expect(opt2026).toBeVisible();
    await expect(opt2026).toContainText("8 item");
    await expect(opt2026).toContainText("0 dokumen");
    await expect(opt2026).toContainText("Rp 82,5 jt");
    // Tahun kedua ikut tampil dengan chip totalnya SENDIRI (beda jumlah item
    // & nominal — tidak sekadar menyalin chip 2026).
    const opt2025 = page.getByRole("option", { name: /2025/ });
    await expect(opt2025).toBeVisible();
    await expect(opt2025).toContainText("2 item");
    await expect(opt2025).toContainText("0 dokumen");
    await expect(opt2025).toContainText("Rp 12 jt");

    // Pilih tahun → trigger tertutup hanya menampilkan tahun (tanpa chip).
    await opt2026.click();
    await expect(trigger).toHaveText(/2026/);
    await expect(trigger).not.toContainText("8 item");
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
    const unduh = page.getByRole("link", { name: "Unduh PDF" });
    await expect(unduh).toBeVisible();
    // Unduh via endpoint (Content-Disposition: attachment) — bukan file statis.
    await expect(unduh).toHaveAttribute("href", /\/api\/bos-documents\//);

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

    // Tidak ada yang tersimpan: daftar dokumen tetap kosong.
    await expect(page.getByText("Belum ada dokumen")).toBeVisible();
    const docs = await page.evaluate<{ items: unknown[] }>(async () => {
      const res = await fetch("/api/bos-documents");
      return res.json();
    });
    expect(docs.items).toHaveLength(0);
  });

  test("dashboard admin — file >15 MB ditolak dengan pesan batas ukuran", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await expect(page.getByRole("button", { name: "Tambah Belanja" })).toBeVisible();

    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

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

    // Tidak ada yang tersimpan: daftar dokumen tetap kosong.
    await expect(page.getByText("Belum ada dokumen")).toBeVisible();
    const docs = await page.evaluate<{ items: unknown[] }>(async () => {
      const res = await fetch("/api/bos-documents");
      return res.json();
    });
    expect(docs.items).toHaveLength(0);

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

    // Baseline: seed 10 belanja (8× 2026 + 2× 2025) → totalPages 1 → kontrol
    // pagination tidak dirender (EXP_LIMIT = 10 di manager).
    await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);

    // Tambah 3 belanja → total 13 → 2 halaman (EXP_LIMIT = 10 di manager).
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
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

    // Halaman 1 dari 2: 10 baris data + 1 baris header.
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sebelumnya" })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeEnabled();
    await expect(page.getByRole("row")).toHaveCount(11);

    // Berikutnya → halaman 2 (3 baris data: 13 − 10), Berikutnya nonaktif.
    await page.getByRole("button", { name: "Berikutnya" }).click();
    await expect(page.getByText(/Halaman 2 dari 2/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeDisabled();
    await expect(page.getByRole("row")).toHaveCount(4);

    // Sebelumnya → kembali ke halaman 1.
    await page.getByRole("button", { name: "Sebelumnya" }).click();
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();

    // CLEANUP: hapus 3 belanja uji lewat API (urutan halaman tidak relevan
    // karena sortir tahun/sumber/createdAt bisa melemparnya ke hal. 2).
    const deleted = await page.evaluate<number>(async (items) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (
        await fetch("/api/bos-expenditures?limit=100")
      ).json();
      let n = 0;
      for (const it of list.items) {
        if (items.includes(it.item)) {
          const r = await fetch(`/api/bos-expenditures/${it.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
          if (r.ok) n += 1;
        }
      }
      return n;
    }, names);
    expect(deleted).toBe(3);

    // Kembali ke seed (10) → pagination hilang lagi.
    await page.reload();
    await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toHaveCount(0);
    const total = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-expenditures?limit=100");
      const d = await r.json();
      return d.total;
    });
    expect(total).toBe(10);
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

    // Baseline: seed 0 dokumen → 1 halaman → kontrol pagination tidak dirender.
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();
    await expect(page.getByText("Belum ada dokumen")).toBeVisible();
    await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);

    // Buat 11 dokumen lewat API (sesi admin + CSRF, isi %PDF- valid) →
    // total 11 → 2 halaman (DOC_LIMIT = 10 di manager). Nama unik per run.
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

    // Halaman 1 dari 2: 10 baris data + 1 baris header; badge total penuh.
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();
    await expect(page.getByText("11 dokumen")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sebelumnya" })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeEnabled();
    await expect(page.getByRole("row")).toHaveCount(11);

    // Berikutnya → halaman 2 (1 baris data), Berikutnya nonaktif.
    await page.getByRole("button", { name: "Berikutnya" }).click();
    await expect(page.getByText(/Halaman 2 dari 2/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toBeDisabled();
    await expect(page.getByRole("row")).toHaveCount(2);

    // Sebelumnya → kembali ke halaman 1.
    await page.getByRole("button", { name: "Sebelumnya" }).click();
    await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();

    // CLEANUP: hapus 11 dokumen uji lewat API (termasuk file PDF-nya).
    const deleted = await page.evaluate<number>(async (names) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const list = await (
        await fetch("/api/bos-documents?limit=100")
      ).json();
      let n = 0;
      for (const d of list.items) {
        if (names.includes(d.title)) {
          const r = await fetch(`/api/bos-documents/${d.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
          if (r.ok) n += 1;
        }
      }
      return n;
    }, titles);
    expect(deleted).toBe(11);

    // Kembali ke seed (0) → pagination hilang lagi.
    await page.reload();
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();
    await expect(page.getByText("Belum ada dokumen")).toBeVisible();
    await expect(page.getByText(/Halaman 1 dari/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Berikutnya" })
    ).toHaveCount(0);
    const total = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents?limit=100");
      const d = await r.json();
      return d.total;
    });
    expect(total).toBe(0);
  });
});
