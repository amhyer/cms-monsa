import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.galleryItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const updated = await db.galleryItem.update({
    where: { id },
    data: {
      title: String(body.title ?? existing.title),
      description: body.description ?? existing.description,
      type: body.type === "VIDEO" ? "VIDEO" : "PHOTO",
      url: String(body.url ?? existing.url),
      thumbnail: body.thumbnail ?? existing.thumbnail,
      category: String(body.category ?? existing.category),
    },
  });
  await logActivity(auth.user, "UPDATE", "Gallery", `Memperbarui media galeri: ${updated.title}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.galleryItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404 });
  }
  await db.galleryItem.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Gallery", `Menghapus media galeri: ${existing.title}`, id);
  return NextResponse.json({ ok: true });
}
