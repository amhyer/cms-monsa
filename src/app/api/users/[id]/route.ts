import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { hashPassword } from "@/lib/password";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }
    data.email = email;
  }
  // Role yang berlaku setelah update (nilai baru jika ada, selainnya role lama).
  const nextRole = typeof body.role === "string" ? body.role : existing.role;
  if (typeof body.role === "string") {
    if (!["SUPER_ADMIN", "OPERATOR", "GURU", "ORANG_TUA", "SISWA"].includes(body.role)) {
      return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
    }
    data.role = body.role;
  }
  // Tautan wali kelas mengikuti role: GURU → set, selain itu SELALU dikosongkan
  // (juga saat body tidak menyertakan guardianClassId — form hanya mengirimnya
  // untuk GURU, jadi transisi GURU → role lain harus membersihkan tautan basi).
  if (nextRole === "GURU") {
    if (body.guardianClassId !== undefined) {
      data.guardianClassId = body.guardianClassId || null;
    }
  } else {
    data.guardianClassId = null;
  }
  // Tautan ke siswa mengikuti role: SISWA → studentId, ORANG_TUA →
  // guardianStudentId, selain itu dikosongkan agar tidak ada relasi basi.
  if (nextRole === "SISWA") {
    const studentId =
      body.studentId !== undefined
        ? body.studentId || null
        : existing.studentId;
    if (!studentId) {
      return NextResponse.json(
        { error: "Akun SISWA wajib ditautkan ke siswa." },
        { status: 400 }
      );
    }
    const stu = await db.student.findUnique({
      where: { id: String(studentId) },
      select: { id: true },
    });
    if (!stu) {
      return NextResponse.json(
        { error: "Siswa yang ditautkan tidak ditemukan." },
        { status: 400 }
      );
    }
    const taken = await db.user.findFirst({
      where: { studentId: String(studentId), NOT: { id } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        { error: "Siswa tersebut sudah memiliki akun." },
        { status: 409 }
      );
    }
    data.studentId = String(studentId);
    data.guardianStudentId = null;
  } else {
    data.studentId = null;
  }
  if (nextRole === "ORANG_TUA") {
    const guardianStudentId =
      body.guardianStudentId !== undefined
        ? body.guardianStudentId || null
        : existing.guardianStudentId;
    if (!guardianStudentId) {
      return NextResponse.json(
        { error: "Akun ORANG_TUA wajib ditautkan ke siswa." },
        { status: 400 }
      );
    }
    const stu = await db.student.findUnique({
      where: { id: String(guardianStudentId) },
      select: { id: true },
    });
    if (!stu) {
      return NextResponse.json(
        { error: "Siswa yang ditautkan tidak ditemukan." },
        { status: 400 }
      );
    }
    data.guardianStudentId = String(guardianStudentId);
  } else {
    data.guardianStudentId = null;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.password === "string" && body.password.length >= 6 && body.password.length <= 100) {
    data.password = hashPassword(body.password);
  }

  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  await logActivity(auth.user, "UPDATE", "User", `Memperbarui akun: ${updated.name} (${updated.email})`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

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
