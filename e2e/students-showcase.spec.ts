import { test, expect } from "@playwright/test";

// Regression untuk Galeri Siswa di beranda (fitur Students Showcase):
// marquee foto, pencarian nama, dan filter kelas.
test.describe("Galeri Siswa — beranda", () => {
  // Section Galeri Siswa pada halaman beranda.
  const gallery = (page: import("@playwright/test").Page) =>
    page.locator("section").filter({
      has: page.getByRole("heading", { name: "Galeri Siswa" }),
    });

  test("marquee foto tampil beserta pencarian & filter kelas", async ({
    page,
  }) => {
    await page.goto("/");
    const section = gallery(page);

    await expect(
      section.getByRole("heading", { name: "Galeri Siswa" })
    ).toBeVisible();
    await expect(
      section.getByRole("searchbox", { name: "Cari nama siswa" })
    ).toBeVisible();
    await expect(
      section.getByRole("combobox", { name: "Filter kelas" })
    ).toBeVisible();

    // Marquee: minimal satu siswa berfoto (img src http + alt = nama siswa).
    await expect(section.locator("img[src^='http']").first()).toBeVisible();
    await expect(section).toContainText("Menampilkan");
  });

  test("pencarian nama menampilkan siswa yang dicari", async ({ page }) => {
    await page.goto("/");
    const section = gallery(page);

    // Ambil nama siswa berfoto pertama di marquee, lalu cari kata pertamanya.
    const photoImg = section.locator("img[src^='http']").first();
    await expect(photoImg).toBeVisible();
    const fullName = await photoImg.getAttribute("alt");
    expect(fullName).toBeTruthy();

    const firstWord = fullName!.split(" ")[0];
    await section
      .getByRole("searchbox", { name: "Cari nama siswa" })
      .fill(firstWord);

    // Mode pencarian: kartu hasil berisi nama lengkap siswa tersebut.
    await expect(section.getByText(fullName!, { exact: true })).toBeVisible();
  });

  test("klik Jeda menghentikan animasi marquee dan aria-pressed berubah", async ({
    page,
  }) => {
    await page.goto("/");
    const section = gallery(page);
    await expect(section).toContainText("Menampilkan");

    const pauseBtn = section.getByRole("button", { name: "Jeda animasi" });
    await expect(pauseBtn).toBeVisible();

    // Track marquee siswa (satu-satunya .animate-marquee di dalam section).
    const track = section.locator(".animate-marquee");
    const playState = () =>
      track.evaluate((el) => getComputedStyle(el).animationPlayState);

    // Baseline: animasi berjalan.
    await expect.poll(playState).toBe("running");

    // Klik Jeda → animasi berhenti & state toggle (aria-pressed, label).
    await pauseBtn.click();
    await expect.poll(playState).toBe("paused");
    await expect(
      section.getByRole("button", { name: "Putar animasi", pressed: true })
    ).toBeVisible();

    // Klik Putar → animasi jalan lagi & state kembali.
    await section.getByRole("button", { name: "Putar animasi" }).click();
    await expect.poll(playState).toBe("running");
    await expect(
      section.getByRole("button", { name: "Jeda animasi", pressed: false })
    ).toBeVisible();
  });

  test("filter kelas menampilkan siswa kelas terpilih", async ({ page }) => {
    await page.goto("/");
    const section = gallery(page);

    // Nama + kelas siswa berfoto pertama dari kartu marquee.
    const photoImg = section.locator("img[src^='http']").first();
    await expect(photoImg).toBeVisible();
    const fullName = await photoImg.getAttribute("alt");
    expect(fullName).toBeTruthy();
    const card = photoImg.locator("..");
    const className = (await card.locator("p").nth(1).textContent())?.trim();
    expect(className).toBeTruthy();

    // Pilih opsi filter yang diawali nama kelas siswa tersebut.
    const filter = section.getByRole("combobox", { name: "Filter kelas" });
    const labels = await section.locator("option").allTextContents();
    const target = labels.find((l) => l.trim().startsWith(className!));
    expect(target).toBeTruthy();
    await filter.selectOption({ label: target! });

    // Hasil: siswa tetap tampil, dan kartu hasil menunjukkan kelas yang sama.
    await expect(section.getByText(fullName!, { exact: true })).toBeVisible();
    await expect(
      section.getByText(className!, { exact: true }).first()
    ).toBeVisible();
  });
});
