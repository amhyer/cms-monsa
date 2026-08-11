import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.bosExpenditure.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const updated = await db.bosExpenditure.update({
    where: { id },
    data: {
      year: Number(body.year ?? existing.year),
      source: typeof body.source === "string" ? body.source : existing.source,
      category:
        typeof body.category === "string" ? body.category : existing.category,
      item: typeof body.item === "string" ? body.item : existing.item,
      amount: Number(body.amount ?? existing.amount),
      quarter: body.quarter !== undefined ? body.quarter || null : existing.quarter,
      note: body.note !== undefined ? body.note || null : existing.note,
    },
  });
  await logActivity(
    auth.user,
    "UPDATE",
    "BosExpenditure",
    `Memperbarui belanja BOS ${updated.year}: ${updated.item}`,
    id
  );
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.bosExpenditure.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }
  await db.bosExpenditure.delete({ where: { id } });
  await logActivity(
    auth.user,
    "DELETE",
    "BosExpenditure",
    `Menghapus belanja BOS ${existing.year}: ${existing.item}`,
    id
  );
  return NextResponse.json({ ok: true });
}
