import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { sendEmail, emailTemplates } from "@/lib/email";
import { logger } from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

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

  // Kirim email balasan otomatis ke pelapor (non-anonim) — fire-and-forget
  if (typeof body.response === "string" && body.response.trim() && !existing.isAnonymous && existing.email) {
    const replyData = {
      name: existing.name,
      subject: existing.subject,
      response: body.response,
      status: (body.status || updated.status) as string,
    };
    const template = emailTemplates.complaintReply(replyData);
    sendEmail({ to: existing.email, subject: template.subject, html: template.html })
      .then((ok) => {
        if (ok) logger.info({ complaintId: id, to: existing.email }, "[complaint] Reply email sent");
        else logger.warn({ complaintId: id, to: existing.email }, "[complaint] Reply email failed");
      })
      .catch((e) => logger.warn({ err: e }, "[complaint] Reply email error"));
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.complaint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pengaduan tidak ditemukan." }, { status: 404 });
  await db.complaint.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "Complaint", `Menghapus pengaduan: ${existing.subject}`, id);
  return NextResponse.json({ ok: true });
}
