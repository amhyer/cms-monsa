import { safeJson } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { DAYS } from "@/lib/schedule-constants";
import { createScheduleEntrySchema, validateBody } from "@/lib/validations";
import { withErrorHandling } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const academicYear = searchParams.get("academicYear");

  const where: Record<string, unknown> = {};
  if (classId) where.classId = classId;
  if (academicYear) where.academicYear = academicYear;

  // Guru wali kelas hanya boleh melihat jadwal kelasnya sendiri —
  // paksa filter walau query meminta kelas lain. Guru mapel (tanpa
  // guardianClassId) dan peran lain tidak dibatasi.
  const session = await getSession();
  if (session?.role === "GURU" && session.guardianClassId) {
    where.classId = session.guardianClassId;
  }

  const items = await db.scheduleEntry.findMany({
    where,
    include: { teacher: { select: { name: true } } },
    orderBy: [{ day: "asc" }, { timeSlot: "asc" }],
  });

  return NextResponse.json({
    items: items.map((s) => ({
      id: s.id,
      day: s.day,
      timeSlot: s.timeSlot,
      timeLabel: s.timeLabel,
      subject: s.subject,
      teacherId: s.teacherId,
      teacherName: s.teacher?.name ?? null,
      roomId: s.roomId,
      classId: s.classId,
      academicYear: s.academicYear,
    })),
  });
}

async function POST_impl(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const parsed = await safeJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const validation = validateBody(createScheduleEntrySchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { day, subject, academicYear, timeSlot } = validation.data;

  if (!DAYS.includes(day as typeof DAYS[number])) {
    return NextResponse.json(
      { error: "Hari harus salah satu dari: " + DAYS.join(", ") },
      { status: 400 }
    );
  }

  const existing = await db.scheduleEntry.findFirst({
    where: { day, timeSlot, classId: body.classId || null, academicYear },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Sudah ada jadwal untuk hari, jam, dan kelas yang sama." },
      { status: 409 }
    );
  }

  const item = await db.scheduleEntry.create({
    data: {
      day,
      timeSlot,
      timeLabel: body.timeLabel || null,
      subject,
      teacherId: body.teacherId || null,
      roomId: body.roomId || null,
      classId: body.classId || null,
      academicYear,
    },
  });

  await logActivity(auth.user, "CREATE", "Schedule", `Menambahkan jadwal: ${day} jam ${timeSlot} — ${subject}`, item.id);

  return NextResponse.json({ id: item.id });
}

export const POST = withErrorHandling(POST_impl);
