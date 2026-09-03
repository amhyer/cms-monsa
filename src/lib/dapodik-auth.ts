import { timingSafeEqual } from "crypto";
import { authenticateBridgeRequest } from "@/lib/dapodik-bridge";

export type AuthResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Autentikasi dua jalur untuk endpoint ingest Dapodik:
 * 1. `x-api-key` header — dibandingkan timing-safe dengan `SYNC_SECRET_KEY` env.
 * 2. `Authorization: Bearer` — diverifikasi sebagai kunci pairing jembatan.
 *
 * x-api-key diprioritaskan: jika ada, bridge token tidak dicek.
 */
export async function authenticateIngestRequest(req: Request): Promise<AuthResult> {
  if (req.headers.has("x-api-key")) {
    const apiKey = req.headers.get("x-api-key")!;
    const expected = process.env.SYNC_SECRET_KEY;
    if (!expected) return { ok: false, status: 500, error: "SYNC_SECRET_KEY belum diatur di server." };
    if (!safeCompare(apiKey, expected)) {
      return { ok: false, status: 401, error: "API key tidak valid." };
    }
    return { ok: true };
  }
  if (req.headers.get("authorization")?.trim()) {
    return authenticateBridgeRequest(req);
  }
  return { ok: false, status: 401, error: "Autentikasi wajib: kirim x-api-key atau Authorization: Bearer." };
}

/**
 * Bandingkan dua string secara timing-safe (cegah timing attack).
 * `timingSafeEqual` melempar RangeError kalau panjang beda — ditangkap
 * dan dikembalikan sebagai `false` agar caller tidak perlu try/catch.
 */
function safeCompare(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
