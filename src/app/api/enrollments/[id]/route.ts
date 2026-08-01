import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { sendEmail } from "@/lib/email";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const item = await db.enrollment.findUnique({
    where: { id },
    include: { reviewedBy: { select: { name: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.enrollment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    data.status = body.status;
    data.reviewedById = auth.user.id;
    data.reviewedAt = new Date();

    // Send email notification to student/parent
    if (body.status === "ACCEPTED" || body.status === "REJECTED") {
      const studentEmail = existing.email || existing.parentEmail;
      if (studentEmail) {
        const statusText = body.status === "ACCEPTED" ? "DITERIMA" : "DITOLAK";
        await sendEmail({
          to: studentEmail,
          subject: `[CMS] Status Pendaftaran SPMB: ${statusText}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: ${body.status === "ACCEPTED" ? "#16a34a" : "#dc2626"};">Pendaftaran ${statusText}</h2>
              <p>Halo ${existing.fullName},</p>
              <p>Pendaftaran SPMB Anda telah <strong>${statusText}</strong>.</p>
              ${body.notes ? `<p><strong>Catatan:</strong> ${body.notes}</p>` : ""}
              <hr style="border: 1px solid #e5e7eb;" />
              <p style="color: #6b7280; font-size: 12px;">
                Email ini dikirim otomatis dari CMS UPT SPF SD Negeri Unggulan Mongisidi 1
              </p>
            </div>
          `,
        });
      }
    }
  }

  if (body.notes !== undefined) data.notes = body.notes;

  const updated = await db.enrollment.update({ where: { id }, data });
  await logActivity(
    auth.user,
    "UPDATE",
    "Enrollment",
    `Memperbarui pendaftaran: ${existing.fullName} (${body.status || "notes"})`,
    id
  );

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await db.enrollment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan." }, { status: 404 });
  }

  await db.enrollment.delete({ where: { id } });
  await logActivity(
    auth.user,
    "DELETE",
    "Enrollment",
    `Menghapus pendaftaran: ${existing.fullName} (${existing.nisn})`,
    id
  );

  return NextResponse.json({ ok: true });
}
