import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole, canAccessClass } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

const ATTENDANCE_STATUSES = ["HADIR", "SAKIT", "IZIN", "ALFA"] as const;

/** Parse "yyyy-mm-dd" into local-midday Date (same convention as UI helpers). */
function parseDateInput(value: string): Date | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dateRange(value: string): { gte: Date; lte: Date } | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return {
    gte: new Date(y, m - 1, d, 0, 0, 0, 0),
    lte: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

function todayInput(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const date = searchParams.get("date") || todayInput();

  if (!classId) {
    return NextResponse.json(
      { error: "Parameter classId wajib diisi." },
      { status: 400 }
    );
  }

  const range = dateRange(date);
  if (!range) {
    return NextResponse.json(
      { error: "Format tanggal tidak valid (gunakan yyyy-mm-dd)." },
      { status: 400 }
    );
  }

  const classExists = await db.class.findUnique({ where: { id: classId } });
  if (!classExists) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  // GURU hanya boleh mengakses kelas wali-nya sendiri.
  if (!canAccessClass(auth.user, classId)) {
    return NextResponse.json(
      { error: "Forbidden. Anda hanya dapat mengelola kelas wali Anda." },
      { status: 403 }
    );
  }

  const [students, records] = await Promise.all([
    db.student.findMany({
      where: { classId, isActive: true },
      orderBy: { name: "asc" },
    }),
    db.attendance.findMany({
      where: { classId, date: { gte: range.gte, lte: range.lte } },
    }),
  ]);

  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return NextResponse.json({
    date,
    classId,
    items: students.map((s) => {
      const rec = byStudent.get(s.id);
      return {
        studentId: s.id,
        nis: s.nis,
        nisn: s.nisn,
        name: s.name,
        gender: s.gender,
        parentName: s.parentName,
        attendanceId: rec?.id ?? null,
        status: rec?.status ?? null,
        note: rec?.note ?? null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("GURU");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const classId = String(body.classId ?? "").trim();
  const dateValue = String(body.date ?? "").trim();
  const status = String(body.status ?? "").trim();
  const note = body.note ? String(body.note).trim() : null;

  if (!studentId || !classId || !dateValue) {
    return NextResponse.json(
      { error: "Siswa, kelas, dan tanggal wajib diisi." },
      { status: 400 }
    );
  }
  if (!canAccessClass(auth.user, classId)) {
    return NextResponse.json(
      { error: "Forbidden. Anda hanya dapat mengelola kelas wali Anda." },
      { status: 403 }
    );
  }
  if (!ATTENDANCE_STATUSES.includes(status as (typeof ATTENDANCE_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Status kehadiran tidak valid. Gunakan HADIR, SAKIT, IZIN, atau ALFA." },
      { status: 400 }
    );
  }

  const date = parseDateInput(dateValue);
  if (!date) {
    return NextResponse.json(
      { error: "Format tanggal tidak valid (gunakan yyyy-mm-dd)." },
      { status: 400 }
    );
  }

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student || student.classId !== classId) {
    return NextResponse.json(
      { error: "Siswa tidak ditemukan di kelas ini." },
      { status: 404 }
    );
  }

  const item = await db.attendance.upsert({
    where: { studentId_date: { studentId, date } },
    create: {
      studentId,
      classId,
      date,
      status,
      note,
      createdById: auth.user.id,
    },
    update: { status, note },
  });

  await logActivity(
    auth.user,
    "CREATE",
    "Attendance",
    `Mencatat kehadiran ${student.name}: ${status} (${dateValue})`,
    item.id
  );

  return NextResponse.json(item);
}
