/**
 * Retry untuk error database transien (cold-start Neon / jaringan).
 *
 * Latar belakang: di Vercel (serverless) instance baru sering "dingin" saat
 * request pertama masuk; pool Prisma (timeout 10s, limit 5) bisa kehabisan
 * koneksi sebelum Neon sempat bangun. Pola error dari log produksi:
 *   PrismaClientInitializationError: Timed out fetching a new connection
 *   from the connection pool (Current connection pool timeout: 10, connection limit: 5)
 */

export const RETRYABLE_DB_ERROR_PATTERNS = [
  /connection pool/i,
  /timed out/i,
  /ECONNREFUSED|ECONNRESET|ETIMEDOUT/i,
  /socket hang up/i,
  /P1001|P2024|P1017/i,
  /connection.*(establish|closed|refused)/i,
] as const;

/** Error DB transien (cold-start/network) yang layak dicoba ulang. */
export function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.name} ${err.message}`;
  return RETRYABLE_DB_ERROR_PATTERNS.some((p) => p.test(msg));
}

/**
 * Jalankan fn dengan retry backoff saat error DB transien.
 * Default: 3 percobaan, delay 1s lalu 2s (total tunggu ekstra ≤3s).
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = Math.max(0, opts.baseDelayMs ?? 1000);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isTransientDbError(err)) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}