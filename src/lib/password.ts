import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * OWASP-recommended scrypt parameters (M1):
 * N=131072 (2^17), r=8, p=1 — significantly stronger than Node defaults.
 * These values follow https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

/**
 * Hash a password using scrypt (Node built-in, no native deps).
 * Returns "salt:hash" (both hex). Storage-safe string.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString("hex");
  return `${salt}:${hash}`;
}

/** Verify a plaintext password against a stored "salt:hash" string. */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const testBuf = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
    if (hashBuf.length !== testBuf.length) return false;
    return timingSafeEqual(hashBuf, testBuf);
  } catch {
    return false;
  }
}

/** Detect whether a stored password string is already hashed (scrypt format). */
export function isHashed(stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  return salt.length === 32 && hash.length === 128; // hex of 16 bytes salt + 64 bytes hash
}
