import { test, expect } from "./mutation-log";

// warmup: /api/teachers
test("academic page: directory, kalender, dan halaman portofolio guru", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/academic", { waitUntil: "networkidle" });

  await expect(page.getByText("Direktori Guru & Staf")).toBeVisible();

  // Kartu guru membuka MODAL profil (sama seperti kartu struktur organisasi).
  const guruCards = page.locator('button[aria-label^="Lihat profil "]');
  // count() tidak auto-wait (data guru di-fetch client-side) → tunggu kartu
  // pertama tampil dulu, baru hitung total.
  await expect(guruCards.first()).toBeVisible();
  const n = await guruCards.count();
  console.log("KARTU GURU:", n);
  expect(n).toBeGreaterThan(0);

  // Kalender akademik
  await expect(
    page.getByRole("heading", { name: "Kalender Akademik", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Agustus 2026|September 2026|Oktober 2026/ })
  ).toBeVisible();

  // Klik kartu pertama → MODAL profil (bio/kontak, tanpa NUPTK/NIP/NIK).
  // Ambil data guru pertama dari API (bukan hardcode seed).
  const firstTeacher = await page.evaluate<
    { name: string; bio?: string; contact?: string } | null
  >(async () => {
    const d = await (await fetch("/api/teachers?limit=1000")).json();
    return (d.items as { name: string; bio?: string; contact?: string }[])[0] ?? null;
  });
  if (firstTeacher) {
    await guruCards.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading").first()).toBeVisible();
    // Assert nama guru ada di modal (dynamic, bukan hardcode seed).
    await expect(dialog.getByText(new RegExp(firstTeacher.name))).toBeVisible();
    // Assert bio ada jika tersedia.
    if (firstTeacher.bio) {
      await expect(dialog.getByText(new RegExp(firstTeacher.bio.slice(0, 20)))).toBeVisible();
    }
    // Assert email ada jika tersedia.
    if (firstTeacher.contact) {
      await expect(
        dialog.getByRole("link", { name: new RegExp(firstTeacher.contact) })
      ).toHaveAttribute("href", new RegExp(firstTeacher.contact));
    }
    // Identitas tidak boleh bocor di modal publik.
    await expect(dialog.getByText(/NUPTK|NIP|NIK/, { exact: false })).toHaveCount(0);
  }

  // "Lihat profil lengkap" → halaman portofolio guru.
  await dialog.getByRole("link", { name: "Lihat profil lengkap" }).click();
  await page.waitForURL("**/academic/guru/**");
  await expect(
    page.getByRole("heading", { name: "Profil Guru & Staf" })
  ).toBeVisible();
  await expect(page.getByText("Data Diri")).toBeVisible();
  await expect(page.getByText("Mengajar")).toBeVisible();
  // Keamanan: identitas (NUPTK/NIP/NIK) tidak boleh bocor ke portofolio
  // publik — hanya ada di scope admin (dashboard).
  const nuptkRows = page.locator("dt", { hasText: "NUPTK" });
  const nipRows = page.locator("dt", { hasText: "NIP" });
  const nikRows = page.locator("dt", { hasText: "NIK" });
  console.log(
    "IDENTITAS DI PORTOFOLIO PUBLIK:",
    `NUPTK=${await nuptkRows.count()} NIP=${await nipRows.count()} NIK=${await nikRows.count()}`
  );
  await expect(nuptkRows).toHaveCount(0);
  await expect(nipRows).toHaveCount(0);
  await expect(nikRows).toHaveCount(0);

  console.log("JS ERRORS:", errors.length);
  for (const e of errors) console.log(">>>", e.slice(0, 300));
  expect(errors).toHaveLength(0);
});
