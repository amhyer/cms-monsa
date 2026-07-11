import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.achievement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Prestasi tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const updated = await db.achievement.update({
    where: { id },
    data: {
      title: String(body.title ?? existing.title),
      description: body.description ?? existing.description,
      studentName: body.studentName ?? existing.studentName,
      level: String(body.level ?? existing.level),
      category: String(body.category ?? existing.category),
      date: body.date ? new Date(body.date) : existing.date,
    },
  });
  await logActivity(auth.user, "UPDATE", "Achievement", `Memperbarui prestasi: ${updated.title}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.achievement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Prestasi tidak ditemukan." }, { status: 404 });
  }
  await db.achievement.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Achievement", `Menghapus prestasi: ${existing.title}`, id);
  return NextResponse.json({ ok: true });
}
