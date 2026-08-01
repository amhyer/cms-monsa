import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.payment.findUnique({
    where: { id },
    include: { student: { select: { name: true, nis: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Data pembayaran tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Nominal pembayaran harus berupa angka positif." },
        { status: 400 }
      );
    }
    data.amount = amount;
  }
  if (body.paymentDate !== undefined) {
    data.paymentDate = new Date(body.paymentDate);
  }
  if (body.note !== undefined) data.note = body.note ? String(body.note).trim() : null;
  if (body.status !== undefined) {
    data.status = body.status === "UNPAID" ? "UNPAID" : "PAID";
  }

  const updated = await db.payment.update({ where: { id }, data });
  await logActivity(
    auth.user,
    "UPDATE",
    "Payment",
    `Memperbarui pembayaran ${existing.student.name} periode ${existing.monthPeriod}`,
    id
  );
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.payment.findUnique({
    where: { id },
    include: { student: { select: { name: true, nis: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Data pembayaran tidak ditemukan." }, { status: 404 });
  }

  await db.payment.delete({ where: { id } });
  await logActivity(
    auth.user,
    "DELETE",
    "Payment",
    `Menghapus pembayaran ${existing.student.name} periode ${existing.monthPeriod}`,
    id
  );
  return NextResponse.json({ ok: true });
}
