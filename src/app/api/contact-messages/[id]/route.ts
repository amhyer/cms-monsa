import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { withErrorHandling } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

async function PUT_impl(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await db.contactMessage.update({
    where: { id },
    data: { isRead: body.isRead !== undefined ? Boolean(body.isRead) : true },
  });
  await logActivity(auth.user, "UPDATE", "ContactMessage", `Memperbarui pesan kontak`, id);
  return NextResponse.json(updated);
}

async function DELETE_impl(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  await db.contactMessage.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "ContactMessage", `Menghapus pesan kontak`, id);
  return NextResponse.json({ ok: true });
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const PUT = withErrorHandling(PUT_impl);
export const DELETE = withErrorHandling(DELETE_impl);
