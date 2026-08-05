/**
 * Simple in-memory rate limiter for login brute-force protection.
 *
 * Tracks failed attempts per email (normalized) + IP. After MAX_FAILURES
 * within the WINDOW, the account is locked for LOCK_DURATION. Successful
 * logins and lock expiry reset the counter.
 *
 * Note: this is an in-process limiter suitable for single-instance deploys.
 * For multi-instance production, back this with Redis or a shared store.
 */

type AttemptRecord = {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
};

const WINDOW = 15 * 60 * 1000; // 15 minutes rolling window
const MAX_FAILURES = 5; // lock after 5 failed attempts
const LOCK_DURATION = 15 * 60 * 1000; // lock for 15 minutes
const IP_MAX_ATTEMPTS = 20; // max attempts per IP across all accounts

const store = new Map<string, AttemptRecord>();
const ipStore = new Map<string, AttemptRecord>(); // Per-IP tracking for credential stuffing protection

// Periodically purge expired entries to avoid memory growth.
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, rec] of store) {
    if (now > rec.lockedUntil && now - rec.firstFailureAt > WINDOW) {
      store.delete(key);
    }
  }
  for (const [key, rec] of ipStore) {
    if (now > rec.lockedUntil && now - rec.firstFailureAt > WINDOW) {
      ipStore.delete(key);
    }
  }
  for (const [key, rec] of formStore) {
    if (now - rec.windowStart >= FORM_WINDOW) {
      formStore.delete(key);
    }
  }
}

function key(email: string, ip: string) {
  return `${email.toLowerCase()}::${ip}`;
}

/** Returns the client IP from a Next.js request, best-effort. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Check if a login attempt for this email+ip is currently locked. */
export function isLocked(email: string, ip: string): boolean {
  cleanup();
  const rec = store.get(key(email, ip));
  if (!rec) return false;
  return Date.now() < rec.lockedUntil;
}

/** Returns seconds remaining until lock expires (0 if not locked). */
export function lockSecondsRemaining(email: string, ip: string): number {
  const rec = store.get(key(email, ip));
  if (!rec) return 0;
  const remaining = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/** Record a failed login attempt; may trigger a lock. */
export function recordFailure(email: string, ip: string): void {
  cleanup();
  const k = key(email, ip);
  const ipKey = `ip:${ip}`;
  const now = Date.now();

  // Track per-IP attempts across all accounts (prevents credential stuffing)
  const ipRec = ipStore.get(ipKey);
  if (!ipRec || now - ipRec.firstFailureAt > WINDOW) {
    ipStore.set(ipKey, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
  } else {
    ipRec.failures += 1;
    if (ipRec.failures >= IP_MAX_ATTEMPTS) {
      ipRec.lockedUntil = now + LOCK_DURATION;
    }
  }

  const existing = store.get(k);
  if (!existing || now - existing.firstFailureAt > WINDOW) {
    store.set(k, {
      failures: 1,
      firstFailureAt: now,
      lockedUntil: 0,
    });
    return;
  }
  existing.failures += 1;
  if (existing.failures >= MAX_FAILURES) {
    existing.lockedUntil = now + LOCK_DURATION;
  }
}

/** Check if an IP is rate-limited across all accounts (credential stuffing protection). */
export function isIpLocked(ip: string): boolean {
  const ipRec = ipStore.get(`ip:${ip}`);
  if (!ipRec) return false;
  return Date.now() < ipRec.lockedUntil;
}

/** Clear failures for this email+ip on successful login. */
export function clearFailures(email: string, ip: string): void {
  store.delete(key(email, ip));
}

// ---------- Public form rate limiting (per IP) ----------
// Protects public submission endpoints (contact, complaint, SPMB enrollment)
// from spam floods. Unlike the login limiter this is purely IP-based since
// the forms are open to anyone.

const FORM_WINDOW = 10 * 60 * 1000; // 10 minutes
const FORM_MAX = 10; // max submissions per window per IP

type IpRecord = {
  count: number;
  windowStart: number;
};

const formStore = new Map<string, IpRecord>();

/**
 * Register one submission from `ip`. Returns true when the IP has exceeded
 * the limit within the window (the request should be rejected).
 */
export function isFormRateLimited(
  ip: string,
  max = FORM_MAX,
  windowMs = FORM_WINDOW
): boolean {
  cleanup();
  const now = Date.now();
  const rec = formStore.get(ip);
  if (!rec || now - rec.windowStart >= windowMs) {
    formStore.set(ip, { count: 1, windowStart: now });
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}

/**
 * Enforce the public-form rate limit for a request.
 * Returns a 429 Response if the IP is over the limit, otherwise null.
 */
export function rateLimitPublicForm(
  req: Request,
  max?: number,
  windowMs?: number
): Response | null {
  const ip = getClientIp(req);
  if (isFormRateLimited(ip, max, windowMs)) {
    return Response.json(
      { error: "Terlalu banyak permintaan. Silakan coba lagi beberapa saat." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs ?? FORM_WINDOW) / 1000) } }
    );
  }
  return null;
}
