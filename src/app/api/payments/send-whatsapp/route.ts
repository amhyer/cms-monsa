import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import {
  sendBulkWhatsApp,
  normalizePhone,
  sppReminderMessage,
} from "@/lib/whatsapp";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

type SppRecipient = {
  phone: string;
  studentNames: string[];
};

/**
 * Broadcast pengingat tagihan SPP via WhatsApp.
 *
 * Mengirim pesan ke nomor HP orang tua (parentPhone) siswa AKTIF yang
 * belum tercatat membayar pada `monthPeriod` — dideduplikasi per nomor;
 * jika satu nomor dipakai 2+ anak, nama anak digabung dalam satu pesan.
 *
 * Body: `{ monthPeriod: string, dryRun?: boolean, classId?: string }`
 *   - classId opsional: batasi ke satu kelas (sinkron dengan filter UI).
 *   - dryRun=true menghitung penerima tanpa mengirim (pratinjau dari UI).
 */
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    monthPeriod?: string;
    dryRun?: boolean;
    classId?: string;
  };
  const monthPeriod = String(body.monthPeriod ?? "").trim();
  if (!MONTH_REGEX.test(monthPeriod)) {
    return NextResponse.json(
      { error: "Format periode tidak valid (gunakan YYYY-MM)." },
      { status: 400 }
    );
  }
  const dryRun = body.dryRun === true;
  const classId = String(body.classId ?? "").trim() || null;

  const studentWhere: Record<string, unknown> = { isActive: true };
  if (classId) {
    const classExists = await db.class.findUnique({ where: { id: classId } });
    if (!classExists) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }
    studentWhere.classId = classId;
  }

  // Siswa aktif + siapa yang sudah bayar periode ini.
  const [students, payments] = await Promise.all([
    db.student.findMany({
      where: studentWhere,
      select: { id: true, name: true, parentPhone: true },
      orderBy: { name: "asc" },
    }),
    db.payment.findMany({
      where: { monthPeriod, ...(classId ? { student: { classId } } : {}) },
      select: { studentId: true },
    }),
  ]);

  const paidStudentIds = new Set(payments.map((p) => p.studentId));
  const unpaid = students.filter((s) => !paidStudentIds.has(s.id));

  // Kelompokkan per nomor HP valid (unifikasi format 08xx → 628xx).
  const byPhone = new Map<string, SppRecipient>();
  for (const s of unpaid) {
    const phone = s.parentPhone ? normalizePhone(s.parentPhone) : null;
    if (!phone) continue;
    const rec = byPhone.get(phone) ?? { phone, studentNames: [] };
    rec.studentNames.push(s.name);
    byPhone.set(phone, rec);
  }
  const recipients = [...byPhone.values()];

  const siteSetting = await db.siteSetting.findUnique({ where: { id: "singleton" } });
  const schoolName = siteSetting?.schoolName ?? "SD Negeri Unggulan Mongisidi 1";

  if (dryRun) {
    return NextResponse.json({ dryRun: true, recipients: recipients.length });
  }

  if (recipients.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      recipients: 0,
      message: "Tidak ada siswa belum bayar dengan nomor HP orang tua yang valid.",
    });
  }

  const result = await sendBulkWhatsApp(
    recipients.map((r) => r.phone),
    (phone) =>
      sppReminderMessage({
        schoolName,
        monthPeriod,
        studentNames: byPhone.get(phone)?.studentNames ?? [],
      })
  );

  await logActivity(
    auth.user,
    "CREATE",
    "Payment",
    `Broadcast WhatsApp pengingat SPP ${monthPeriod} ke ${result.sent}/${recipients.length} nomor orang tua`,
    monthPeriod
  );

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    recipients: recipients.length,
    errors: result.errors.slice(0, 20),
  });
}
