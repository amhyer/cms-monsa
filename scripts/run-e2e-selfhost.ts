/**
 * Orchestrator E2E self-host: compose up → assert → teardown.
 *
 * Satu perintah (`npm run e2e:selfhost`) yang menjalankan stack Docker
 * self-host (docker-compose.e2e.yml) secara end-to-end:
 *
 *   1. Preflight — Docker engine hidup, port 3100/55432 bebas, dan container
 *      produksi tidak sedang berjalan (stack E2E memakai image tag yang sama
 *      dengan produksi; container_name sudah dipisah di override E2E).
 *   2. Build image `cms-monsa:e2e` (lewati dengan E2E_SKIP_BUILD=1 — dipakai
 *      CI yang sudah membangun image dengan cache GHA).
 *   3. `compose up -d` project `monsa-e2e` (3 file compose) → poll app
 *      sehat (entrypoint container menjalankan `prisma migrate deploy`).
 *   4. Jalankan scripts/e2e-selfhost-assert.ts (seed + assert; ada sleep
 *      130 detik menunggu siklus cron per-menit, jadi total ~3 menit).
 *   5. Teardown `down -v` SELALU jalan (finally); bila assert gagal, log
 *      app + cron disalin ke direktori log sementara sebelum dihapus.
 *
 * Isolasi: project `monsa-e2e`, container `-e2e`, port 3100/55432 — tidak
 * pernah menyentuh stack produksi di host yang sama.
 */

import { execSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = "monsa-e2e";
const APP_URL = "http://127.0.0.1:3100";
const IMAGE = "cms-monsa:e2e";
const COMPOSE_BASE = `docker compose -p ${PROJECT} -f docker-compose.yml -f docker-compose.cron.yml -f docker-compose.e2e.yml`;
/** Env interpolasi compose — memenangkan nilai .env (REDIS_URL= penting:
 * .env dev bisa berisi Redis lokal yang tak ada di stack E2E). */
const COMPOSE_ENV = {
  ...process.env,
  REDIS_URL: "",
  POSTGRES_PASSWORD: "e2e-pass",
  CRON_SECRET: "e2e-cron-secret",
  // Base compose hard-require ${AUTH_SECRET:?} — di mesin dev tersembunyi oleh
  // .env, di CI tidak ada .env sehingga interpolasi gagal tanpa nilai eksplisit.
  AUTH_SECRET: "e2e-auth-secret-not-production",
} as NodeJS.ProcessEnv;

/** Container stack produksi — E2E menolak jalan bila salah satu aktif. */
const PROD_CONTAINERS = ["monsa-app", "monsa-postgres", "cms-monsa-cron"];

function step(msg: string) {
  console.log(`\n▶ ${msg}`);
}

function sh(cmd: string, opts: { quiet?: boolean; env?: NodeJS.ProcessEnv } = {}): string {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: opts.quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    env: opts.env ?? process.env,
  });
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

async function preflight() {
  step("Preflight — engine Docker, port bebas, tanpa stack produksi aktif");

  let engineOk = false;
  try {
    // Jangan pakai redirect shell (> /dev/null) — Windows cmd.exe tidak
    // punya /dev/null; quiet stdio di sh() sudah membuang output.
    sh("docker info", { quiet: true });
    engineOk = true;
  } catch {
    /* dianggap mati */
  }
  if (!engineOk) {
    throw new Error("::error::Docker engine tidak berjalan — hidupkan Docker Desktop/daemon dulu.");
  }

  let psOut = "";
  try {
    psOut = sh("docker ps --format '{{.Names}}'", { quiet: true });
  } catch {
    /* docker ps gagal = engine bermasalah; docker info di atas sudah lolos */
  }
  const running = new Set(psOut.split("\n").map((s) => s.trim()).filter(Boolean));
  const clash = PROD_CONTAINERS.filter((c) => running.has(c));
  if (clash.length > 0) {
    throw new Error(
      `::error::Container produksi sedang berjalan (${clash.join(", ")}) — ` +
        `hentikan dulu; E2E memakai image tag yang sama dengan stack produksi.`
    );
  }

  for (const port of [3100, 55432]) {
    if (!(await isPortFree(port))) {
      throw new Error(`::error::Port ${port} sedang dipakai — kosongkan sebelum menjalankan E2E.`);
    }
  }
}

async function waitHealthy(timeoutMs = 180_000) {
  step("Menunggu app sehat (entrypoint: migrate deploy → listen)");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP_URL}/api/health`);
      if (res.ok) {
        const body = (await res.json()) as { status?: string };
        if (body.status === "healthy") {
          console.log("App healthy.");
          return;
        }
      }
    } catch {
      /* belum listen — coba lagi */
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`::error::App tidak healthy dalam ${timeoutMs / 1000} detik.`);
}

function dumpLogs(dir: string) {
  for (const [name, container] of [
    ["app", "monsa-app-e2e"],
    ["cron", "monsa-cron-e2e"],
    ["postgres", "monsa-postgres-e2e"],
  ] as const) {
    try {
      const logs = sh(`docker logs ${container} 2>&1`, { quiet: true });
      writeFileSync(join(dir, `${name}.log`), logs);
    } catch {
      /* container mungkin tak sempat dibuat */
    }
  }
}

async function main() {
  await preflight();

  if (process.env.E2E_SKIP_BUILD === "1") {
    step(`Build image dilewati (E2E_SKIP_BUILD=1, memakai ${IMAGE} yang ada)`);
  } else {
    step(`Build image ${IMAGE}`);
    sh(`${COMPOSE_BASE} build app`, { env: COMPOSE_ENV });
  }

  step("Compose up (project monsa-e2e, port 3100/55432, cron per-menit)");
  sh(`${COMPOSE_BASE} up -d`, { env: COMPOSE_ENV });

  const logDir = join(tmpdir(), `e2e-selfhost-${Date.now()}`);
  let assertStatus = 1;
  try {
    await waitHealthy();

    step("Menjalankan assertions (seed + cron end-to-end, ~3 menit)");
    execSync("bunx tsx scripts/e2e-selfhost-assert.ts", {
      stdio: "inherit",
      env: COMPOSE_ENV,
    });
    assertStatus = 0;
  } catch (e) {
    mkdirSync(logDir, { recursive: true });
    dumpLogs(logDir);
    console.error(
      `\n::error::E2E self-host gagal. Log container disalin ke ${logDir} ` +
        `(stack diteardown di bawah).`
    );
    throw e;
  } finally {
    step("Teardown — compose down -v (volume E2E ikut dihapus)");
    try {
      dumpLogs(logDir);
      console.log(`Log container tersimpan di ${logDir}`);
    } catch {
      /* dumpLogs best-effort */
    }
    try {
      sh(`${COMPOSE_BASE} down -v --remove-orphans`, { env: COMPOSE_ENV, quiet: true });
    } catch {
      // fallback: satu upaya lagi (network/volume yatim kadang menggagalkan
      // pemanggilan pertama) — kegagalan kedua dibiarkan terlihat di CI.
      sh(`docker compose -p ${PROJECT} down -v --remove-orphans`, { env: COMPOSE_ENV, quiet: false });
    }
  }

  process.exit(assertStatus);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
