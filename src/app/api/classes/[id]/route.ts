import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole, hasRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { user } = auth;

  // --- Authorization Check ---
  // OPERATOR/SUPER_ADMIN can see any class.
  // GURU can only see their own homeroom class.
  const isOperatorOrHigher = hasRole(user, "OPERATOR");
  const isHomeroomTeacher = user.role === "GURU" && user.guardianClassId === id;

  if (!isOperatorOrHigher && !isHomeroomTeacher) {
    return NextResponse.json(
      { error: "Forbidden. Anda tidak memiliki hak akses untuk melihat kelas ini." },
      { status: 403 }
    );
  }
  // --- End Authorization Check ---

  const item = await db.class.findUnique({
    where: { id },
    include: {
      homeroomTeacher: { select: { id: true, name: true } },
      students: {
        orderBy: { name: "asc" },
        select: { id: true, nis: true, name: true, gender: true, isActive: true },
      },
    },
  });
  if (!item) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.class.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.grade !== undefined) data.grade = String(body.grade).trim();
  if (body.stream !== undefined) data.stream = body.stream || null;
  if (body.academicYear !== undefined) data.academicYear = String(body.academicYear).trim();
  if (body.homeroomTeacherId !== undefined) data.homeroomTeacherId = body.homeroomTeacherId || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const updated = await db.class.update({ where: { id }, data });
  await logActivity(auth.user, "UPDATE", "Class", `Memperbarui kelas: ${updated.name}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.class.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const studentCount = await db.student.count({ where: { classId: id } });
  if (studentCount > 0) {
    return NextResponse.json(
      { error: "Tidak bisa menghapus kelas yang masih memiliki siswa." },
      { status: 400 }
    );
  }

  await db.class.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Class", `Menghapus kelas: ${existing.name}`, id);
  return NextResponse.json({ ok: true });
}
