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
  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const updated = await db.announcement.update({
    where: { id },
    data: {
      title: String(body.title ?? existing.title),
      content: String(body.content ?? existing.content),
      isPinned: Boolean(body.isPinned ?? existing.isPinned),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
    },
  });
  await logActivity(auth.user, "UPDATE", "Announcement", `Memperbarui pengumuman: ${updated.title}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
  }
  await db.announcement.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Announcement", `Menghapus pengumuman: ${existing.title}`, id);
  return NextResponse.json({ ok: true });
}
