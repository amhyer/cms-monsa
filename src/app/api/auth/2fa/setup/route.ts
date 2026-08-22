/**
 * POST /api/auth/2fa/setup
 *
 * Generate a new TOTP secret for the authenticated user.
 * Returns the otpauth:// URI for QR code generation and the backup codes.
 * The secret is NOT yet enabled — user must verify first via /api/auth/2fa/verify.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateTOTPSecret,
  getTOTPUri,
  getSecretBase32,
  generateBackupCodes,
  serializeBackupCodes,
} from "@/lib/totp";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth;

    // Only SUPER_ADMIN can enable 2FA
    if (auth.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Hanya Super Admin yang dapat mengaktifkan 2FA." },
        { status: 403 }
      );
    }

    // Check if 2FA is already enabled
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { twoFactorEnabled: true },
    });

    if (user?.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA sudah aktif. Nonaktifkan terlebih dahulu untuk mengatur ulang." },
        { status: 400 }
      );
    }

    // Generate new TOTP secret
    const totp = generateTOTPSecret(auth.user.email);
    const secret = getSecretBase32(totp);
    const uri = getTOTPUri(totp);

    // Generate backup codes
    const { codes, hashed } = generateBackupCodes();

    // Store secret (not yet enabled) and backup codes
    await db.user.update({
      where: { id: auth.user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorBackupCodes: serializeBackupCodes(hashed),
      },
    });

    logger.info({ userId: auth.user.id }, "[2FA] Setup initiated — secret generated");

    return NextResponse.json({
      uri,       // otpauth:// URI for QR code
      secret,    // Base32 secret (manual entry fallback)
      backupCodes: codes, // Plaintext — show once, never stored
    });
  } catch (e) {
    logger.error({ err: e }, "[2FA] Setup error");
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
