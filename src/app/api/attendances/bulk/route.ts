import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, canAccessClass } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

const ATTENDANCE_STATUSES = ["HADIR", "SAKIT", "IZIN", "ALFA"] as const;

type BulkRecord = {
  studentId: string;
  status: string;
  note?: string | null;
};

/** Parse "yyyy-mm-dd" into local-midday Date. */
function parseDateInput(value: string): Date | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Simpan kehadiran seluruh siswa sekelas dalam satu request.
 * Body: { classId, date: "yyyy-mm-dd", records: [{ studentId, status, note? }] }
 */
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("GURU");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const classId = String(body.classId ?? "").trim();
  const dateValue = String(body.date ?? "").trim();
  const records: BulkRecord[] = Array.isArray(body.records) ? body.records : [];

  if (!classId || !dateValue) {
    return NextResponse.json(
      { error: "Kelas dan tanggal wajib diisi." },
      { status: 400 }
    );
  }
  if (!canAccessClass(auth.user, classId)) {
    return NextResponse.json(
      { error: "Forbidden. Anda hanya dapat mengelola kelas wali Anda." },
      { status: 403 }
    );
  }
  if (records.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data kehadiran yang dikirim." },
      { status: 400 }
    );
  }
  if (records.length > 500) {
    return NextResponse.json(
      { error: "Terlalu banyak data dalam satu request (maks. 500)." },
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

  const classExists = await db.class.findUnique({ where: { id: classId } });
  if (!classExists) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  // Validate statuses first, fail fast on bad payloads.
  for (const r of records) {
    if (!r.studentId) {
      return NextResponse.json(
        { error: "studentId wajib diisi untuk setiap catatan." },
        { status: 400 }
      );
    }
    if (!ATTENDANCE_STATUSES.includes(r.status as (typeof ATTENDANCE_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Status "${r.status}" tidak valid. Gunakan HADIR, SAKIT, IZIN, atau ALFA.` },
        { status: 400 }
      );
    }
  }

  // Only students actually in this class may be written.
  const students = await db.student.findMany({
    where: { classId },
    select: { id: true, name: true },
  });
  const validIds = new Set(students.map((s) => s.id));
  for (const r of records) {
    if (!validIds.has(r.studentId)) {
      return NextResponse.json(
        { error: `Siswa ${r.studentId} tidak terdaftar di kelas ini.` },
        { status: 400 }
      );
    }
  }

  const byId = new Map(students.map((s) => [s.id, s.name]));

  const saved = await db.$transaction(
    records.map((r) =>
      db.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date } },
        create: {
          studentId: r.studentId,
          classId,
          date,
          status: r.status,
          note: r.note ? String(r.note).trim() : null,
          createdById: auth.user.id,
        },
        update: {
          status: r.status,
          note: r.note ? String(r.note).trim() : null,
        },
      })
    )
  );

  await logActivity(
    auth.user,
    "CREATE",
    "Attendance",
    `Absensi kelas ${classExists.name} tanggal ${dateValue}: ${saved.length} siswa`,
    classId
  );

  return NextResponse.json({
    ok: true,
    saved: saved.length,
    classId,
    date: dateValue,
    items: saved.map((s) => ({ ...s, studentName: byId.get(s.studentId) ?? "" })),
  });
}
