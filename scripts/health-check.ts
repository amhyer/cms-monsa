/**
 * Health check script — untuk self-monitoring /api/health endpoint.
 *
 * Usage:
 *   bunx tsx scripts/health-check.ts
 *
 * Environment:
 *   HEALTH_URL — URL endpoint kesehatan (default: http://localhost:3000/api/health)
 *   HEALTH_TIMEOUT — Timeout dalam milidetik (default: 5000)
 *   HEALTH_LOG_FILE — File log opsional (default: ./logs/health-check.log)
 */

const HEALTH_URL = process.env.HEALTH_URL ?? "http://localhost:3000/api/health";
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT ?? 5000);
const LOG_FILE = process.env.HEALTH_LOG_FILE ?? "./logs/health-check.log";

interface HealthResponse {
  status: string;
  timestamp: string;
  checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }>;
}

async function checkHealth(): Promise<{
  ok: boolean;
  status: string;
  latencyMs: number;
  details: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(HEALTH_URL, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    const data: HealthResponse = await res.json();

    const status = data.status ?? "unknown";
    const ok = res.ok && status === "healthy";

    // Build detail string
    const parts: string[] = [`status=${status}`, `latency=${latencyMs}ms`];
    if (data.checks) {
      for (const [name, check] of Object.entries(data.checks)) {
        parts.push(`${name}=${check.ok ? "ok" : "fail"}${check.latencyMs != null ? `(${check.latencyMs}ms)` : ""}`);
      }
    }

    return { ok, status, latencyMs, details: parts.join(" ") };
  } catch (e) {
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      status: "unreachable",
      latencyMs,
      details: `error=${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function logEntry(entry: string) {
  const line = `[${new Date().toISOString()}] ${entry}\n`;
  process.stdout.write(line);

  // Optional: append to log file
  if (LOG_FILE) {
    try {
      const { appendFileSync, mkdirSync, existsSync } = await import("node:fs");
      const { dirname } = await import("node:path");
      const dir = dirname(LOG_FILE);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      appendFileSync(LOG_FILE, line);
    } catch {
      // non-critical — console output is primary
    }
  }
}

async function main() {
  const result = await checkHealth();
  const level = result.ok ? "OK" : "FAIL";
  await logEntry(`[HEALTH] ${level} ${result.details}`);

  // Exit code: 0 = healthy, 1 = unhealthy
  process.exit(result.ok ? 0 : 1);
}

main();
