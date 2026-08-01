import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, canAccessClass } from "@/lib/auth";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-07" → { gte, lte } rentang lokal bulan tersebut. */
function monthRange(value: string): { gte: Date; lte: Date } {
  const [y, m] = value.split("-").map(Number);
  return {
    gte: new Date(y, m - 1, 1, 0, 0, 0, 0),
    lte: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

/** Rekap kehadiran per siswa dalam satu bulan (untuk laporan TU/guru). */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const month = searchParams.get("month");

  if (!classId || !month) {
    return NextResponse.json(
      { error: "Parameter classId dan month (YYYY-MM) wajib diisi." },
      { status: 400 }
    );
  }
  if (!MONTH_REGEX.test(month)) {
    return NextResponse.json(
      { error: "Format bulan tidak valid (gunakan YYYY-MM)." },
      { status: 400 }
    );
  }

  const classExists = await db.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true },
  });
  if (!classExists) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  // GURU hanya boleh merekap kelas wali-nya.
  if (!canAccessClass(auth.user, classId)) {
    return NextResponse.json(
      { error: "Forbidden. Anda hanya dapat mengelola kelas wali Anda." },
      { status: 403 }
    );
  }

  const range = monthRange(month);
  const [students, records] = await Promise.all([
    db.student.findMany({
      where: { classId, isActive: true },
      select: { id: true, nis: true, name: true, gender: true },
      orderBy: { name: "asc" },
    }),
    db.attendance.findMany({
      where: { classId, date: { gte: range.gte, lte: range.lte } },
      select: { studentId: true, status: true },
    }),
  ]);

  const perStudent = new Map<string, Record<string, number>>();
  for (const r of records) {
    const counts = perStudent.get(r.studentId) ?? {};
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    perStudent.set(r.studentId, counts);
  }

  const attendanceDates = await db.attendance.findMany({
    where: { classId, date: { gte: range.gte, lte: range.lte } },
    select: { date: true },
    distinct: ["date"],
  });
  const totalDays = attendanceDates.length;

  const items = students.map((s) => {
    const counts = perStudent.get(s.id) ?? {};
    const hadir = counts["HADIR"] ?? 0;
    const sakit = counts["SAKIT"] ?? 0;
    const izin = counts["IZIN"] ?? 0;
    const alfa = counts["ALFA"] ?? 0;
    const total = hadir + sakit + izin + alfa;
    return {
      studentId: s.id,
      nis: s.nis,
      name: s.name,
      gender: s.gender,
      counts: { HADIR: hadir, SAKIT: sakit, IZIN: izin, ALFA: alfa },
      total,
      // Persentase kehadiran: hadir dibanding total hari tercatat.
      rate: total > 0 ? Math.round((hadir / total) * 100) : null,
    };
  });

  return NextResponse.json({
    classId,
    className: classExists.name,
    month,
    totalDays,
    items,
  });
}
