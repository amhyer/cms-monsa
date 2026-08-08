import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { teacherProfileData } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.teacher.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const updated = await db.teacher.update({
    where: { id },
    data: {
      name: String(body.name ?? existing.name),
      position: typeof body.position === "string" ? body.position : existing.position,
      subject: body.subject !== undefined ? body.subject || null : existing.subject,
      photo: body.photo !== undefined ? body.photo || null : existing.photo,
      order: Number(body.order ?? existing.order),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
      ...teacherProfileData(body),
    },
  });
  await logActivity(auth.user, "UPDATE", "Teacher", `Memperbarui data guru/staf: ${updated.name}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.teacher.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }
  await db.teacher.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Teacher", `Menghapus data guru/staf: ${existing.name}`, id);
  return NextResponse.json({ ok: true });
}
