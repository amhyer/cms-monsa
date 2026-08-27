import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { sendTelegram } from "@/lib/notifications";

/**
 * Uji kirim Telegram notifikasi dari dashboard.
 * Admin bisa memverifikasi konfigurasi Bot API tanpa membuat pengaduan sungguhan.
 * Pesan dikirim ke TELEGRAM_CHAT_ID yang sudah dikonfigurasi.
 */
export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);

  // Terima chat_id opsional dari body; default pakai TELEGRAM_CHAT_ID.
  let chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  try {
    const body = (await req.json().catch(() => ({}))) as { chatId?: unknown };
    if (typeof body.chatId === "string" && body.chatId.trim()) {
      chatId = body.chatId.trim();
    }
  } catch {
    // body tidak terbaca — abaikan, pakai default
  }

  if (!chatId) {
    return NextResponse.json({
      success: false,
      telegramConfigured,
      error:
        "Tidak ada chat ID tujuan. Set TELEGRAM_CHAT_ID di environment atau isi kolom chat ID.",
    });
  }

  if (!telegramConfigured) {
    return NextResponse.json({
      success: false,
      telegramConfigured: false,
      chatId,
      error:
        "Telegram belum dikonfigurasi. Set TELEGRAM_BOT_TOKEN di environment.",
    });
  }

  const message = [
    "🔔 *Uji Notifikasi Telegram*",
    "",
    `Pesan uji dari CMS MONSA pada ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}.`,
    "",
    "Jika Anda menerima pesan ini, konfigurasi Telegram Bot sudah benar.",
    "",
    "— CMS MONSA",
  ].join("\n");

  const ok = await sendTelegram(message, { timeoutMs: 10_000 });

  if (ok) {
    await logActivity(
      auth.user,
      "CREATE",
      "TelegramNotification",
      `Uji kirim Telegram notifikasi ke chat ${chatId}`
    );
    return NextResponse.json({
      success: true,
      telegramConfigured,
      chatId,
      message: `Telegram uji terkirim ke chat ${chatId}.`,
    });
  }

  const error = "Gagal mengirim Telegram. Periksa TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, dan koneksi jaringan.";
  return NextResponse.json({ success: false, telegramConfigured, chatId, error });
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST untuk uji kirim Telegram." },
    { status: 405 }
  );
}
