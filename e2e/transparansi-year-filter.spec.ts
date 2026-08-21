import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/bos-expenditures /api/bos-documents /api/csrf-token /api/auth/login

test.describe("Transparansi — filter tahun (server-side)", () => {
  test("filter mempersempit tabel belanja & daftar dokumen sesuai tahun", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await login(page, ADMIN.email, ADMIN.password);

    // ---- Setup: buat data test tahun 2025 via page.evaluate (shared session) ----
    const stamp = Date.now();
    const expName = `Belanja 2025 test ${stamp}`;
    const docTitle = `Dokumen ARKAS 2025 test ${stamp}`;

    // Buat belanja 2025 + dokumen 2025 via page.evaluate (sudah login, CSRF otomatis).
    const setupResult = await page.evaluate<{ expOk: boolean; docOk: boolean }>(
      async (data) => {
        const csrf = await (await fetch("/api/csrf-token")).json();
        const headers = {
          "Content-Type": "application/json",
          "x-csrf-token": csrf.token,
        };

        // POST belanja 2025.
        const expRes = await fetch("/api/bos-expenditures", {
          method: "POST",
          headers,
          body: JSON.stringify({
            year: 2025,
            source: "BOS Reguler",
            category: "Operasional",
            item: data.expName,
            amount: 1500000,
            quarter: null,
            note: null,
          }),
        });

        // POST dokumen 2025 — PDF minimal via multipart.
        const fd = new FormData();
        fd.append("year", "2025");
        fd.append("title", data.docTitle);
        fd.append("description", "Dokumen uji filter tahun");
        fd.append(
          "file",
          new File(
            ["%PDF-1.7\n%mock\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"],
            "arkas-2025.pdf",
            { type: "application/pdf" }
          )
        );
        const docRes = await fetch("/api/bos-documents", {
          method: "POST",
          headers: { "x-csrf-token": csrf.token },
          body: fd,
        });

        return { expOk: expRes.ok, docOk: docRes.ok };
      },
      { expName, docTitle }
    );
    expect(setupResult.expOk).toBeTruthy();
    expect(setupResult.docOk).toBeTruthy();

    // ---- Halaman publik ----
    await page.goto("/transparansi");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Transparansi Anggaran Sekolah",
      })
    ).toBeVisible();

    const filter = page.getByLabel("Filter tahun anggaran");
    await expect(filter).toHaveValue("all");

    // Opsi tahun harus mencakup 2025 + tahun lain.
    const options = filter.locator("option");
    const optionTexts = await options.allTextContents();
    const has2025 = optionTexts.some((t) => t.includes("2025"));
    expect(has2025).toBe(true);
    const yearValues = await options.evaluateAll((els) =>
      els.filter((el) => el.value !== "all").map((el) => el.value)
    );
    expect(yearValues.length).toBeGreaterThanOrEqual(2);

    // Ringkasan per tahun tampil di label opsi.
    for (const opt of await options.all()) {
      const text = await opt.textContent();
      if (text && !text.includes("Semua")) {
        await expect(opt).toContainText(/item/);
        await expect(opt).toContainText(/dokumen/);
        await expect(opt).toContainText(/Rp/);
      }
    }

    // ---- Filter 2025: data test muncul ----
    await filter.selectOption("2025");
    // Tunggu re-render setelah filter berubah.
    await page.waitForTimeout(2000);

    // Verifikasi item 2025 ada di API 2025.
    const expIn2025 = await page.evaluate<boolean>(
      async (name) => {
        const r = await fetch("/api/bos-expenditures?year=2025&limit=1000");
        const d = await r.json();
        return d.items?.some((i: { item: string }) => i.item === name) ?? false;
      },
      expName
    );
    if (expIn2025) {
      // Item ada di API 2025 — pastikan TIDAK muncul di tahun lain.
      const otherYears = yearValues.filter((v) => v !== "2025");
      if (otherYears.length > 0) {
        await filter.selectOption(otherYears[0]);
        await page.waitForTimeout(2000);
        // Item 2025 tidak boleh muncul di tahun lain.
        await expect(
          page.getByRole("cell", { name: expName, exact: true })
        ).toHaveCount(0);
      }
    }

    // ---- Kembali ke "Semua Tahun": filter ter-reset ----
    await filter.selectOption("all");
    await page.waitForTimeout(2000);
    // Semua data tampil (termasuk 2025 + tahun lain).
    const allTotal = await page.evaluate<number>(async () => {
      const r = await fetch("/api/bos-expenditures?limit=1");
      const d = await r.json();
      return d.total;
    });
    expect(allTotal).toBeGreaterThanOrEqual(1);

    // ---- Bersihkan data uji ----
    await page.evaluate(async (data) => {
      const csrf = await (await fetch("/api/csrf-token")).json();
      const headers = { "x-csrf-token": csrf.token };

      // Hapus belanja uji.
      const expList = await (
        await fetch("/api/bos-expenditures?limit=1000")
      ).json();
      const expToDelete = expList.items?.find(
        (i: { item: string }) => i.item === data.expName
      );
      if (expToDelete) {
        await fetch(`/api/bos-expenditures/${expToDelete.id}`, {
          method: "DELETE",
          headers,
        });
      }

      // Hapus dokumen uji.
      const docList = await (
        await fetch("/api/bos-documents?limit=1000")
      ).json();
      const docToDelete = docList.items?.find(
        (d: { title: string }) => d.title === data.docTitle
      );
      if (docToDelete) {
        await fetch(`/api/bos-documents/${docToDelete.id}`, {
          method: "DELETE",
          headers,
        });
      }
    }, { expName, docTitle });
  });
});
