import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.email === "string") data.email = body.email.trim().toLowerCase();
  if (typeof body.role === "string") data.role = body.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "OPERATOR";
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.password === "string" && body.password.length >= 6) data.password = body.password;

  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  await logActivity(auth.user, "UPDATE", "User", `Memperbarui akun: ${updated.name} (${updated.email})`, id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "Anda tidak dapat menghapus akun sendiri." },
      { status: 400 }
    );
  }
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }
  // detach activity logs then delete user
  await db.activityLog.updateMany({ where: { userId: id }, data: { userId: auth.user.id } });
  await db.contactMessage.updateMany({ where: { handledBy: id }, data: { handledBy: null } });
  await db.news.updateMany({ where: { authorId: id }, data: { authorId: auth.user.id } });
  await db.user.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "User", `Menghapus akun: ${existing.name} (${existing.email})`, id);
  return NextResponse.json({ ok: true });
}
