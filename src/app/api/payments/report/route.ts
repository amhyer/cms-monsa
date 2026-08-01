import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const YEAR_REGEX = /^\d{4}$/;

/** Rekap pembayaran per bulan dalam satu tahun (untuk laporan TU). */
export async function GET(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || String(new Date().getFullYear());
  if (!YEAR_REGEX.test(year)) {
    return NextResponse.json(
      { error: "Format tahun tidak valid (gunakan YYYY)." },
      { status: 400 }
    );
  }

  const payments = await db.payment.findMany({
    where: { monthPeriod: { startsWith: year } },
    select: {
      id: true,
      amount: true,
      monthPeriod: true,
      studentId: true,
    },
    orderBy: { monthPeriod: "asc" },
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mm = String(m).padStart(2, "0");
    const inMonth = payments.filter((p) => p.monthPeriod === `${year}-${mm}`);
    return {
      month: m,
      label: [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
      ][i],
      paidCount: inMonth.length,
      totalAmount: inMonth.reduce((sum, p) => sum + p.amount, 0),
    };
  });

  const studentIds = new Set(payments.map((p) => p.studentId));

  return NextResponse.json({
    year,
    months,
    summary: {
      totalPaid: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      distinctStudents: studentIds.size,
    },
  });
}
