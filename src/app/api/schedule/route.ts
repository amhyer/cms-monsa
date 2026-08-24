import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { DAYS } from "@/lib/schedule-constants";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const academicYear = searchParams.get("academicYear");

  const where: Record<string, unknown> = {};
  if (classId) where.classId = classId;
  if (academicYear) where.academicYear = academicYear;

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

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const day = String(body.day ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const academicYear = String(body.academicYear ?? "").trim();
  const timeSlot = Number(body.timeSlot);

  if (!day || !DAYS.includes(day as typeof DAYS[number])) {
    return NextResponse.json(
      { error: "Hari harus salah satu dari: " + DAYS.join(", ") },
      { status: 400 }
    );
  }
  if (!subject) {
    return NextResponse.json({ error: "Mata pelajaran wajib diisi." }, { status: 400 });
  }
  if (!Number.isFinite(timeSlot) || timeSlot < 1) {
    return NextResponse.json({ error: "Jam ke- tidak valid." }, { status: 400 });
  }
  if (!academicYear) {
    return NextResponse.json({ error: "Tahun ajaran wajib diisi." }, { status: 400 });
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
