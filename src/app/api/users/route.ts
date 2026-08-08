import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { hashPassword } from "@/lib/password";
import { createUserSchema, validateBody } from "@/lib/validations";
import {
  normalizePhone,
  notifyParentWhatsApp,
  parentAccountCreatedMessage,
} from "@/lib/whatsapp";

/**
 * Kirim akun portal orang tua lewat WhatsApp (non-blokir: kegagalan tidak
 * menggagalkan pembuatan akun). Berjalan setelah user disimpan.
 */
async function sendParentWelcome(studentId: string, email: string, password: string) {
  const [student, site] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      select: { name: true, parentName: true, parentPhone: true },
    }),
    db.siteSetting.findUnique({
      where: { id: "singleton" },
      select: { schoolName: true },
    }),
  ]);
  if (!student?.parentPhone) return; // tidak ada nomor HP → lewati
  const phone = normalizePhone(student.parentPhone);
  if (!phone) return;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  await notifyParentWhatsApp(phone, () =>
    parentAccountCreatedMessage({
      schoolName: site?.schoolName ?? "SDN Mongisidi 1",
      parentName: student.parentName,
      studentName: student.name,
      email,
      password,
      portalUrl: `${base}/portal`,
    })
  );
}

export async function GET() {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const items = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      guardianClassId: true,
      guardianClass: { select: { name: true } },
      createdAt: true,
    },
  });
  return NextResponse.json({
    items: items.map((u) => ({
      ...u,
      guardianClassName: u.guardianClass?.name ?? null,
      guardianClass: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createUserSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, email, password, role, guardianClassId, guardianStudentId } = validation.data;
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
  }
  if (role === "ORANG_TUA") {
    if (!guardianStudentId) {
      return NextResponse.json(
        { error: "Akun ORANG_TUA wajib ditautkan ke siswa (guardianStudentId)." },
        { status: 400 }
      );
    }
    const linkedStudent = await db.student.findUnique({
      where: { id: guardianStudentId },
      select: { id: true },
    });
    if (!linkedStudent) {
      return NextResponse.json(
        { error: "Siswa yang ditautkan tidak ditemukan." },
        { status: 400 }
      );
    }
  }
  const user = await db.user.create({
    data: {
      name,
      email,
      password: hashPassword(password),
      role,
      isActive: true,
      guardianClassId: role === "GURU" ? guardianClassId || null : null,
      guardianStudentId: role === "ORANG_TUA" ? guardianStudentId || null : null,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, guardianStudentId: true, createdAt: true },
  });
  await logActivity(auth.user, "CREATE", "User", `Menambah akun ${role}: ${name} (${email})`, user.id);
  if (role === "ORANG_TUA" && guardianStudentId) {
    // Non-blokir: kegagalan WhatsApp tidak membatalkan pembuatan akun.
    await sendParentWelcome(guardianStudentId, email, password).catch(() => {});
  }
  return NextResponse.json(user);
}
