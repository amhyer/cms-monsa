import { test, expect } from "@playwright/test";

test("academic page: directory, kalender, dan halaman portofolio guru", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("http://localhost:3000/academic", { waitUntil: "networkidle" });

  await expect(page.getByText("Direktori Guru & Staf")).toBeVisible();

  // Kartu guru sekarang <Link> ke /academic/guru/:id (bukan button modal).
  const guruCards = page.locator('a[href^="/academic/guru/"]', {
    hasText: "Lihat profil lengkap",
  });
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

  // Klik kartu pertama -> halaman portofolio guru (bukan modal profil).
  await guruCards.first().click();
  await page.waitForURL("**/academic/guru/**");
  await expect(
    page.getByRole("heading", { name: "Profil Guru & Staf" })
  ).toBeVisible();
  await expect(page.getByText("Data Diri")).toBeVisible();
  await expect(page.getByText("Mengajar")).toBeVisible();
  const nuptkValue = await page
    .locator("dt", { hasText: "NUPTK" })
    .locator("xpath=following-sibling::dd")
    .first()
    .textContent();
  console.log("NUPTK di portofolio:", nuptkValue);
  expect(nuptkValue).toMatch(/^\d{10,}$/);

  console.log("JS ERRORS:", errors.length);
  for (const e of errors) console.log(">>>", e.slice(0, 300));
  expect(errors).toHaveLength(0);
});
