import { safeJson, withErrorHandling } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createComplaintSchema, validateBody } from "@/lib/validations";
import { sendEmail, emailTemplates } from "@/lib/email";
import { notifyComplaintToAdmin } from "@/lib/notifications";
import { rateLimitPublicForm } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));
  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  const [total, items] = await Promise.all([
    db.complaint.count({ where }),
    db.complaint.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

async function POST_impl(req: NextRequest) {
  const rateLimited = await rateLimitPublicForm(req);
  if (rateLimited) return rateLimited;

  const parsed = await safeJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const validation = validateBody(createComplaintSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, email, subject, message, category } = validation.data;
  const phone = body.phone ? String(body.phone) : "";
  const isAnonymous = Boolean(body.isAnonymous);

  if (!email && !phone) {
    return NextResponse.json({ error: "Email atau telepon wajib diisi untuk respons." }, { status: 400 });
  }

  const item = await db.complaint.create({
    data: {
      name: isAnonymous ? "Anonim" : name || "Anonim",
      email: isAnonymous ? "-" : email || "-",
      phone: isAnonymous ? "-" : phone || "-",
      role: String(body.role || "Orang Tua"),
      category: category || "Akademik",
      subject,
      message,
      isAnonymous,
      priority: body.priority === "TINGGI" ? "TINGGI" : "NORMAL",
    },
  });

  // Send email notification to admin
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const template = emailTemplates.complaintNotification({
      id: item.id,
      name: isAnonymous ? "Anonim" : name || "Anonim",
      subject,
      message,
      category: category || "Akademik",
      // Kontak pelapor untuk tindak lanjut — tidak dikirim saat anonim
      email: isAnonymous ? null : email || null,
      phone: isAnonymous ? null : phone || null,
      priority: item.priority,
    });
    await sendEmail({
      to: adminEmail,
      subject: template.subject,
      html: template.html,
    });
  }

  // Send WhatsApp/Telegram notification to admin (fire-and-forget)
  notifyComplaintToAdmin({
    id: item.id,
    name: isAnonymous ? "Anonim" : name || "Anonim",
    subject,
    message,
    category: category || "Akademik",
    isAnonymous,
    priority: body.priority === "TINGGI" ? "TINGGI" : "NORMAL",
    // Kontak pelapor untuk tindak lanjut — tidak dikirim saat anonim
    email: isAnonymous ? null : email || null,
    phone: isAnonymous ? null : phone || null,
  }).catch(() => {}); // Never block the request

  return NextResponse.json({ ok: true, id: item.id });
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const POST = withErrorHandling(POST_impl, { errorMessage: "Gagal mengirim pengaduan." });
