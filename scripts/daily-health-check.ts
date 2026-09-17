/**
 * Daily health check — audit menyeluruh project sekali sehari.
 *
 * Tiga fase, satu ringkasan PASS/FAIL:
 *   1. Static — typecheck (`tsc --noEmit`) + unit test penuh (`vitest run`)
 *   2. Runtime — probe /api/health (termasuk cek DB) + rute publik utama
 *   3. Verdict — keluar dengan exit code 0 bila SEMUA lulus, 1 bila ada
 *      yang gagal (siap dipasang di cron/scheduler harian).
 *
 * Usage:
 *   bun run health:daily
 *
 * Environment:
 *   BASE_URL       — basis URL aplikasi untuk probe runtime
 *                    (default: http://localhost:3000; isi URL produksi
 *                    untuk audit harian terhadap situs live)
 *   HEALTH_TIMEOUT — timeout per-request ms (default: 10000)
 *   HEALTH_LOG_FILE — file log hasil harian
 *                    (default: ./logs/daily-health-check.log)
 */

import { spawnSync } from "node:child_process";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT ?? 10_000);
const LOG_FILE = process.env.HEALTH_LOG_FILE ?? "./logs/daily-health-check.log";

type SectionResult = { name: string; ok: boolean; detail: string };

const results: SectionResult[] = [];

/** Spawn perintah gate, kembalikan ok + baris ringkasan terakhir. */
function runGate(name: string, args: string[], timeoutMs: number): SectionResult {
  const started = Date.now();
  // Args literal bawaan skrip — digabung jadi satu string agar aman dari
  // DEP0190 (shell + array args) tanpa risiko apa pun.
  const proc = spawnSync(["bunx", ...args].join(" "), {
    shell: process.platform === "win32",
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (proc.error) {
    return { name, ok: false, detail: `gagal dijalankan: ${proc.error.message}` };
  }
  const output = `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`;
  const isNoise = (line: string) => /^\(Use `node --trace|^\(node:\d+\)/.test(line.trim());
  const tail =
    output.trim().split("\n").filter(Boolean).filter((l) => !isNoise(l)).slice(-1)[0] ??
    "(tanpa output)";
  const ok = proc.status === 0;
  return { name, ok, detail: ok ? `${tail} (${seconds}s)` : `${tail} (exit=${proc.status}, ${seconds}s)` };
}

/** Probe satu URL; ok bila status < 500 (rute publik harus 200). */
async function probe(url: string, expectOk = true): Promise<{ ok: boolean; detail: string }> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    const ms = Date.now() - started;
    const ok = expectOk ? res.ok : res.status < 500;
    return { ok, detail: `HTTP ${res.status} (${ms}ms)` };
  } catch (e) {
    const ms = Date.now() - started;
    return { ok: false, detail: `tidak terjangkau (${ms}ms): ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function probeRuntime(): Promise<void> {
  const routes = ["/", "/news", "/academic", "/gallery", "/contact", "/transparansi"];

  const health = await probe(`${BASE_URL}/api/health`);
  let healthDetail = health.detail;
  if (health.ok) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { cache: "no-store" });
      const data = (await res.json()) as {
        status?: string;
        checks?: Record<string, { ok: boolean }>;
      };
      const dbOk = data.checks?.database?.ok !== false;
      if (data.status !== "healthy" || !dbOk) {
        results.push({ name: "api/health", ok: false, detail: `status=${data.status ?? "?"} db=${dbOk ? "ok" : "FAIL"}` });
        healthDetail = "";
      }
    } catch {
      // detail JSON gagal dibaca — hasil HTTP di atas tetap dipakai
    }
  }
  if (healthDetail) results.push({ name: "api/health", ok: health.ok, detail: healthDetail });

  for (const route of routes) {
    const r = await probe(`${BASE_URL}${route}`);
    results.push({ name: `GET ${route}`, ok: r.ok, detail: r.detail });
  }
}

async function appendLog(verdict: string, passed: number, total: number): Promise<void> {
  try {
    const { appendFileSync, mkdirSync, existsSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const dir = dirname(LOG_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const lines = results.map((r) => `  ${r.ok ? "✓" : "✗"} ${r.name.padEnd(28)} ${r.detail}`);
    appendFileSync(
      LOG_FILE,
      `[${new Date().toISOString()}] DAILY ${verdict} (${passed}/${total})\n${lines.join("\n")}\n`,
    );
  } catch {
    // log file non-kritis — stdout adalah output utama
  }
}

async function main() {
  console.log("═══ Daily health check ═══\n");

  results.push(runGate("typecheck (tsc --noEmit)", ["tsc", "--noEmit"], 5 * 60_000));
  results.push(runGate("unit tests (vitest run)", ["vitest", "run"], 10 * 60_000));
  await probeRuntime();

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(28)} ${r.detail}`);
  }
  const verdict = passed === total ? "PASS" : "FAIL";
  console.log(`\nVERDICT: ${verdict} (${passed}/${total} lulus)`);

  await appendLog(verdict, passed, total);
  process.exit(passed === total ? 0 : 1);
}

main();
