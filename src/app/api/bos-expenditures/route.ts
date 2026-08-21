import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { rateLimitPublicGet } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log";
import { createBosExpenditureSchema, validateBody } from "@/lib/validations";

/**
 * Daftar belanja dana BOS/ARKAS — PUBLIK (transparansi anggaran sekolah).
 * Data ini memang untuk dilihat semua orang, jadi tidak ada scope admin.
 */
export async function GET(req: NextRequest) {
  // Rate limit: max 60 requests per minute per IP (public transparency data)
  const rateLimited = await rateLimitPublicGet(req, 60, 60000);
  if (rateLimited) return rateLimited;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));
  const where = year ? { year: Number(year) } : {};

  const [total, items, yearGroupRows, agg, bySourceRows, docYearRows] =
    await Promise.all([
      db.bosExpenditure.count({ where }),
      db.bosExpenditure.findMany({
        where,
        orderBy: [{ year: "desc" }, { source: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      // Statistik per tahun SELALU lengkap (tidak terpotong pagination, dan
      // tidak ikut filter tahun) — dipakai dropdown admin agar admin melihat
      // jumlah & nominal tiap tahun sebelum memilih. `years` (number[])
      // diturunkan dari union di bawah (belanja + dokumen) — bukan hanya
      // belanja — agar tahun yang cuma punya dokumen tetap muncul.
      db.bosExpenditure.groupBy({
        by: ["year"],
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // Ringkasan dihitung server-side agar akurat walau tabel di-paginate.
      db.bosExpenditure.aggregate({ where, _sum: { amount: true } }),
      db.bosExpenditure.groupBy({
        by: ["source"],
        where,
        _sum: { amount: true },
      }),
      // Jumlah dokumen PDF (output ARKAS / bukti belanja) per tahun — dipakai
      // chip dropdown agar admin melihat berapa dokumen tiap tahun, bukan
      // hanya nominal belanjanya.
      db.bosDocument.groupBy({
        by: ["year"],
        _count: { _all: true },
      }),
    ]);

  const bySource = bySourceRows
    .map((r) => ({ source: r.source, total: r._sum.amount ?? 0 }))
    .sort((a, b) => b.total - a.total);

  // Union tahun belanja + dokumen, diurutkan menurun; tahun yang cuma punya
  // dokumen tetap masuk dengan count belanja 0 (dan sebaliknya).
  const docCounts = new Map(docYearRows.map((r) => [r.year, r._count._all]));
  const yearSet = new Set<number>([
    ...yearGroupRows.map((r) => r.year),
    ...docYearRows.map((r) => r.year),
  ]);
  const yearStats = Array.from(yearSet)
    .sort((a, b) => b - a)
    .map((year) => {
      const exp = yearGroupRows.find((r) => r.year === year);
      return {
        year,
        count: exp?._count._all ?? 0,
        docs: docCounts.get(year) ?? 0,
        amount: exp?._sum.amount ?? 0,
      };
    });

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    years: yearStats.map((s) => s.year),
    yearStats,
    totalAmount: agg._sum.amount ?? 0,
    bySource,
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createBosExpenditureSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { year, source, category, item, amount, quarter, note } =
    validation.data;
  const entry = await db.bosExpenditure.create({
    data: {
      year,
      source,
      category,
      item,
      amount,
      quarter: quarter ?? null,
      note: note || null,
      recordedById: auth.user.id,
    },
  });
  await logActivity(
    auth.user,
    "CREATE",
    "BosExpenditure",
    `Menambah belanja BOS ${year}: ${item}`,
    entry.id
  );
  return NextResponse.json(entry);
}
