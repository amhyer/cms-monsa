import type { FullConfig } from "@playwright/test";
import {
  DEFAULT_API_DIR,
  WARMUP_ROUTES,
  buildWarmupRoutes,
  waitForServer,
  warmRoutes,
} from "./warmup";

/**
 * Pre-warm rute utama sebelum suite berjalan (jalur default Playwright).
 *
 * Global setup berjalan setelah webServer siap, jadi cukup fetch tiap rute
 * sekali untuk memicu kompilasi Turbopack. Logika pemanasan dibagi dengan
 * workflow `test:e2e` (scripts/run-e2e.ts) via e2e/warmup.ts — satu sumber
 * kebenaran untuk daftar rute dan perilaku polling.
 *
 * Selain daftar default, rute tambahan yang dideklarasikan tiap spec file
 * lewat pragma `// warmup: /api/...` ikut dipanaskan (dibaca statis — lihat
 * collectSpecWarmupRoutes).
 *
 * baseURL dibaca dari config (bukan hardcode) agar ikut port override apa pun.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const log = (m: string) => console.log(`[warmup] ${m}`);

  const up = await waitForServer(baseURL, { log });
  if (!up) {
    log(`⚠️  server belum merespons di ${baseURL} — lanjut tanpa pemanasan.`);
    return;
  }

  const { routes, synthetic, declared, apiRoutes } = await buildWarmupRoutes({
    testDir: config.testDir ?? "./e2e",
    apiDir: process.env.E2E_API_DIR ?? DEFAULT_API_DIR,
  });
  log(
    `server siap di ${baseURL} — memanaskan ${routes.length} rute ` +
      `(default ${WARMUP_ROUTES.length} · spec ${declared.length} · ` +
      `API ${apiRoutes.length} · dinamis ${synthetic.size})...`
  );
  await warmRoutes(baseURL, { log, routes, synthetic });
  log("selesai.");
}
