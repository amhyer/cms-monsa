import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";
import { join } from "node:path";
import { existsSync } from "node:fs";

// warmup: POST /api/bos-documents DELETE /api/bos-documents /api/bos-documents /api/csrf-token /api/auth/login

test.describe("Dokumen BOS — siklus upload → unduh → hapus (cleanup)", () => {
  test("unggah PDF, unduh & verifikasi isi, hapus & pastikan file ikut terhapus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);

    // --- SETUP: bersihkan dokumen sisa dari run sebelumnya (paginate) ---
    await page.evaluate(async () => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      let pg = 1;
      let hasMore = true;
      while (hasMore) {
        const list = await (
          await fetch(`/api/bos-documents?page=${pg}&limit=100`)
        ).json();
        for (const doc of list.items) {
          await fetch(`/api/bos-documents/${doc.id}`, {
            method: "DELETE",
            headers: { "x-csrf-token": csrf.token },
          });
        }
        hasMore = list.items.length === 100;
        pg++;
      }
    });

    await page.goto("/dashboard/transparansi");
    await expect(
      page.getByRole("button", { name: "Tambah Belanja" })
    ).toBeVisible();

    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    // PDF unik ber-penanda agar isi file bisa diverifikasi byte-per-byte
    // setelah unduh (magic bytes %PDF- memenuhi validasi server).
    const marker = `E2E-BOS-CYCLE-${Date.now()}`;
    const pdf = Buffer.from(
      `%PDF-1.7\n%${marker}\n1 0 obj\n<< /Title (${marker}) >>\nendobj\ntrailer\n<<>>\n%%EOF\n`
    );
    const title = `Output ARKAS siklus ${Date.now()}`;
    await page.getByLabel("Tahun Anggaran").fill("2026");
    await page.getByLabel("Judul Dokumen").fill(title);
    await page.getByLabel("Deskripsi (opsional)").fill("Siklus penuh e2e");
    await page.setInputFiles('input[type="file"]', {
      name: "siklus.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await page.getByRole("button", { name: "Upload PDF" }).click();
    await expect(
      page.getByText("Dokumen diunggah dan dipublikasikan.")
    ).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    // --- UPLOAD: file benar-benar tertulis ke disk (public/uploads) ---
    const fileUrl = await page.evaluate<string | null>(async (t) => {
      const r = await fetch("/api/bos-documents");
      const d = await r.json();
      const item = d.items.find((i: { title: string }) => i.title === t);
      return item ? item.fileUrl : null;
    }, title);
    expect(fileUrl).toMatch(/^\/uploads\/bos-[\w-]+\.pdf$/);
    const diskPath = join(
      process.cwd(),
      "public",
      "uploads",
      (fileUrl as string).split("/").pop() as string
    );
    expect(existsSync(diskPath)).toBe(true);

    // --- UNDUH via endpoint: Content-Disposition attachment + byte identik ---
    const docId = await page.evaluate<string | null>(async (t) => {
      const r = await fetch("/api/bos-documents");
      const d = await r.json();
      const item = d.items.find((i: { title: string }) => i.title === t);
      return item ? item.id : null;
    }, title);
    expect(docId).toBeTruthy();
    const downloadUrl = `/api/bos-documents/${docId}`;
    const res = await page.request.get(downloadUrl);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toContain("application/pdf");
    // Kontrak unduh: header Content-Disposition menyatakan attachment dengan
    // nama file asli — browser mengunduh, bukan membuka inline di tab baru.
    const disposition = res.headers()["content-disposition"] ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename=\"siklus.pdf\"");
    const downloaded = Buffer.from(await res.body());
    expect(downloaded.equals(pdf)).toBe(true);

    // Halaman publik: dokumen tampil dengan tautan unduh ke endpoint.
    await page.goto("/transparansi");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Transparansi Anggaran Sekolah",
      })
    ).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    // Cari link unduh spesifik untuk dokumen ini (bisa banyak "Unduh PDF" lain).
    const unduhLink = page
      .locator(`a[href="${downloadUrl}"]`)
      .first();
    await expect(unduhLink).toBeVisible();

    // --- HAPUS lewat dashboard ---
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

    // --- CLEANUP PENUH: baris DB hilang, file di disk ikut terhapus ---
    expect(existsSync(diskPath)).toBe(false);
    const old = await page.request.get(downloadUrl);
    expect(old.status()).toBe(404);
    // Verifikasi dokumen ini sudah tidak ada di API.
    const docs = await page.evaluate<{ items: { id: string }[] }>(async () => {
      const r = await fetch("/api/bos-documents?limit=1000");
      return r.json();
    });
    const stillExists = docs.items.some((d) => d.id === docId);
    expect(stillExists).toBe(false);

    // Halaman publik: dokumen yang dihapus sudah tidak tampil.
    await page.goto("/transparansi");
    await page.reload();
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 20_000 });
  });

  test("tolak PDF > 15 MB dengan pesan khusus (tanpa baris/file tersisa)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    const count = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents");
      return (await r.json()).items.length;
    });

    // > 15 MB (MAX_SIZE = 15 * 1024 * 1024) — isi diawali %PDF- agar kalau
    // pun lolos cek ukuran, cek magic bytes tidak ikut menyembunyikan jalur
    // yang diuji (cek ukuran terjadi LEBIH DULU di route).
    const big = Buffer.alloc(15 * 1024 * 1024 + 1);
    big.write("%PDF-1.7\n");
    const title = `Output ARKAS oversize ${Date.now()}`;
    await page.getByLabel("Tahun Anggaran").fill("2026");
    await page.getByLabel("Judul Dokumen").fill(title);
    await page.setInputFiles('input[type="file"]', {
      name: "terlalu-besar.pdf",
      mimeType: "application/pdf",
      buffer: big,
    });
    await page.getByRole("button", { name: "Upload PDF" }).click();

    // Pesan khusus ukuran maksimal (bukan 500 body terpotong).
    await expect(page.getByText("Ukuran file maksimal 15 MB.")).toBeVisible();
    // Tidak ada baris yang dibuat, tidak ada judul di daftar dokumen.
    await expect(page.getByText(title)).toHaveCount(0);
    const after = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents");
      return (await r.json()).items.length;
    });
    expect(after).toBe(count);
  });

  test("tolak file non-PDF yang menyamar .pdf lewat cek magic bytes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/transparansi");
    await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

    const count = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents");
      return (await r.json()).items.length;
    });

    // Penyamaran: nama + mimeType PDF, tapi isi memakai magic bytes PNG.
    const fake = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
      Buffer.from(`E2E-BOS-DISGUISE-${Date.now()}\n`),
    ]);
    const title = `Output ARKAS palsu ${Date.now()}`;
    await page.getByLabel("Tahun Anggaran").fill("2026");
    await page.getByLabel("Judul Dokumen").fill(title);
    await page.setInputFiles('input[type="file"]', {
      name: "palsu.pdf",
      mimeType: "application/pdf",
      buffer: fake,
    });
    await page.getByRole("button", { name: "Upload PDF" }).click();

    // Ditolak oleh cek magic bytes dengan pesan khusus.
    await expect(
      page.getByText(
        "Isi file bukan PDF yang valid. Gunakan file PDF (output ARKAS / bukti belanja)."
      )
    ).toBeVisible();
    // Tidak ada baris yang dibuat, tidak ada judul di daftar dokumen.
    await expect(page.getByText(title)).toHaveCount(0);
    const after = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-documents");
      return (await r.json()).items.length;
    });
    expect(after).toBe(count);
  });
});
