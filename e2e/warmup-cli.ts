/**
 * CLI pemanasan rute: `bun run e2e:warmup`.
 *
 * Berdiri sendiri (bukan bagian dari modul e2e/warmup.ts) karena file yang
 * di-import Playwright tidak boleh mengandung pola khusus entry (import.meta /
 * top-level await) — transform CJS Playwright menolaknya.
 *
 * Base URL: E2E_BASE_URL menang; tanpa itu, port dibaca otomatis dari
 *   .zscripts/dev.pid + .zscripts/dev.port (ditulis .zscripts/dev.sh) bila PID
 *   masih hidup; fallback http://localhost:3000.
 * Flag: --if-up — probe sekali; bila server tidak berjalan, SKIP dengan exit 0
 *   (untuk pre-commit hook: pemanasan tidak boleh memblokir commit). Tanpa
 *   flag, polling sampai server naik (maks ~120s) lalu exit 1 bila tidak.
 *
 * Bila ada rute yang GAGAL dipanaskan (✗), CLI men-tail log server developer
 * (E2E_SERVER_LOG → .zscripts/dev.log — fallback yang sama dengan wrapper
 * test:e2e di reuse mode) agar penyebabnya langsung terlihat. Exit code
 * tetap 0: pemanasan tidak boleh memblokir commit.
 */
import {
  DEFAULT_API_DIR,
  DEFAULT_E2E_TEST_DIR,
  WARMUP_ROUTES,
  buildWarmupRoutes,
  resolveDevBaseURL,
  tailDeveloperServerLog,
  waitForServer,
  warmRoutes,
} from "./warmup";

async function cliMain(): Promise<void> {
  const resolved = resolveDevBaseURL();
  const baseURL = resolved.url;
  const log = (m: string) => console.log(`[warmup] ${m}`);
  const ifUp = process.argv.includes("--if-up");

  if (resolved.source === "pidfile") {
    log(`port dev server terdeteksi dari .zscripts/dev.pid/.port -> ${baseURL}`);
  } else if (resolved.source === "default") {
    log(`tidak ada pidfile dev server — memakai default ${baseURL}`);
  }

  if (ifUp) {
    // Probe sekali (~3s) — jangan menunggu 120s di hook pre-commit.
    let up = false;
    try {
      const res = await fetch(`${baseURL}/`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
      void res;
      up = true;
    } catch {
      up = false;
    }
    if (!up) {
      log(`server tidak berjalan di ${baseURL} — dilewati (--if-up).`);
      process.exit(0);
    }
  } else if (!(await waitForServer(baseURL, { log }))) {
    log(`server tidak merespons di ${baseURL} — tidak ada rute yang dipanaskan.`);
    process.exit(1);
  }
  const { routes, synthetic, declared, apiRoutes } = await buildWarmupRoutes({
    testDir: process.env.E2E_TEST_DIR ?? DEFAULT_E2E_TEST_DIR,
    apiDir: process.env.E2E_API_DIR ?? DEFAULT_API_DIR,
  });
  log(
    `server siap di ${baseURL} — memanaskan ${routes.length} rute ` +
      `(default ${WARMUP_ROUTES.length} · spec ${declared.length} · ` +
      `API ${apiRoutes.length} · dinamis ${synthetic.size})...`
  );
  const failed = await warmRoutes(baseURL, { log, routes, synthetic });
  if (failed > 0) {
    const tail = await tailDeveloperServerLog();
    if (tail) {
      const src =
        tail.source === "dev.log" ? ".zscripts/dev.log" : "E2E_SERVER_LOG";
      log(
        `⚠️  ${failed} rute gagal dipanaskan — tail log server (${src}):`
      );
      for (const line of tail.text.split("\n")) log(line);
    } else {
      log(
        `⚠️  ${failed} rute gagal dipanaskan — tidak ada log server yang bisa ` +
          `ditail (set E2E_SERVER_LOG ke log dev server atau pakai .zscripts/dev.log).`
      );
    }
  }
  log("selesai.");
}

void cliMain();
