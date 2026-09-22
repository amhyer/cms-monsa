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

/**
 * H1 audit fix — batas kepercayaan proxy.
 *
 * Header `X-Real-IP`/`X-Forwarded-For` HANYA boleh dipercaya bila aplikasi
 * berada di belakang reverse proxy yang MENIMPA header tersebut dengan IP
 * riil (Caddy kita melakukan ini via `header_up`). Tanpa `TRUST_PROXY=true`,
 * header forwarding dari klien diabaikan sepenuhnya — kalau tidak, siapa pun
 * yang bisa mengakses port aplikasi secara langsung dapat memalsukan IP untuk
 * melewati rate limit login (credential stuffing) atau memicu lockout akun
 * orang lain.
 *
 * docker-compose.yml menyetel default `TRUST_PROXY=true` karena deployment
 * self-host selalu di belakang Caddy. Non-set / nilai lain = tidak percaya.
 */
export function isProxyTrusted(): boolean {
  return process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
}

let warnedUntrustedHeaders = false;

export function getClientIp(req: RequestLike): string {
  if (!isProxyTrusted()) {
    if (
      !warnedUntrustedHeaders &&
      (getHeader(req, "x-real-ip") || getHeader(req, "x-forwarded-for"))
    ) {
      warnedUntrustedHeaders = true;
      logger.warn(
        "[rate-limit] header forwarding diterima tapi TRUST_PROXY tidak diset — IP diabaikan 'unknown'. Set TRUST_PROXY=true hanya di belakang reverse proxy yang menimpa header."
      );
    }
    return "unknown";
  }
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

// --- Authenticated Mutation Rate Limiter ---

const mutationStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Pembatas untuk request mutation ter-autentikasi (POST/PUT/PATCH/DELETE).
 * Dipasang di `requireCsrf` (choke point bersama semua route mutation), bukan
 * per-handler, agar coverage tidak bergantung pada disiplin tiap route.
 * Jauh lebih longgar daripada limit form publik: operator sah bisa melakukan
 * puluhan mutation per menit (bulk edit, impor data), tapi flood programatik
 * tetap terhenti.
 * Diabaikan total saat E2E_SUITE=1 — harness Playwright menembak banyak
 * mutation dari satu IP (localhost) dalam hitungan detik.
 */
export async function isMutationRateLimited(ip: string, max = 120, windowMs = 60_000): Promise<boolean> {
  if (process.env.E2E_SUITE === "1") return false;
  const k = `mutation-limit:${ip}`;
  if (!redis) {
    const now = Date.now();
    const rec = mutationStore.get(k);
    if (!rec || now - rec.windowStart >= windowMs) {
      mutationStore.set(k, { count: 1, windowStart: now });
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

/** Wrapper siap-pakai: kembalikan 429 bila mutation dari IP ini melebihi kuota. */
export async function rateLimitMutation(req: RequestLike, max?: number, windowMs?: number): Promise<Response | null> {
  const ip = getClientIp(req);
  if (await isMutationRateLimited(ip, max, windowMs)) {
    logger.warn({ ip, max: max ?? 120 }, "[rate-limit] mutation limit exceeded");
    return Response.json(
      { error: "Terlalu banyak permintaan. Silakan coba lagi beberapa saat." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((windowMs ?? 60_000) / 1000)) } }
    );
  }
  return null;
}

// --- Upload Quota per Pengguna (M7) ---

const uploadQuotaStore = new Map<string, { count: number; windowStart: number }>();

/** Batas file upload (gambar + PDF BOS) per user per jendela 24 jam bergeser. */
export const UPLOAD_QUOTA_PER_DAY = 50;
const UPLOAD_QUOTA_WINDOW = 24 * 60 * 60 * 1000;

function uploadQuotaKey(userId: string) {
  return `upload-quota:${userId}`;
}

/**
 * Jumlah upload user dalam 24 jam bergeser terakhir. Dicek SEBELUM proses
 * (pre-check); penghitungannya naik hanya untuk upload yang berhasil
 * (`recordUpload`) agar file ditolak (ukuran/magic-bytes) tidak memunahkan kuota.
 * Dimatikan saat E2E_SUITE=1 — harness mengunggah banyak gambar dari satu akun.
 */
export async function getUploadCount(userId: string): Promise<number> {
  if (process.env.E2E_SUITE === "1") return 0;
  const k = uploadQuotaKey(userId);
  if (!redis) {
    const rec = uploadQuotaStore.get(k);
    if (!rec || Date.now() - rec.windowStart >= UPLOAD_QUOTA_WINDOW) return 0;
    return rec.count;
  }
  return parseInt((await redis.get(k)) ?? "0", 10) || 0;
}

/** Catat satu upload berhasil (dipanggil setelah file tersimpan). */
export async function recordUpload(userId: string): Promise<void> {
  if (process.env.E2E_SUITE === "1") return;
  const k = uploadQuotaKey(userId);
  if (!redis) {
    const now = Date.now();
    const rec = uploadQuotaStore.get(k);
    if (!rec || now - rec.windowStart >= UPLOAD_QUOTA_WINDOW) {
      uploadQuotaStore.set(k, { count: 1, windowStart: now });
    } else {
      rec.count += 1;
    }
    return;
  }
  const count = await redis.incr(k);
  if (count === 1) {
    await redis.pexpire(k, UPLOAD_QUOTA_WINDOW);
  }
}

// --- Public GET Rate Limiter ---

export async function isGetRateLimited(ip: string, max = 30, windowMs = 60000): Promise<boolean> {
  // Mode E2E (ditandai env E2E_SUITE=1 dari harness CI): browser uji navigasi
  // cepat dari satu IP (localhost) dan sah-sah menembus 30–60 req/menit —
  // matikan pembatas publik di mode ini saja. Produksi tidak pernah set env
  // ini, sehingga proteksi scraper tetap utuh.
  if (process.env.E2E_SUITE === "1") return false;
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
