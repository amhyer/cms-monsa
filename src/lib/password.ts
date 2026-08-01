import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * Hash a password using scrypt (Node built-in, no native deps).
 * Returns "salt:hash" (both hex). Storage-safe string.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Verify a plaintext password against a stored "salt:hash" string. */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const testBuf = scryptSync(password, salt, 64);
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
