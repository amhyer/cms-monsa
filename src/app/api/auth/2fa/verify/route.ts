/**
 * POST /api/auth/2fa/verify
 *
 * Verify a TOTP code and enable 2FA for the authenticated user.
 * Must be called after /api/auth/2fa/setup.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTOTP } from "@/lib/totp";
import { validateBody } from "@/lib/validations";
import { z } from "zod";
import { logger } from "@/lib/logger";

const verifySchema = z.object({
  token: z
    .string()
    .length(6, "Kode TOTP harus 6 digit.")
    .regex(/^\d{6}$/, "Kode TOTP harus berupa angka."),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    if (auth.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Hanya Super Admin yang dapat mengaktifkan 2FA." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = validateBody(verifySchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { token } = validation.data;

    // Get the stored secret
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user?.twoFactorSecret) {
      return NextResponse.json(
        { error: "Tidak ada secret 2FA. Jalankan setup terlebih dahulu." },
        { status: 400 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA sudah aktif." },
        { status: 400 }
      );
    }

    // Verify the TOTP code
    const valid = verifyTOTP(user.twoFactorSecret, token);
    if (!valid) {
      return NextResponse.json(
        { error: "Kode TOTP tidak valid. Periksa aplikasi authenticator Anda." },
        { status: 400 }
      );
    }

    // Enable 2FA
    await db.user.update({
      where: { id: auth.user.id },
      data: { twoFactorEnabled: true },
    });

    logger.info({ userId: auth.user.id }, "[2FA] Enabled successfully");

    return NextResponse.json({
      ok: true,
      message: "2FA berhasil diaktifkan.",
    });
  } catch (e) {
    logger.error({ err: e }, "[2FA] Verify error");
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
