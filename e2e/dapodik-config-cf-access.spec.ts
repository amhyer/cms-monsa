import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";
import type { Page } from "@playwright/test";

// warmup: /api/dapodik/config /api/auth/login

/**
 * Alur simpan konfigurasi Dapodik dengan field CF Access.
 *
 * Kontrak inti yang diuji (protokol write-only):
 *   1. Secret diisi → tersimpan terenkripsi; UI hanya melihat mask.
 *   2. Secret kosong saat simpan → secret tersimpan DIPERTAHANKAN (bukan
 *      ter-wipe — regresi bug anti-wipe).
 *   3. Secret diisi lagi → rotasi; field kembali kosong setelah simpan.
 *   4. Client ID dikosongkan → dihapus, tanpa mempengaruhi secret.
 *
 * Config Dapodik adalah singleton DB yang juga dipakai sinkronisasi nyata.
 * Suite ini memotretnya di test pertama (via API dengan cookie sesi UI) dan
 * memulihkan npsn/host/port/protocol/cfAccessClientId di afterEach. Token dan
 * secret TIDAK bisa dipulihkan lewat API (write-only, tidak pernah dikirim
 * balik) — nilai sisa dari test ini hanya ada di DB e2e sekali pakai.
 */

const CF_CLIENT_ID = "e2e-cf.access.example";
const CF_SECRET_A = "e2e-secret-AAA-123";
const CF_SECRET_B = "e2e-secret-BBB-456";
const MASKED_HINT = /Secret tersimpan:/;

async function openConfig(page: Page) {
  await page.goto("/dashboard/dapodik");
  await page.getByRole("button", { name: "Konfigurasi", exact: true }).click();
  await expect(page.getByLabel("NPSN")).toBeVisible();
}

async function getConfigViaApi(page: Page): Promise<Record<string, unknown> | null> {
  const res = await page.request.get("/api/dapodik/config");
  if (!res.ok()) return null;
  const json = await res.json();
  return (json.config as Record<string, unknown> | null) ?? null;
}

test.describe("Dapodik config — CF Access", () => {
  let snapshot: Record<string, unknown> | null = null;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    // Potret sekali (test pertama) untuk dipulihkan setelah suite.
    if (snapshot === null) {
      snapshot = await getConfigViaApi(page);
    }
  });

  test.afterEach(async ({ page }) => {
    if (!snapshot) return;
    await page.request.post("/api/dapodik/config", {
      data: {
        npsn: String(snapshot.npsn ?? ""),
        host: String(snapshot.host ?? "localhost"),
        port: Number(snapshot.port ?? 5774),
        protocol: String(snapshot.protocol ?? "http"),
        cfAccessClientId: snapshot.cfAccessClientId
          ? String(snapshot.cfAccessClientId)
          : "", // dikirim kosong → hapus (bukan fallback)
        // token & cfAccessClientSecret tidak dikirim → dipertahankan.
      },
    });
  });

  test("field CF Access tampil; secret tersimpan hanya sebagai mask", async ({ page }) => {
    await openConfig(page);
    await page.getByLabel("NPSN").fill("40313912");
    await page.getByLabel("Token").fill("e2e-token-1");
    await page.getByLabel("CF Access Client ID").fill(CF_CLIENT_ID);
    await page.getByLabel("CF Access Client Secret").fill(CF_SECRET_A);
    await page.getByRole("button", { name: "Simpan Konfigurasi" }).click();
    await expect(page.getByText("Konfigurasi tersimpan!")).toBeVisible();

    // Buka ulang: secret write-only (field kosong), Client ID tampil penuh,
    // dan hint mask "Secret tersimpan: xxxx****yyyy" terlihat.
    await openConfig(page);
    await expect(page.getByLabel("CF Access Client ID")).toHaveValue(CF_CLIENT_ID);
    await expect(page.getByLabel("CF Access Client Secret")).toHaveValue("");
    await expect(page.getByText(MASKED_HINT)).toBeVisible();
    // Secret asli tidak pernah dikirim balik ke browser.
    await expect(page.getByText(CF_SECRET_A)).toHaveCount(0);
  });

  test("secret kosong saat simpan → dipertahankan; mengisi field → rotasi", async ({ page }) => {
    // Prasyarat: secret A tersimpan oleh test sebelumnya (suite berurutan,
    // workers: 1). Test ini tetap mandiri bila dijalankan sendirian —
    // langsung buat secret A dulu bila belum ada.
    await openConfig(page);
    if ((await page.getByText(MASKED_HINT).count()) === 0) {
      await page.getByLabel("CF Access Client ID").fill(CF_CLIENT_ID);
      await page.getByLabel("CF Access Client Secret").fill(CF_SECRET_A);
      await page.getByRole("button", { name: "Simpan Konfigurasi" }).click();
      await expect(page.getByText("Konfigurasi tersimpan!")).toBeVisible();
      await openConfig(page);
    }

    // --- Anti-wipe: ubah host saja, secret dibiarkan kosong ---
    await page.getByLabel("Host").fill("10.0.0.5");
    await page.getByRole("button", { name: "Simpan Konfigurasi" }).click();
    await expect(page.getByText("Konfigurasi tersimpan!")).toBeVisible();

    // Buka ulang: hint mask masih ada → secret TIDAK ter-wipe oleh simpanan
    // tanpa secret (regresi utama yang diperbaiki).
    await openConfig(page);
    await expect(page.getByLabel("CF Access Client ID")).toHaveValue(CF_CLIENT_ID);
    await expect(page.getByText(MASKED_HINT)).toBeVisible();

    // --- Rotasi: isi secret B → tersimpan, field kembali kosong ---
    await page.getByLabel("CF Access Client Secret").fill(CF_SECRET_B);
    await page.getByRole("button", { name: "Simpan Konfigurasi" }).click();
    await expect(page.getByText("Konfigurasi tersimpan!")).toBeVisible();

    await openConfig(page);
    await expect(page.getByLabel("CF Access Client Secret")).toHaveValue("");
    await expect(page.getByText(MASKED_HINT)).toBeVisible();
    await expect(page.getByText(CF_SECRET_B)).toHaveCount(0);
  });

  test("Client ID dikosongkan → dihapus setelah simpan; secret tetap ada", async ({ page }) => {
    await openConfig(page);
    await page.getByLabel("CF Access Client ID").fill("");
    await page.getByRole("button", { name: "Simpan Konfigurasi" }).click();
    await expect(page.getByText("Konfigurasi tersimpan!")).toBeVisible();

    // Client ID benar-benar dihapus, secret tidak ikut terhapus (mask tetap).
    await openConfig(page);
    await expect(page.getByLabel("CF Access Client ID")).toHaveValue("");
    await expect(page.getByText(MASKED_HINT)).toBeVisible();
  });
});
