import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { verifyPassword, hashPassword, isHashed } from "@/lib/password";
import { changePasswordSchema, validateBody } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const validation = validateBody(changePasswordSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { currentPassword, newPassword } = validation.data;

  const user = await db.user.findUnique({ where: { id: auth.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  // Verify current password
  const valid = isHashed(user.password)
    ? verifyPassword(currentPassword, user.password)
    : user.password === currentPassword;

  if (!valid) {
    return NextResponse.json({ error: "Password lama salah." }, { status: 401 });
  }

  await db.user.update({
    where: { id: auth.user.id },
    data: { password: hashPassword(newPassword), mustChangePassword: false },
  });

  await logActivity(auth.user, "UPDATE", "Auth", "Mengubah password sendiri");

  return NextResponse.json({ ok: true, message: "Password berhasil diubah." });
}
