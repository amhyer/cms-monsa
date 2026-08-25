import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { DAYS } from "@/lib/schedule-constants";

type BulkEntry = {
  day: string;
  timeSlot: number;
  timeLabel?: string | null;
  subject: string;
  teacherId?: string | null;
  roomId?: string | null;
  classId?: string | null;
  academicYear: string;
};

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const items: BulkEntry[] = body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Tidak ada data untuk diimport." }, { status: 400 });
  }

  if (items.length > 100) {
    return NextResponse.json({ error: "Maksimal 100 jadwal per import." }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    const day = String(item.day ?? "").trim();
    const subject = String(item.subject ?? "").trim();
    const academicYear = String(item.academicYear ?? "").trim();
    const timeSlot = Number(item.timeSlot);

    if (!day || !DAYS.includes(day as typeof DAYS[number]) || !subject || !Number.isFinite(timeSlot) || timeSlot < 1 || !academicYear) {
      skipped++;
      continue;
    }

    // Skip if slot already occupied
    const existing = await db.scheduleEntry.findFirst({
      where: { day, timeSlot, classId: item.classId || null, academicYear },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await db.scheduleEntry.create({
      data: {
        day,
        timeSlot,
        timeLabel: item.timeLabel || null,
        subject,
        teacherId: item.teacherId || null,
        roomId: item.roomId || null,
        classId: item.classId || null,
        academicYear,
      },
    });
    imported++;
  }

  await logActivity(auth.user, "CREATE", "Schedule", `Import template: ${imported} jadwal ditambahkan, ${skipped} dilewati`);

  return NextResponse.json({ imported, skipped });
}
