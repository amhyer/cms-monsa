import { expect, type Page } from "@playwright/test";

/** Kredensial default hasil seed (lihat README "Default Credentials"). */
export const ADMIN = {
  email: "admin@mongisidi1.sch.id",
  password: "admin123",
};

export const OPERATOR = {
  email: "operator@mongisidi1.sch.id",
  password: "operator123",
};

export const GURU = {
  email: "guru@mongisidi1.sch.id",
  password: "guru123",
};

/** Login lewat /login lalu tunggu redirect ke /dashboard. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
}

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
