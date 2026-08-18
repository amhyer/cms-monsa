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
    page.getByRole("heading", { name: "Agustus 2026" })
  ).toBeVisible();

  // Klik kartu pertama → MODAL profil (bio/kontak, tanpa NUPTK/NIP/NIK).
  await guruCards.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading").first()).toBeVisible();
  // Kartu pertama (order 0) = Kepala Sekolah — membawa riwayat + email seed.
  await expect(dialog.getByText(/Nawawi Hamzah/)).toBeVisible();
  await expect(dialog.getByText(/Memimpin SDN Unggulan Mongisidi 1/)).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "kepala.sekolah@mongisidi1.sch.id" })
  ).toHaveAttribute("href", "mailto:kepala.sekolah@mongisidi1.sch.id");
  // Identitas tidak boleh bocor di modal publik.
  await expect(dialog.getByText(/NUPTK|NIP|NIK/, { exact: false })).toHaveCount(0);

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
