/**
 * POST /api/auth/2fa/login
 *
 * Verify 2FA code during login flow. Supports both TOTP tokens and backup codes.
 * Called after the main login succeeds and the user has 2FA enabled.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { verifyTOTP, verifyBackupCode, parseBackupCodes, serializeBackupCodes } from "@/lib/totp";
import { validateBody } from "@/lib/validations";
import { z } from "zod";
import { logger } from "@/lib/logger";

const login2FASchema = z.object({
  userId: z.string().min(1, "User ID wajib diisi."),
  token: z.string().min(1, "Kode wajib diisi."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(login2FASchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { userId, token } = validation.data;

    // Get user with 2FA data
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        guardianClassId: true,
        guardianStudentId: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Akun dinonaktifkan." },
        { status: 403 }
      );
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA belum aktif untuk akun ini." },
        { status: 400 }
      );
    }

    // Try TOTP verification first
    let verified = verifyTOTP(user.twoFactorSecret, token);
    let usedBackupCode = false;

    // If TOTP failed, try backup code
    if (!verified) {
      const storedHashes = parseBackupCodes(user.twoFactorBackupCodes);
      const codeIndex = verifyBackupCode(token, storedHashes);

      if (codeIndex >= 0) {
        // Remove used backup code
        storedHashes.splice(codeIndex, 1);
        await db.user.update({
          where: { id: userId },
          data: { twoFactorBackupCodes: serializeBackupCodes(storedHashes) },
        });
        verified = true;
        usedBackupCode = true;

        logger.warn(
          { userId, remaining: storedHashes.length },
          "[2FA] Backup code used"
        );
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Kode 2FA tidak valid. Periksa aplikasi authenticator atau gunakan backup code." },
        { status: 400 }
      );
    }

    // Create session
    await setSession(user.id, user.role as "SUPER_ADMIN" | "OPERATOR" | "GURU" | "ORANG_TUA" | "SISWA");

    await logActivity(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as "SUPER_ADMIN" | "OPERATOR" | "GURU" | "ORANG_TUA" | "SISWA",
        isActive: user.isActive,
        guardianClassId: user.guardianClassId ?? null,
        guardianStudentId: user.guardianStudentId ?? null,
      },
      "LOGIN",
      "Auth",
      `Login dengan 2FA${usedBackupCode ? " (backup code)" : ""}`
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        guardianClassId: user.guardianClassId ?? null,
      },
      usedBackupCode,
    });
  } catch (e) {
    logger.error({ err: e }, "[2FA] Login verification error");
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
