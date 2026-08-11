import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { createBosExpenditureSchema, validateBody } from "@/lib/validations";

/**
 * Daftar belanja dana BOS/ARKAS — PUBLIK (transparansi anggaran sekolah).
 * Data ini memang untuk dilihat semua orang, jadi tidak ada scope admin.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const items = await db.bosExpenditure.findMany({
    where: year ? { year: Number(year) } : undefined,
    orderBy: [{ year: "desc" }, { source: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
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
