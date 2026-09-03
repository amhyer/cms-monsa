/**
 * AES-256-GCM encryption/decryption untuk field sensitif di DapodikConfig
 * (token, cfAccessClientSecret).
 *
 * Key diambil dari env var DAPODIK_ENCRYPTION_KEY (hex 64 char = 32 byte).
 * Generate sekali: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Format penyimpanan di DB: base64(iv + authTag + ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.DAPODIK_ENCRYPTION_KEY;
  if (!hex || hex.length < 64) {
    throw new Error(
      "DAPODIK_ENCRYPTION_KEY tidak di-set. Generate dengan: " +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex.slice(0, 64), "hex");
}

/**
 * Enkripsi plaintext → base64(iv + authTag + ciphertext).
 * Aman untuk disimpan di database.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Gabung: iv (16) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Dekripsi base64(iv + authTag + ciphertext) → plaintext.
 * Lempar error jika key salah atau data corrupt.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Data terenkripsi terlalu pendek atau corrupt.");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Cek apakah sebuah string sudah terenkripsi (base64 iv+tag+ciphertext).
 * Digunakan untuk backward compatibility — data lama yang belum terenkripsi
 * perlu di-encrypt ulang saat pertama kali diakses.
 */
export function isEncrypted(value: string): boolean {
  try {
    const buf = Buffer.from(value, "base64");
    // Minimal: IV(16) + Tag(16) + minimal 1 byte ciphertext = 33 bytes
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
