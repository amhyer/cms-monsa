import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * Uji kirim WhatsApp notifikasi dari dashboard.
 * Admin bisa memverifikasi konfigurasi Fonnte tanpa membuat pengaduan sungguhan.
 * Penerima default: ADMIN_PHONE → wajib diset jika ingin mengirim.
 */
export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const fonnteConfigured = Boolean(process.env.FONNTE_TOKEN);

  // Terima phone opsional dari body; default ADMIN_PHONE.
  let recipient = (process.env.ADMIN_PHONE || "").trim();
  try {
    const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
    if (typeof body.phone === "string" && body.phone.trim()) {
      recipient = body.phone.trim();
    }
  } catch {
    // body tidak terbaca — abaikan, pakai default
  }

  if (!recipient) {
    return NextResponse.json({
      success: false,
      fonnteConfigured,
      error:
        "Tidak ada nomor tujuan. Set ADMIN_PHONE di environment atau isi kolom nomor penerima.",
    });
  }

  if (!fonnteConfigured) {
    return NextResponse.json({
      success: false,
      fonnteConfigured: false,
      recipient,
      error:
        "Fonnte belum dikonfigurasi. Set FONNTE_TOKEN di environment.",
    });
  }

  const message = [
    "🔔 *Uji Notifikasi WhatsApp*",
    "",
    `Pesan uji dari CMS MONSA pada ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}.`,
    "",
    "Jika Anda menerima pesan ini, konfigurasi Fonnte sudah benar.",
    "",
    "— CMS MONSA",
  ].join("\n");

  const result = await sendWhatsApp(recipient, message, { timeoutMs: 10_000 });

  if (result.ok) {
    await logActivity(
      auth.user,
      "CREATE",
      "WhatsAppNotification",
      `Uji kirim WhatsApp notifikasi ke ${recipient}`
    );
    return NextResponse.json({
      success: true,
      fonnteConfigured,
      recipient,
      message: `WhatsApp uji terkirim ke ${recipient}.`,
    });
  }

  const error = `Gagal mengirim WhatsApp: ${result.message || "Periksa nomor tujuan dan koneksi jaringan."}`;
  return NextResponse.json({ success: false, fonnteConfigured, recipient, error });
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST untuk uji kirim WhatsApp." },
    { status: 405 }
  );
}
