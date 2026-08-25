import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { hashPassword } from "@/lib/password";
import { changePasswordSchema, validateBody } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const validation = validateBody(changePasswordSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { newPassword } = validation.data;

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  // Password di-reset admin → wajib diganti saat login berikutnya.
  await db.user.update({
    where: { id },
    data: { password: hashPassword(newPassword), mustChangePassword: true },
  });

  await logActivity(
    auth.user,
    "UPDATE",
    "User",
    `Mereset password user: ${user.name} (${user.email})`,
    id
  );

  return NextResponse.json({ ok: true, message: "Password berhasil direset." });
}
