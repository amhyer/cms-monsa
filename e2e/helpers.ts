import { expect, type Page } from "@playwright/test";

/** Nyalakan dark mode lewat toggle sungguhan, lalu tunggu `.dark` terpasang. */
export async function enableDarkMode(page: Page) {
  await page.getByRole("button", { name: "Aktifkan mode gelap" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark"))
    )
    .toBe(true);
}

/**
 * Referensi warna emas pada tema berjalan: probe elemen ber-kelas `bg-gold`
 * lalu baca computed backgroundColor (format sama dengan elemen lain).
 */
export function goldRef(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "bg-gold";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
}
