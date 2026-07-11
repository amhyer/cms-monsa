import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await db.contactMessage.update({
    where: { id },
    data: { isRead: body.isRead !== undefined ? Boolean(body.isRead) : true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  await db.contactMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
