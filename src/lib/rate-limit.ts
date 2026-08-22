import { redis } from "./redis";
import { logger } from "@/lib/logger";

/**
 * Minimal structural request type — works with Next.js web `Request`
 * (`headers` is a standard `Headers` instance) and plain test objects.
 */
export interface RequestLike {
  headers: Headers | Record<string, string | string[] | undefined>;
}

function getHeader(req: RequestLike, name: string): string | undefined {
  const h = req.headers;
  if (typeof h.get === "function") {
    return h.get(name) || undefined;
  }
  const v = (h as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? v[0] : v;
}

const WINDOW = 15 * 60 * 1000; // 15 menit
const MAX_FAILURES = 5;
const LOCK_DURATION = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 20;

// Fallback jika Redis tidak tersedia
const store = new Map<string, { failures: number; lockedUntil: number }>();
const ipStore = new Map<string, { failures: number; lockedUntil: number }>();
const formStore = new Map<string, { count: number; windowStart: number }>();
const getStore = new Map<string, { count: number; windowStart: number }>();

function key(email: string, ip: string) {
  return `login-limit:${email.toLowerCase()}::${ip}`;
}

function ipKey(ip: string) {
  return `ip-limit:${ip}`;
}

function formKey(ip: string) {
  return `form-limit:${ip}`;
}

export function getClientIp(req: RequestLike): string {
  const real = getHeader(req, "x-real-ip");
  if (real) return real;
  const xff = getHeader(req, "x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

// --- Login Rate Limiter ---

export async function isLocked(email: string, ip: string): Promise<boolean> {
  if (!redis) {
    const rec = store.get(key(email, ip));
    return rec ? Date.now() < rec.lockedUntil : false;
  }
  const lockedUntil = await redis.get(key(email, ip) + ":lock");
  return lockedUntil ? Date.now() < parseInt(lockedUntil, 10) : false;
}

export async function lockSecondsRemaining(email: string, ip: string): Promise<number> {
    if (!redis) {
        const rec = store.get(key(email, ip));
        if (!rec) return 0;
        const remaining = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
    }
    const lockedUntil = await redis.get(key(email, ip) + ":lock");
    if (!lockedUntil) return 0;
    const remaining = Math.ceil((parseInt(lockedUntil, 10) - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
}


export async function recordFailure(email: string, ip: string): Promise<void> {
  const k = key(email, ip);
  const ik = ipKey(ip);
  const now = Date.now();

  if (!redis) {
    // Fallback to in-memory
    const rec = store.get(k) || { failures: 0, lockedUntil: 0 };
    rec.failures += 1;
    if (rec.failures >= MAX_FAILURES) {
      rec.lockedUntil = now + LOCK_DURATION;
    }
    store.set(k, rec);

    const ipRec = ipStore.get(ik) || { failures: 0, lockedUntil: 0 };
    ipRec.failures += 1;
    if (ipRec.failures >= IP_MAX_ATTEMPTS) {
      ipRec.lockedUntil = now + LOCK_DURATION;
    }
    ipStore.set(ik, ipRec);
    return;
  }

  // Redis implementation
  const multi = redis.multi();
  multi.incr(k);
  multi.incr(ik);

  const [failures, ipFailures] = (await multi.exec()) as [[null, number], [null, number]];

  if (failures[1] === 1) {
    await redis.expire(k, WINDOW / 1000);
  }
  if (ipFailures[1] === 1) {
    await redis.expire(ik, WINDOW / 1000);
  }

  if (failures[1] >= MAX_FAILURES) {
    await redis.set(k + ":lock", now + LOCK_DURATION, "PX", LOCK_DURATION);
  }
  if (ipFailures[1] >= IP_MAX_ATTEMPTS) {
    await redis.set(ik + ":lock", now + LOCK_DURATION, "PX", LOCK_DURATION);
  }
}

export async function isIpLocked(ip: string): Promise<boolean> {
  if (!redis) {
    const rec = ipStore.get(ipKey(ip));
    return rec ? Date.now() < rec.lockedUntil : false;
  }
  const lockedUntil = await redis.get(ipKey(ip) + ":lock");
  return lockedUntil ? Date.now() < parseInt(lockedUntil, 10) : false;
}

export async function clearFailures(email: string, ip: string): Promise<void> {
  if (!redis) {
    store.delete(key(email, ip));
    return;
  }
  await redis.del(key(email, ip));
}

// --- Public Form Rate Limiter ---

export async function isFormRateLimited(ip: string, max = 20, windowMs = 600000): Promise<boolean> {
  const k = formKey(ip);
  if (!redis) {
    // Fallback to in-memory
    const now = Date.now();
    const rec = formStore.get(k);
    if (!rec || now - rec.windowStart >= windowMs) {
      formStore.set(k, { count: 1, windowStart: now });
      return false;
    }
    rec.count += 1;
    return rec.count > max;
  }

  const count = await redis.incr(k);
  if (count === 1) {
    await redis.pexpire(k, windowMs);
  }
  return count > max;
}

export async function rateLimitPublicForm(req: RequestLike, max?: number, windowMs?: number): Promise<Response | null> {
    const ip = getClientIp(req);
    if (await isFormRateLimited(ip, max, windowMs)) {
        return Response.json(
            { error: "Terlalu banyak permintaan. Silakan coba lagi beberapa saat." },
            { status: 429, headers: { "Retry-After": String(Math.ceil((windowMs ?? 600000) / 1000)) } }
        );
    }
    return null;
}

// --- Public GET Rate Limiter ---

export async function isGetRateLimited(ip: string, max = 30, windowMs = 60000): Promise<boolean> {
  const k = `get-limit:${ip}`;
  if (!redis) {
    const now = Date.now();
    const rec = getStore.get(k);
    if (!rec || now - rec.windowStart >= windowMs) {
      getStore.set(k, { count: 1, windowStart: now });
      return false;
    }
    rec.count += 1;
    return rec.count > max;
  }

  const count = await redis.incr(k);
  if (count === 1) {
    await redis.pexpire(k, windowMs);
  }
  return count > max;
}

export async function rateLimitPublicGet(req: RequestLike, max?: number, windowMs?: number): Promise<Response | null> {
  const ip = getClientIp(req);
  if (await isGetRateLimited(ip, max, windowMs)) {
    // Scraper detection: warn when a single IP hits 100+ req/min on public endpoints.
    const effectiveMax = max ?? 30;
    if (effectiveMax <= 100) {
      logger.warn(
        { ip, max: effectiveMax, userAgent: getHeader(req, 'user-agent') ?? 'unknown' },
        "[rate-limit] SCRAPER DETECTED: exceeded public GET limit"
      );
    }
    return Response.json(
      { error: "Terlalu banyak permintaan. Silakan coba lagi beberapa saat." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((windowMs ?? 60000) / 1000)) } }
    );
  }
  return null;
}
