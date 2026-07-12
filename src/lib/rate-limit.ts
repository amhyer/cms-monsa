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

const store = new Map<string, AttemptRecord>();

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
  const now = Date.now();
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

/** Clear failures for this email+ip on successful login. */
export function clearFailures(email: string, ip: string): void {
  store.delete(key(email, ip));
}
