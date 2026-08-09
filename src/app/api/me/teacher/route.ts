import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

const MAX = { phone: 20, email: 120, subject: 120, education: 120, photo: 500, motto: 200, riwayat: 1000, sertifikasi: 1000, prestasi: 1000, badges: 200 } as const;

const MANUAL_FIELDS = ["phone", "email", "subject", "education", "photo", "motto", "riwayat", "sertifikasi", "prestasi", "badges"] as const;

const TEACHER_SELECT = {
  id: true,
  name: true,
  position: true,
  subject: true,
  education: true,
  photo: true,
  phone: true,
  email: true,
  motto: true,
  riwayat: true,
  sertifikasi: true,
  prestasi: true,
  badges: true,
  homeroomClasses: { select: { id: true, name: true, academicYear: true } },
} as const;

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const user = await db.user.findUnique({
    where: { id: auth.user.id },
    select: { teacherId: true },
  });
  if (!user?.teacherId) {
    return NextResponse.json(
      { error: "Akun ini tidak tertaut ke data guru." },
      { status: 404 }
    );
  }
  const teacher = await db.teacher.findUnique({
    where: { id: user.teacherId },
    select: TEACHER_SELECT,
  });
  if (!teacher) {
    return NextResponse.json(
      { error: "Data guru tidak ditemukan." },
      { status: 404 }
    );
  }
  return NextResponse.json(teacher);
}

export async function PUT(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const user = await db.user.findUnique({
    where: { id: auth.user.id },
    select: { teacherId: true },
  });
  if (!user?.teacherId) {
    return NextResponse.json(
      { error: "Akun ini tidak tertaut ke data guru." },
      { status: 404 }
    );
  }

  const body = await req.json();
  const data: Record<string, string | null> = {};
  for (const key of MANUAL_FIELDS) {
    if (body[key] === undefined) continue;
    const raw = String(body[key]).trim();
    if (raw.length > MAX[key]) {
      return NextResponse.json(
        { error: `${key} terlalu panjang (maks. ${MAX[key]} karakter).` },
        { status: 400 }
      );
    }
    data[key] = raw === "" ? null : raw;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada data yang diupdate." }, { status: 400 });
  }

  const teacher = await db.teacher.update({
    where: { id: user.teacherId },
    data,
    select: TEACHER_SELECT,
  });
  await logActivity(auth.user, "UPDATE", "Teacher", "Memperbarui profil sendiri (portofolio)");
  return NextResponse.json(teacher);
}
