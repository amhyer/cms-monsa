import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/bos-expenditures /api/bos-documents /api/csrf-token /api/auth/login

test.describe("Transparansi — filter tahun (server-side)", () => {
  test("filter mempersempit tabel belanja & daftar dokumen sesuai tahun", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Seed hanya berisi belanja 2026 tanpa dokumen → buat satu belanja &
    // satu dokumen tahun 2025 lewat API ber-session (CSRF otomatis oleh
    // interceptor fetch global), lalu dibersihkan di akhir test.
    const expName = `Belanja 2025 test ${Date.now()}`;
    const docTitle = `Dokumen ARKAS 2025 test ${Date.now()}`;

    await login(page, ADMIN.email, ADMIN.password);

    await page.evaluate(
      async ({ expName, docTitle }) => {
        const post = async (url: string, body: BodyInit) => {
          const res = await fetch(url, { method: "POST", body });
          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(data.error || `POST ${url} gagal (${res.status})`);
          return data;
        };
        // Belanja 2025 (Rp 1.500.000).
        await post(
          "/api/bos-expenditures",
          JSON.stringify({
            year: 2025,
            source: "BOS Reguler",
            category: "Operasional",
            item: expName,
            amount: 1500000,
            quarter: null,
            note: null,
          })
        );
        // Dokumen 2025 — PDF minimal dengan magic bytes %PDF-.
        const pdf = new Blob(
          ["%PDF-1.7\n%mock\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"],
          { type: "application/pdf" }
        );
        const fd = new FormData();
        fd.append("year", "2025");
        fd.append("title", docTitle);
        fd.append("description", "Dokumen uji filter tahun");
        fd.append(
          "file",
          new File([pdf], "arkas-2025.pdf", { type: "application/pdf" })
        );
        await post("/api/bos-documents", fd);
      },
      { expName, docTitle }
    );

    // ---- Baseline: halaman publik dengan filter "Semua Tahun" ----
    await page.goto("/transparansi");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Transparansi Anggaran Sekolah",
      })
    ).toBeVisible();

    const filter = page.getByLabel("Filter tahun anggaran");
    await expect(filter).toHaveValue("all");
    // Opsi tahun berasal dari API (union belanja + dokumen).
    await expect(filter.locator("option")).toContainText(["2026", "2025"]);

    // Ringkasan per tahun tampil DI LABEL opsi (jumlah item + jumlah dokumen
    // + total nominal) sebelum dipilih — sama seperti dropdown admin:
    // 2026 = 8 belanja seed tanpa dokumen (Rp 82,5 jt); 2025 = 2 belanja seed
    // (Rp 12 jt) + 1 belanja buatan test (Rp 1,5 jt) + 1 dokumen 2025 yang
    // diunggah di atas → 3 item · 1 dokumen · Rp 13,5 jt.
    const opt2026 = filter.locator('option[value="2026"]');
    await expect(opt2026).toContainText("8 item");
    await expect(opt2026).toContainText("0 dokumen");
    await expect(opt2026).toContainText("Rp 82,5 jt");
    const opt2025 = filter.locator('option[value="2025"]');
    await expect(opt2025).toContainText("3 item");
    await expect(opt2025).toContainText("1 dokumen");
    await expect(opt2025).toContainText("Rp 13,5 jt");

    // Semua tahun: data 2025 (buatan) & data seed 2026 tampil bersama.
    await expect(
      page.getByRole("cell", { name: expName, exact: true })
    ).toBeVisible();
    await expect(page.getByText(docTitle)).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Honorarium guru tidak tetap" })
    ).toBeVisible();

    // ---- Filter 2026: belanja & dokumen 2025 hilang ----
    await filter.selectOption("2026");
    await expect(
      page.getByRole("cell", { name: expName, exact: true })
    ).toHaveCount(0);
    await expect(page.getByText(docTitle)).toHaveCount(0);
    // Data seed 2026 tetap tampil, dan daftar dokumen kosong untuk 2026.
    await expect(
      page.getByRole("cell", { name: "Honorarium guru tidak tetap" })
    ).toBeVisible();
    await expect(
      page.getByText("Belum ada dokumen pendukung yang diunggah untuk tahun ini.")
    ).toBeVisible();

    // ---- Filter 2025: hanya data 2025 yang tampil ----
    await filter.selectOption("2025");
    await expect(
      page.getByRole("cell", { name: expName, exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Honorarium guru tidak tetap" })
    ).toHaveCount(0);
    await expect(page.getByText(docTitle)).toBeVisible();
    // Ringkasan dihitung server-side untuk rentang 2025 (Rp 1.500.000).
    await expect(page.getByText("Rp 1.500.000").first()).toBeVisible();

    // ---- Kembali ke "Semua Tahun": kedua tahun tampil lagi ----
    await filter.selectOption("all");
    await expect(
      page.getByRole("cell", { name: expName, exact: true })
    ).toBeVisible();
    await expect(page.getByText(docTitle)).toBeVisible();

    // ---- Bersihkan data uji (hapus belanja & dokumen 2025 + file PDF-nya) ----
    await page.evaluate(
      async ({ expName, docTitle }) => {
        const del = async (url: string) => {
          const res = await fetch(url, { method: "DELETE" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(data.error || `DELETE ${url} gagal (${res.status})`);
          return data;
        };
        const [expRes, docRes] = await Promise.all([
          fetch("/api/bos-expenditures?limit=100").then((r) => r.json()),
          fetch("/api/bos-documents?limit=100").then((r) => r.json()),
        ]);
        const exp = (expRes.items || []).find(
          (i: { item: string }) => i.item === expName
        );
        const doc = (docRes.items || []).find(
          (d: { title: string }) => d.title === docTitle
        );
        const results: unknown[] = [];
        if (exp) results.push(await del(`/api/bos-expenditures/${exp.id}`));
        if (doc) results.push(await del(`/api/bos-documents/${doc.id}`));
        return results;
      },
      { expName, docTitle }
    );
  });
});
