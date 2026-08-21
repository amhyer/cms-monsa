import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const ts = new Date().toISOString();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // --- Database check ---
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.db = { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    checks.db = { ok: false, error: String(e) };
  }

  // --- Redis check (only if REDIS_URL is configured) ---
  if (process.env.REDIS_URL) {
    try {
      const t0 = Date.now();
      // Dynamic import to avoid hard dep when Redis is not configured.
      const { default: Redis } = await import("ioredis");
      const client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await client.ping();
      await client.quit();
      checks.redis = { ok: true, latencyMs: Date.now() - t0 };
    } catch (e) {
      checks.redis = { ok: false, error: String(e) };
    }
  } else {
    checks.redis = { ok: true, error: "not configured (in-memory fallback)" };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: ts,
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
