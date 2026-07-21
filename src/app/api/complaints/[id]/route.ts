import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.complaint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pengaduan tidak ditemukan." }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.status) data.status = String(body.status);
  if (body.priority) data.priority = String(body.priority);
  if (typeof body.response === "string") {
    data.response = body.response;
    data.responseBy = auth.user.id;
    data.respondedAt = new Date();
    data.status = body.status || "DIPROSES";
  }
  const updated = await db.complaint.update({ where: { id }, data });
  await logActivity(auth.user, "UPDATE", "Complaint", `Menanggapi pengaduan: ${existing.subject}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.complaint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pengaduan tidak ditemukan." }, { status: 404 });
  await db.complaint.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Complaint", `Menghapus pengaduan: ${existing.subject}`, id);
  return NextResponse.json({ ok: true });
}
