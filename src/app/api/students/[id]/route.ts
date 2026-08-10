import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const item = await db.student.findUnique({
    where: { id },
    include: { class: { select: { id: true, name: true, grade: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.student.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.nis !== undefined) {
    const newNis = String(body.nis).trim();
    if (newNis !== existing.nis) {
      const nisExists = await db.student.findUnique({ where: { nis: newNis } });
      if (nisExists) {
        return NextResponse.json({ error: "NIS sudah digunakan." }, { status: 409 });
      }
    }
    data.nis = newNis;
  }
  if (body.nisn !== undefined) data.nisn = body.nisn || null;
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.dateOfBirth !== undefined) data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  if (body.gender !== undefined) data.gender = body.gender || null;
  if (body.address !== undefined) data.address = body.address || null;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.parentName !== undefined) data.parentName = body.parentName || null;
  if (body.parentPhone !== undefined) data.parentPhone = body.parentPhone || null;
  if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null;
  if (body.classId !== undefined) data.classId = String(body.classId).trim();
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const updated = await db.student.update({ where: { id }, data });
  await logActivity(auth.user, "UPDATE", "Student", `Memperbarui data siswa: ${updated.name}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.student.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  await db.student.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Student", `Menghapus siswa: ${existing.name} (${existing.nis})`, id);
  return NextResponse.json({ ok: true });
}
