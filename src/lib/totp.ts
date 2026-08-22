/**
 * TOTP (Time-based One-Time Password) utilities for 2FA.
 *
 * Uses the `otpauth` library for TOTP generation/verification and
 * `crypto` for backup code hashing.
 */
import * as OTPAuth from "otpauth";
import { createHash, randomBytes } from "crypto";

const ISSUER = "CMS MONSA";
const ALGORITHM = "SHA1";
const DIGITS = 6;
const PERIOD = 30; // seconds
const SALT_ROUNDS = 1; // lightweight — backup codes are high-entropy already

// ---------------------------------------------------------------------------
// TOTP Secret
// ---------------------------------------------------------------------------

/** Generate a new TOTP secret for a user. */
export function generateTOTPSecret(email: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: new OTPAuth.Secret({ size: 20 }),
  });
}

/** Verify a TOTP token against a secret. Returns true if valid. */
export function verifyTOTP(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Validate with a window of 1 period (±30 seconds)
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

/** Get the base32-encoded secret string for storage. */
export function getSecretBase32(totp: OTPAuth.TOTP): string {
  return totp.secret.base32;
}

/** Generate the otpauth:// URI for QR code generation. */
export function getTOTPUri(totp: OTPAuth.TOTP): string {
  return totp.toString();
}

// ---------------------------------------------------------------------------
// Backup Codes
// ---------------------------------------------------------------------------

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8; // characters per code

/** Generate backup codes and return plaintext + hashed versions. */
export function generateBackupCodes(): {
  codes: string[];
  hashed: string[];
} {
  const codes: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = randomBytes(BACKUP_CODE_LENGTH)
      .toString("hex")
      .slice(0, BACKUP_CODE_LENGTH)
      .toUpperCase()
      .replace(/(.{4})/g, "$1-")
      .slice(0, -1); // format: XXXX-XXXX
    codes.push(code);
    hashed.push(hashBackupCode(code));
  }

  return { codes, hashed };
}

/** Hash a backup code for storage. */
export function hashBackupCode(code: string): string {
  const normalized = code.replace("-", "").toUpperCase();
  return createHash("sha256")
    .update(normalized + SALT_ROUNDS.toString())
    .digest("hex");
}

/** Verify a backup code against stored hashes. Returns index if found, -1 otherwise. */
export function verifyBackupCode(
  code: string,
  storedHashes: string[]
): number {
  const hash = hashBackupCode(code);
  return storedHashes.indexOf(hash);
}

/** Parse stored backup codes from JSON string. */
export function parseBackupCodes(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Serialize backup codes to JSON string for storage. */
export function serializeBackupCodes(hashed: string[]): string {
  return JSON.stringify(hashed);
}
