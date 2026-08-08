import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireParent } from "@/lib/auth";

/**
 * Portal Orang Tua — ringkasan data anak + statistik absensi.
 * Hanya akun ORANG_TUA yang tertaut ke siswa (guardianStudentId) yang boleh.
 * Data dibatasi ketat ke siswa milik akun tersebut — tidak ada parameter input.
 */
export async function GET() {
  const auth = await requireParent();
  if (!auth.ok) return auth.response;
  const { studentId } = auth;

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { name: true, grade: true, academicYear: true } },
    },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Data siswa tidak ditemukan." },
      { status: 404 }
    );
  }

  // Ringkasan absensi bulan berjalan.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const attendances = await db.attendance.findMany({
    where: {
      studentId,
      date: { gte: monthStart, lte: now },
    },
    orderBy: { date: "desc" },
  });

  const summary: Record<string, number> = {};
  for (const a of attendances) {
    summary[a.status] = (summary[a.status] ?? 0) + 1;
  }

  return NextResponse.json({
    student: {
      id: student.id,
      nisn: student.nisn,
      name: student.name,
      gender: student.gender,
      className: student.class?.name ?? "—",
      grade: student.class?.grade ?? "—",
      academicYear: student.class?.academicYear ?? "—",
      parentName: student.parentName,
    },
    attendance: {
      monthLabel: monthStart.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      }),
      total: attendances.length,
      summary,
    },
  });
}
