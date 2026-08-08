import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { sendBulkWhatsApp, normalizePhone, announcementMessage } from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Broadcast WhatsApp untuk sebuah pengumuman.
 *
 * Mengirim pesan ke SEMUA nomor HP orang tua (parentPhone) siswa aktif
 * dengan nomor valid — dideduplikasi per nomor (satu WA per nomor, meski
 * punya >1 anak). Berlaku untuk role OPERATOR+.
 *
 * Body opsional: `{ dryRun?: boolean }` — dryRun=true menghitung jumlah
 * penerima tanpa benar-benar mengirim (berguna untuk pratinjau dari UI).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const announcement = await db.announcement.findUnique({ where: { id } });
  if (!announcement) {
    return NextResponse.json(
      { error: "Pengumuman tidak ditemukan." },
      { status: 404 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;

  // Kumpulkan nomor HP orang tua yang valid dari siswa aktif (unik).
  const students = await db.student.findMany({
    where: { isActive: true, parentPhone: { not: null } },
    select: { parentName: true, parentPhone: true },
  });

  const phones: string[] = [];
  const seen = new Set<string>();
  for (const s of students) {
    const normalized = s.parentPhone ? normalizePhone(s.parentPhone) : null;
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      phones.push(normalized);
    }
  }

  const siteSetting = await db.siteSetting.findUnique({ where: { id: "singleton" } });
  const schoolName = siteSetting?.schoolName ?? "SD Negeri Unggulan Mongisidi 1";
  const message = announcementMessage({
    schoolName,
    title: announcement.title,
    content: announcement.content,
  });

  if (dryRun) {
    return NextResponse.json({ dryRun: true, recipients: phones.length });
  }

  if (phones.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      recipients: 0,
      message: "Tidak ada nomor HP orang tua yang valid untuk dikirim.",
    });
  }

  const result = await sendBulkWhatsApp(phones, message);

  await logActivity(
    auth.user,
    "UPDATE",
    "Announcement",
    `Broadcast WhatsApp "${announcement.title}" ke ${result.sent}/${phones.length} nomor orang tua`,
    announcement.id
  );

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    recipients: phones.length,
    errors: result.errors.slice(0, 20),
  });
}
