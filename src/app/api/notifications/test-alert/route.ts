import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { notifyAdmin } from "@/lib/notifications";
import { markStorageAlertTested } from "@/lib/storage-alert";
import { withErrorHandling } from "@/lib/api-helpers";

/**
 * Uji jalur alert admin (notifyAdmin) dari dashboard.
 *
 * Berbeda dari test-whatsapp / test-telegram yang menguji SATU kanal dengan
 * penerima lepas, endpoint ini menguji jalur persis yang dipakai cron
 * (mis. /api/cron/storage-alert): satu pesan ke semua kanal yang
 * dikonfigurasi sekaligus, dengan routing env yang sama
 * (ADMIN_PHONE + FONNTE_TOKEN → WhatsApp, TELEGRAM_BOT_TOKEN +
 * TELEGRAM_CHAT_ID → Telegram).
 */
async function POST_impl(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const whatsappConfigured = Boolean(
    process.env.FONNTE_TOKEN && process.env.ADMIN_PHONE
  );
  const telegramConfigured = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
  );

  if (!whatsappConfigured && !telegramConfigured) {
    return NextResponse.json({
      success: false,
      whatsappConfigured,
      telegramConfigured,
      error:
        "Tidak ada kanal aktif. Set ADMIN_PHONE + FONNTE_TOKEN (WhatsApp) dan/atau TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (Telegram).",
    });
  }

  const message = [
    "🔔 *Uji Alert Admin*",
    "",
    `Pesan uji dari CMS MONSA pada ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}.`,
    "",
    "Jika Anda menerima pesan ini, jalur alert admin (dipakai cron alert kuota storage) sudah benar.",
    "",
    "— CMS MONSA",
  ].join("\n");

  const channels = await notifyAdmin(message);

  // Catat percobaan uji apa pun hasilnya (lastTestSendAt + kanal) —
  // terpisah dari catatan milik cron, agar kartu kesehatan bisa
  // membedakan kirim cron dari uji manual. markStorageAlertTested
  // menandai lastTestedAt hanya bila ≥1 kanal sukses.
  await markStorageAlertTested(channels);

  if (!channels.whatsapp && !channels.telegram) {
    return NextResponse.json({
      success: false,
      whatsappConfigured,
      telegramConfigured,
      channels,
      error:
        "Gagal mengirim alert ke semua kanal. Periksa FONNTE_TOKEN/ADMIN_PHONE dan TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID, serta koneksi jaringan.",
    });
  }

  const sent = [
    channels.whatsapp ? "WhatsApp" : null,
    channels.telegram ? "Telegram" : null,
  ].filter(Boolean);
  const skipped = [
    whatsappConfigured && !channels.whatsapp ? "WhatsApp" : null,
    telegramConfigured && !channels.telegram ? "Telegram" : null,
  ].filter(Boolean);
  const message2 = [
    `Alert uji terkirim via ${sent.join(" dan ")}.`,
    skipped.length ? `${skipped.join(" dan ")} gagal atau dilewati.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  await logActivity(
    auth.user,
    "CREATE",
    "AdminNotification",
    `Uji kirim alert admin — WhatsApp: ${channels.whatsapp ? "ok" : "gagal"}, Telegram: ${channels.telegram ? "ok" : "gagal"}`
  );

  return NextResponse.json({
    success: true,
    whatsappConfigured,
    telegramConfigured,
    channels,
    message: message2,
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST untuk uji kirim alert admin." },
    { status: 405 }
  );
}

export const POST = withErrorHandling(POST_impl);
