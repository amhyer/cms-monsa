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
  const body = await req.json().catch(() => ({}));
  const updated = await db.contactMessage.update({
    where: { id },
    data: { isRead: body.isRead !== undefined ? Boolean(body.isRead) : true },
  });
  await logActivity(auth.user, "UPDATE", "ContactMessage", `Memperbarui pesan kontak`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  await db.contactMessage.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "ContactMessage", `Menghapus pesan kontak`, id);
  return NextResponse.json({ ok: true });
}
