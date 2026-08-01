import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { parseDateInput } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.agenda.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Agenda tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const updated = await db.agenda.update({
    where: { id },
    data: {
      title: String(body.title ?? existing.title),
      description: body.description ?? existing.description,
      date: body.date ? parseDateInput(String(body.date)) : existing.date,
      time: body.time ?? existing.time,
      location: body.location ?? existing.location,
      category: String(body.category ?? existing.category),
    },
  });
  await logActivity(auth.user, "UPDATE", "Agenda", `Memperbarui agenda: ${updated.title}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.agenda.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Agenda tidak ditemukan." }, { status: 404 });
  }
  await db.agenda.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Agenda", `Menghapus agenda: ${existing.title}`, id);
  return NextResponse.json({ ok: true });
}
