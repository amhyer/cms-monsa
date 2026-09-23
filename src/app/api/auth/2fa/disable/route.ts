/**
 * POST /api/auth/2fa/disable
 *
 * Disable 2FA for the authenticated user. Requires password confirmation.
 */
import { safeJson, withErrorHandling } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { validateBody } from "@/lib/validations";
import { z } from "zod";
import { logger } from "@/lib/logger";

const disableSchema = z.object({
  password: z.string().min(1, "Password wajib diisi untuk menonaktifkan 2FA."),
});

async function POST_impl(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  if (auth.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Hanya Super Admin yang dapat menonaktifkan 2FA." },
      { status: 403 }
    );
  }

  const parsed = await safeJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const validation = validateBody(disableSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { password } = validation.data;

  // Verify password before disabling 2FA
  const user = await db.user.findUnique({
    where: { id: auth.user.id },
    select: { password: true, twoFactorEnabled: true },
  });

  if (!user?.twoFactorEnabled) {
    return NextResponse.json(
      { error: "2FA belum aktif." },
      { status: 400 }
    );
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return NextResponse.json(
      { error: "Password salah." },
      { status: 400 }
    );
  }

  // Disable 2FA and clear all 2FA data
  await db.user.update({
    where: { id: auth.user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    },
  });

  logger.info({ userId: auth.user.id }, "[2FA] Disabled");

  return NextResponse.json({
    ok: true,
    message: "2FA berhasil dinonaktifkan.",
  });
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const POST = withErrorHandling(POST_impl);
