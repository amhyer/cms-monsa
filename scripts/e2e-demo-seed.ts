/**
 * test:e2e:demo — seed demo + seed E2E sebelum suite Playwright.
 *
 * Suite E2E memerlukan akun `@mongisidi1.sch.id` (e2e/helpers.ts) yang hanya
 * dibuat `prisma/seed-e2e.ts`; skrip ini juga menjalankan seed demo agar
 * suite terverifikasi pada coexistence demo×e2e — kondisi yang paling sering
 * membedakan dev lokal dari CI (lihat commit "test: buat 4 spec e2e mandiri
 * dari state DB & abaikan log server basi").
 *
 * Kedua seed idempoten (upsert), aman dijalankan ulang. Seed E2E sudah punya
 * pengaman: wajib E2E_SEED=1, menolak DATABASE_URL Neon.
 *
 * Env vars:
 *   CI_SKIP_DEMO_SEED=1  — skip seed demo (prisma/seed.ts) untuk
 *     mengurangi memory pressure di CI; hanya seed E2E yang dijalankan.
 *     Berguna untuk workflow yang tidak butuh coexistence (mis. playwright.yml
 *     yang hanya butuh akun e2e). Workflow coexistence TIDAK memakai flag ini
 *     karena tujuannya menguji koeksistensi data demo × e2e.
 *
 * Pemakaian:
 *   bun run test:e2e:demo [args playwright...]
 *   bun run test:e2e:demo dapodik-config-cf-access.spec.ts
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const tsx = process.platform === "win32" ? "bunx.cmd" : "bunx";
// Windows menolak spawn .cmd tanpa shell (Node ≥18.20, EINVAL) → wajib
// shell:true di win32. Aman di sini: argumen hanya path relatif tanpa spasi.
const spawnShell = process.platform === "win32";

function runSeed(script: string, env: NodeJS.ProcessEnv): void {
  console.log(`[e2e:demo] ▶ bunx tsx ${script} ...`);
  const res = spawnSync(tsx, ["tsx", script], {
    stdio: ["ignore", "pipe", "pipe"],
    env,
    cwd: process.cwd(),
    shell: spawnShell,
  });
  const out = `${res.stdout?.toString() ?? ""}${res.stderr?.toString() ?? ""}`;
  console.log(out.trimEnd());
  if (res.error || res.status !== 0) {
    throw new Error(
      `seed gagal: ${script} (exit ${res.status ?? "-"}${res.error ? `: ${res.error.message}` : ""})`
    );
  }
}

async function main(): Promise<void> {
  // seed.ts tidak punya guard env (sama seperti `bun run db:seed`);
  // seed-e2e wajib E2E_SEED=1 (pengaman bawaannya).
  const skipDemoSeed = process.env.CI_SKIP_DEMO_SEED === "1";
  if (skipDemoSeed) {
    console.log("[e2e:demo] ⏭ CI_SKIP_DEMO_SEED=1 — skip seed demo, jalankan seed E2E saja.");
  } else {
    runSeed(join("prisma", "seed.ts"), process.env);
  }
  runSeed(join("prisma", "seed-e2e.ts"), { ...process.env, E2E_SEED: "1" });

  // Delegasikan ke run-e2e-local (env E2E_SERVER_LOG dsb. diset di sana);
  // stdin diwarisi agar mode interaktif Playwright tetap bisa dipakai.
  const res = spawnSync(
    tsx,
    ["tsx", join("scripts", "run-e2e-local.ts"), ...process.argv.slice(2)],
    { stdio: "inherit", shell: spawnShell }
  );
  process.exit(res.status ?? 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
