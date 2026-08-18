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

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  guardianClassId: true,
  guardianStudentId: true,
  studentId: true,
  guardianClass: { select: { name: true } },
  guardianStudent: {
    select: { name: true, class: { select: { name: true } } },
  },
  student: {
    select: { name: true, class: { select: { name: true } } },
  },
  createdAt: true,
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "10")));
  const role = searchParams.get("role");
  const q = searchParams.get("q")?.trim() || "";

  // Filter peran (STAFF = SUPER_ADMIN + OPERATOR, sama seperti tab dashboard).
  const roleWhere =
    role && role !== "all"
      ? role === "STAFF"
        ? { role: { in: ["SUPER_ADMIN", "OPERATOR"] } }
        : { role }
      : undefined;

  // Pencarian mencakup nama akun, email, dan nama siswa tertaut
  // (guardianStudent untuk ORANG_TUA, student untuk SISWA).
  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { guardianStudent: { name: { contains: q } } },
          { student: { name: { contains: q } } },
        ],
      }
    : undefined;

  const where = {
    ...(roleWhere ?? {}),
    ...(searchWhere ?? {}),
  };

  const [total, items, roleRows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: USER_SELECT,
    }),
    // Hitungan per peran atas SELURUH akun (tidak ikut filter pencarian /
    // halaman) — dipakai label tab agar akurat walau tabel di-paginate.
    db.user.findMany({ select: { role: true } }),
  ]);

  // Hitung ringkasan peran server-side.
  const counts = {
    all: roleRows.length,
    STAFF: roleRows.filter(
      (u) => u.role === "SUPER_ADMIN" || u.role === "OPERATOR"
    ).length,
    GURU: roleRows.filter((u) => u.role === "GURU").length,
    ORANG_TUA: roleRows.filter((u) => u.role === "ORANG_TUA").length,
    SISWA: roleRows.filter((u) => u.role === "SISWA").length,
  };

  return NextResponse.json({
    items: items.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      guardianClassId: u.guardianClassId,
      guardianClassName: u.guardianClass?.name ?? null,
      guardianStudentId: u.guardianStudentId,
      guardianStudentName: u.guardianStudent?.name ?? null,
      guardianStudentClassName: u.guardianStudent?.class?.name ?? null,
      studentId: u.studentId,
      studentName: u.student?.name ?? null,
      studentClassName: u.student?.class?.name ?? null,
      createdAt: u.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts,
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

  const { name, email, password, role, guardianClassId, guardianStudentId, studentId } = validation.data;
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
  }
  if (role === "ORANG_TUA" || role === "SISWA") {
    const linkStudentId = role === "ORANG_TUA" ? guardianStudentId : studentId;
    if (!linkStudentId) {
      return NextResponse.json(
        {
          error:
            role === "ORANG_TUA"
              ? "Akun ORANG_TUA wajib ditautkan ke siswa (guardianStudentId)."
              : "Akun SISWA wajib ditautkan ke siswa (studentId).",
        },
        { status: 400 }
      );
    }
    const linkedStudent = await db.student.findUnique({
      where: { id: linkStudentId },
      select: { id: true },
    });
    if (!linkedStudent) {
      return NextResponse.json(
        { error: "Siswa yang ditautkan tidak ditemukan." },
        { status: 400 }
      );
    }
    if (role === "SISWA") {
      const taken = await db.user.findFirst({
        where: { studentId: linkStudentId },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          { error: "Siswa tersebut sudah memiliki akun." },
          { status: 409 }
        );
      }
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
      studentId: role === "SISWA" ? studentId || null : null,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, guardianStudentId: true, studentId: true, createdAt: true },
  });
  await logActivity(auth.user, "CREATE", "User", `Menambah akun ${role}: ${name} (${email})`, user.id);
  if (role === "ORANG_TUA" && guardianStudentId) {
    // Non-blokir: kegagalan WhatsApp tidak membatalkan pembuatan akun.
    await sendParentWelcome(guardianStudentId, email, password).catch(() => {});
  }
  return NextResponse.json(user);
}
