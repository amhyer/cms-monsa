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

/**
 * Jumlah hop proxy tepercaya di depan aplikasi (temuan review M1).
 *
 * Dipakai untuk memilih entri X-Forwarded-For yang benar: dihitung dari KANAN,
 * bukan dari kiri. Entri paling kiri adalah nilai kiriman KLIENT dan bebas
 * dipalsukan; entri ke-N dari kanan ditambahkan oleh proxy ke-N yang kita
 * percayai.
 *
 *   - Vercel       : 1 (edge Vercel) — tapi lihat getClientIp, di sana kita
 *                    memakai x-vercel-forwarded-for yang di-set platform.
 *   - Self-host    : 1 (Caddy menimpa XFF dengan {remote_host} — lihat Caddyfile)
 *   - CDN + Caddy  : set TRUSTED_PROXY_HOPS=2, dan pastikan Caddy tidak
 *                    menimpa XFF bila rantai proxy-nya lebih dari satu.
 */
function trustedProxyHops(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Ambil satu alamat IP dari nilai header (buang port/kosong). */
function firstIp(value: string): string {
  const ip = value.split(",")[0].trim();
  return ip || "unknown";
}

// Fallback jika Redis tidak tersedia.
//
// PENTING (temuan review M8): Map global ini dulunya TIDAK PERNAH dibersihkan.
// Setiap IP/email unik menambah satu entri permanen, sehingga deployment
// self-host berumur panjang tanpa Redis tumbuh tanpa batas — memory leak yang
// bisa dipicu sengaja dengan merotasi header IP palsu (lihat getClientIp).
// Sekarang setiap entri membawa windowStart/lockedUntil dan disapu berkala.
const store = new Map<string, FailureRecord>();
const ipStore = new Map<string, FailureRecord>();
const formStore = new Map<string, CountRecord>();
const getStore = new Map<string, CountRecord>();

type FailureRecord = { failures: number; lockedUntil: number; windowStart: number };
type CountRecord = { count: number; windowStart: number };

/** Interval minimum antar-sapu (ms) — disapu oportunistis, bukan pakai timer. */
const SWEEP_INTERVAL_MS = 60 * 1000;
/**
 * Batas keras jumlah entri per Map. Bila terlampaui, entri terlama dibuang.
 * Jaring pengaman terakhir seandainya sapu berkala kalah cepat dari laju
 * kedatangan kunci unik (mis. serangan spoofing IP).
 */
const MAX_ENTRIES = 50_000;

let lastSweep = 0;

/** Buang entri yang window-nya dan lock-nya sudah lewat. */
function sweepExpired(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  for (const map of [store, ipStore] as const) {
    for (const [k, rec] of map) {
      if (rec.lockedUntil <= now && now - rec.windowStart >= WINDOW) map.delete(k);
    }
  }
  for (const [map, ttl] of [
    [formStore, 15 * 60 * 1000],
    [getStore, 60 * 1000],
  ] as const) {
    for (const [k, rec] of map) {
      if (now - rec.windowStart >= ttl) map.delete(k);
    }
  }
}

/**
 * Jaring pengaman ukuran: buang entri paling lama bila Map melampaui batas.
 * Map mempertahankan urutan penyisipan, jadi iterasi pertama = terlama.
 */
function capSize<K, V>(map: Map<K, V>): void {
  if (map.size <= MAX_ENTRIES) return;
  const excess = map.size - MAX_ENTRIES;
  let removed = 0;
  for (const k of map.keys()) {
    if (removed >= excess) break;
    map.delete(k);
    removed++;
  }
}

/** Ambil record kegagalan, reset bila window-nya sudah lewat. */
function failureRecord(
  map: Map<string, FailureRecord>,
  k: string,
  now: number
): FailureRecord {
  const existing = map.get(k);
  if (existing && now - existing.windowStart < WINDOW) return existing;
  const fresh: FailureRecord = { failures: 0, lockedUntil: 0, windowStart: now };
  map.set(k, fresh);
  return fresh;
}

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
 * Turunkan IP klien dari header proxy (temuan review M1).
 *
 * SEMUA rate limiter di aplikasi ini — lockout brute-force login, batas form
 * publik, anti-scraper — memakai fungsi ini sebagai kunci bucket. Bila IP-nya
 * bisa dipalsukan, seluruh pembatas itu bisa dilewati dengan mengirim nilai
 * header berbeda per request.
 *
 * Urutan kepercayaan:
 *  1. Vercel  → `x-vercel-forwarded-for`. Header ini DI-SET oleh edge Vercel
 *     dan memuat IP klien nyata. Kita sengaja TIDAK membaca `x-real-ip` di
 *     Vercel: tidak ada jaminan edge menimpa nilai kiriman klien.
 *  2. Self-host → `x-real-ip`. Aman karena Caddyfile memakai
 *     `header_up X-Real-IP {remote_host}` yang MENIMPA (bukan menambah) nilai
 *     dari klien.
 *  3. Fallback → `x-forwarded-for`, dihitung TRUSTED_PROXY_HOPS entri dari
 *     KANAN. Perilaku lama mengambil entri paling KIRI, yaitu nilai yang
 *     dipilih klien sendiri — di Vercel edge menambahkan IP asli ke rantai,
 *     sehingga nilai kiri tetap milik penyerang.
 */
export function getClientIp(req: RequestLike): string {
  if (process.env.VERCEL === "1") {
    const vercelIp = getHeader(req, "x-vercel-forwarded-for");
    if (vercelIp) return firstIp(vercelIp);
  }

  const real = getHeader(req, "x-real-ip");
  if (real) return firstIp(real);

  const xff = getHeader(req, "x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return "unknown";
    const idx = Math.max(0, parts.length - trustedProxyHops());
    return parts[idx];
  }

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
    // Fallback to in-memory.
    // `failureRecord` me-reset penghitung bila WINDOW sudah lewat — perilaku
    // lama mengakumulasi kegagalan SELAMANYA (5x gagal dalam setahun tetap
    // mengunci), menyimpang dari jalur Redis yang meng-expire counter.
    sweepExpired(now);

    const rec = failureRecord(store, k, now);
    rec.failures += 1;
    if (rec.failures >= MAX_FAILURES) {
      rec.lockedUntil = now + LOCK_DURATION;
    }
    capSize(store);

    const ipRec = failureRecord(ipStore, ik, now);
    ipRec.failures += 1;
    if (ipRec.failures >= IP_MAX_ATTEMPTS) {
      ipRec.lockedUntil = now + LOCK_DURATION;
    }
    capSize(ipStore);
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
    sweepExpired(now);
    const rec = formStore.get(k);
    if (!rec || now - rec.windowStart >= windowMs) {
      formStore.set(k, { count: 1, windowStart: now });
      capSize(formStore);
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
  // Mode E2E (ditandai env E2E_SUITE=1 dari harness CI): browser uji navigasi
  // cepat dari satu IP (localhost) dan sah-sah menembus 30–60 req/menit —
  // matikan pembatas publik di mode ini saja. Produksi tidak pernah set env
  // ini, sehingga proteksi scraper tetap utuh.
  if (process.env.E2E_SUITE === "1") return false;
  const k = `get-limit:${ip}`;
  if (!redis) {
    const now = Date.now();
    sweepExpired(now);
    const rec = getStore.get(k);
    if (!rec || now - rec.windowStart >= windowMs) {
      getStore.set(k, { count: 1, windowStart: now });
      capSize(getStore);
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
