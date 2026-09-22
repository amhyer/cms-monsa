import { safeJson } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { withErrorHandling } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const item = await db.document.findUnique({
    where: { id },
    include: { uploadedBy: { select: { name: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }
  if (!item.isPublic) {
    // Dokumen non-publik hanya bisa diakses oleh OPERATOR atau lebih tinggi
    const auth = await requireRole("OPERATOR");
    if (!auth.ok) return auth.response;
  }
  return NextResponse.json({ ...item, uploadedByName: item.uploadedBy?.name });
}

async function PUT_impl(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.document.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }

  const parsed = await safeJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) data.title = String(body.title).trim();
  if (body.description !== undefined) data.description = body.description || null;
  if (body.fileUrl !== undefined) data.fileUrl = String(body.fileUrl).trim();
  if (body.fileName !== undefined) data.fileName = String(body.fileName).trim();
  if (body.fileSize !== undefined) data.fileSize = Number(body.fileSize);
  if (body.mimeType !== undefined) data.mimeType = String(body.mimeType);
  if (body.category !== undefined) data.category = String(body.category);
  if (body.isPublic !== undefined) data.isPublic = Boolean(body.isPublic);

  const updated = await db.document.update({ where: { id }, data });
  await logActivity(auth.user, "UPDATE", "Document", `Memperbarui dokumen: ${updated.title}`, id);
  return NextResponse.json(updated);
}

async function DELETE_impl(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.document.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }

  await db.document.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Document", `Menghapus dokumen: ${existing.title}`, id);
  return NextResponse.json({ ok: true });
}

export const PUT = withErrorHandling(PUT_impl);
export const DELETE = withErrorHandling(DELETE_impl);
