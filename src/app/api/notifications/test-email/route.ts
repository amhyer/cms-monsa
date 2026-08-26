import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { sendEmail, emailTemplates } from "@/lib/email";
import { logActivity } from "@/lib/log";

/**
 * Uji kirim email notifikasi dari dashboard.
 * Admin bisa memverifikasi konfigurasi SMTP tanpa membuat pengaduan sungguhan.
 * Penerima default: ADMIN_EMAIL (tujuan notifikasi) → fallback email user yang login.
 */
export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const smtpConfigured = Boolean(process.env.SMTP_USER);

  // Terima recipient opsional dari body; default ADMIN_EMAIL, lalu email user.
  let recipient = (process.env.ADMIN_EMAIL || "").trim();
  try {
    const body = (await req.json().catch(() => ({}))) as { recipient?: unknown };
    if (typeof body.recipient === "string" && body.recipient.trim()) {
      recipient = body.recipient.trim();
    }
  } catch {
    // body tidak terbaca — abaikan, pakai default
  }
  if (!recipient && auth.user.email) recipient = auth.user.email;

  if (!recipient) {
    return NextResponse.json({
      success: false,
      smtpConfigured,
      error:
        "Tidak ada email tujuan. Set ADMIN_EMAIL di environment atau isi kolom email penerima.",
    });
  }

  const template = emailTemplates.testNotification(auth.user.name);
  const ok = await sendEmail({
    to: recipient,
    subject: template.subject,
    html: template.html,
  });

  if (ok) {
    await logActivity(
      auth.user,
      "CREATE",
      "EmailNotification",
      `Uji kirim email notifikasi ke ${recipient}`
    );
    return NextResponse.json({
      success: true,
      smtpConfigured,
      recipient,
      message: `Email uji terkirim ke ${recipient}.`,
    });
  }

  const error = smtpConfigured
    ? "Gagal mengirim email. Periksa SMTP_HOST/PORT, kredensial SMTP_USER/SMTP_PASS, dan koneksi jaringan."
    : "SMTP belum dikonfigurasi. Set SMTP_USER, SMTP_PASS (dan SMTP_HOST/PORT) di environment.";
  return NextResponse.json({ success: false, smtpConfigured, recipient, error });
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST untuk uji kirim email." },
    { status: 405 }
  );
}