import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonth(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const monthPeriod = searchParams.get("monthPeriod") || currentMonth();
  const classId = searchParams.get("classId");

  if (!MONTH_REGEX.test(monthPeriod)) {
    return NextResponse.json(
      { error: "Format periode tidak valid (gunakan YYYY-MM)." },
      { status: 400 }
    );
  }

  const studentWhere: Record<string, unknown> = { isActive: true };
  if (classId) {
    const classExists = await db.class.findUnique({ where: { id: classId } });
    if (!classExists) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }
    studentWhere.classId = classId;
  }

  const [students, paid] = await Promise.all([
    db.student.findMany({
      where: studentWhere,
      include: { class: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.payment.findMany({
      where: { monthPeriod, ...(classId ? { student: { classId } } : {}) },
      include: {
        student: {
          select: { id: true, nis: true, name: true, classId: true },
        },
      },
      orderBy: { paymentDate: "desc" },
    }),
  ]);

  const paidStudentIds = new Set(paid.map((p) => p.studentId));
  const unpaid = students
    .filter((s) => !paidStudentIds.has(s.id))
    .map((s) => ({
      id: s.id,
      nis: s.nis,
      nisn: s.nisn,
      name: s.name,
      className: s.class?.name ?? "—",
    }));

  return NextResponse.json({
    monthPeriod,
    summary: {
      totalStudents: students.length,
      paidCount: paidStudentIds.size,
      unpaidCount: unpaid.length,
      totalAmount: paid.reduce((sum, p) => sum + p.amount, 0),
    },
    paid: paid.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentDate: p.paymentDate,
      monthPeriod: p.monthPeriod,
      note: p.note,
      studentId: p.studentId,
      studentNis: p.student.nis,
      studentName: p.student.name,
      studentClassId: p.student.classId,
    })),
    unpaid,
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const studentId = String(body.studentId ?? "").trim();
  const monthPeriod = String(body.monthPeriod ?? "").trim();
  const amount = Number(body.amount);

  if (!studentId || !monthPeriod) {
    return NextResponse.json(
      { error: "Siswa dan periode bulan wajib diisi." },
      { status: 400 }
    );
  }
  if (!MONTH_REGEX.test(monthPeriod)) {
    return NextResponse.json(
      { error: "Format periode tidak valid (gunakan YYYY-MM)." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Nominal pembayaran harus berupa angka positif." },
      { status: 400 }
    );
  }
  if (amount > 1_000_000_000) {
    return NextResponse.json(
      { error: "Nominal terlalu besar." },
      { status: 400 }
    );
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, nis: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }

  const existing = await db.payment.findFirst({
    where: { studentId, monthPeriod },
  });
  if (existing) {
    return NextResponse.json(
      { error: `${student.name} sudah tercatat membayar periode ${monthPeriod}.` },
      { status: 409 }
    );
  }

  const item = await db.payment.create({
    data: {
      studentId,
      amount,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      monthPeriod,
      status: body.status === "UNPAID" ? "UNPAID" : "PAID",
      note: body.note ? String(body.note).trim() : null,
      recordedById: auth.user.id,
    },
  });

  await logActivity(
    auth.user,
    "CREATE",
    "Payment",
    `Mencatat pembayaran ${student.name} (${student.nis}) periode ${monthPeriod}: Rp${amount.toLocaleString("id-ID")}`,
    item.id
  );

  return NextResponse.json(item);
}
