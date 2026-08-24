import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { DAYS } from "@/lib/schedule-constants";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();
  const day = String(body.day ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const academicYear = String(body.academicYear ?? "").trim();
  const timeSlot = Number(body.timeSlot);

  if (!DAYS.includes(day as typeof DAYS[number])) {
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

  const existing = await db.scheduleEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Jadwal tidak ditemukan." }, { status: 404 });
  }

  const duplicate = await db.scheduleEntry.findFirst({
    where: { day, timeSlot, classId: body.classId || null, academicYear, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Sudah ada jadwal untuk hari, jam, dan kelas yang sama." },
      { status: 409 }
    );
  }

  const updated = await db.scheduleEntry.update({
    where: { id },
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

  await logActivity(auth.user, "UPDATE", "Schedule", `Memperbarui jadwal: ${day} jam ${timeSlot} — ${subject}`, updated.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = await requireCsrf(_req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.scheduleEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Jadwal tidak ditemukan." }, { status: 404 });
  }

  await db.scheduleEntry.delete({ where: { id } });

  await logActivity(auth.user, "DELETE", "Schedule", `Menghapus jadwal: ${existing.day} jam ${existing.timeSlot} — ${existing.subject}`, id);

  return NextResponse.json({ ok: true });
}
