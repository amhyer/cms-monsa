import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { parseDateInput } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.achievement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Prestasi tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  let studentId = existing.studentId;
  if (body.studentId !== undefined) {
    studentId = body.studentId || null;
    if (studentId) {
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) {
        return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 400 });
      }
      studentId = student.id;
    }
  }
  const updated = await db.achievement.update({
    where: { id },
    data: {
      title: String(body.title ?? existing.title),
      description: body.description ?? existing.description,
      studentName: body.studentName ?? existing.studentName,
      studentId,
      level: String(body.level ?? existing.level),
      category: String(body.category ?? existing.category),
      date: body.date ? parseDateInput(String(body.date)) : existing.date,
    },
  });
  await logActivity(auth.user, "UPDATE", "Achievement", `Memperbarui prestasi: ${updated.title}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.achievement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Prestasi tidak ditemukan." }, { status: 404 });
  }
  await db.achievement.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Achievement", `Menghapus prestasi: ${existing.title}`, id);
  return NextResponse.json({ ok: true });
}
