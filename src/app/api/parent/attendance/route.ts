import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireParent } from "@/lib/auth";

/**
 * Portal Orang Tua — riwayat absensi anak.
 * Filter opsional: ?month=YYYY-MM (default: bulan berjalan).
 * Selalu dibatasi ke siswa milik akun ORANG_TUA — tidak bisa melihat siswa lain.
 */
export async function GET(req: NextRequest) {
  const auth = await requireParent();
  if (!auth.ok) return auth.response;
  const { studentId } = auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || "";

  const now = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(month)
    ? month.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1); // exclusive

  const items = await db.attendance.findMany({
    where: {
      studentId,
      date: { gte: start, lt: end },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      status: true,
      note: true,
    },
  });

  const summary: Record<string, number> = {};
  for (const a of items) {
    summary[a.status] = (summary[a.status] ?? 0) + 1;
  }

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return NextResponse.json({
    items,
    summary,
    monthLabel,
    month: `${y}-${String(m).padStart(2, "0")}`,
  });
}
