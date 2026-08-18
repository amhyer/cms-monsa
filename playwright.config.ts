import { defineConfig, devices } from "@playwright/test";

// baseURL & perintah server bisa di-override lewat env agar suite bisa
// dijalankan paralel di port scratch (mis. verifikasi di :3200) atau di CI.
// Workflow `test:e2e` (scripts/run-e2e.ts) menetapkan keduanya otomatis.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const serverCommand = process.env.E2E_SERVER_CMD ?? "bun run dev";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  // 90s per test: hit pertama pada route yang baru dikompilasi (cold compile
  // Turbopack) bisa melebihi timeout default 30s → hindari flaky first attempt.
  timeout: 90_000,
  // Asersi (mis. toast setelah mutasi API) diberi 15s: route handler yang baru
  // dikompilasi Turbopack bisa menahan request >5s (default timeout asersi),
  // contoh nyata: DELETE /api/news pertama 5.3s → toast "Berita dihapus."
  // muncul setelah asersi 5s timeout. 15s cukup, tetap gagal cepat.
  expect: { timeout: 15_000 },
  // Pre-warm rute utama sebelum suite (hindari cold compile di test pertama).
  globalSetup: "./e2e/global-setup.ts",
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: serverCommand,
    url: baseURL,
    // Workflow test:e2e sudah menjamin server naik dan menandainya lewat
    // PW_REUSE_SERVER agar Playwright tidak memulai server duplikat.
    reuseExistingServer: !!process.env.PW_REUSE_SERVER || !process.env.CI,
    timeout: 120000,
  },
});
