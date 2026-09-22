import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { readStorageAlertState } from "@/lib/upload-stats";
import { withErrorHandling } from "@/lib/api-helpers";

/**
 * GET status kesehatan semua channel notifikasi + log aktivitas terakhir.
 * Menampilkan apakah SMTP / Fonnte / Telegram terkonfigurasi, beserta
 * info singkat tanpa membocorkan secret/token. Termasuk hasil pengiriman
 * alert kuota terakhir (StorageAlertState — ditulis cron
 * /api/cron/storage-alert) untuk kartu "Alert Admin (cron)" di Pengaturan.
 */
export async function GET() {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  // --- SMTP ---
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER || "";
  const smtpUserPreview = smtpUser ? `${smtpUser.split("@")[0]}@…` : null;

  // --- WhatsApp (Fonnte) ---
  const whatsappConfigured = Boolean(process.env.FONNTE_TOKEN);
  const adminPhone = process.env.ADMIN_PHONE || "";

  // --- Telegram ---
  const telegramConfigured = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
  );

  // --- Last activity log per channel ---
  // Ambil 1 log terakhir untuk setiap channel dari ActivityLog
  const channelPatterns = [
    { channel: "email", pattern: "EmailNotification" },
    { channel: "whatsapp", pattern: "WhatsAppNotification" },
    { channel: "telegram", pattern: "TelegramNotification" },
  ] as const;

  const lastLogs: Record<string, { action: string; detail: string; at: string } | null> = {};

  for (const ch of channelPatterns) {
    const log = await db.activityLog.findFirst({
      where: { entity: ch.pattern },
      orderBy: { createdAt: "desc" },
      select: { action: true, detail: true, createdAt: true },
    });
    lastLogs[ch.channel] = log
      ? { action: log.action, detail: log.detail, at: log.createdAt.toISOString() }
      : null;
  }

  // --- Hasil kirim alert kuota terakhir (StorageAlertState, ditulis cron) ---
  // Fail-soft: bila tabel belum bermigrasi/DB bermasalah → null, kesehatan
  // kanal lain tetap tampil.
  const storageAlert = await readStorageAlertState();

  return NextResponse.json({
    smtp: {
      configured: smtpConfigured,
      host: smtpHost,
      port: smtpPort,
      userPreview: smtpUserPreview,
    },
    whatsapp: {
      configured: whatsappConfigured,
      hasAdminPhone: Boolean(adminPhone),
    },
    telegram: {
      configured: telegramConfigured,
    },
    lastLogs,
    storageAlert: storageAlert
      ? {
          aboveThreshold: storageAlert.aboveThreshold,
          // Kirim cron terakhir (ditulis /api/cron/storage-alert).
          lastSendAt: storageAlert.lastSendAt,
          lastChannelsWhatsapp: storageAlert.lastChannelsWhatsapp,
          lastChannelsTelegram: storageAlert.lastChannelsTelegram,
          // Uji manual terakhir (ditulis /api/notifications/test-alert) —
          // terpisah agar kartu kesehatan bisa membedakan keduanya.
          lastTestSendAt: storageAlert.lastTestSendAt,
          lastTestChannelsWhatsapp: storageAlert.lastTestChannelsWhatsapp,
          lastTestChannelsTelegram: storageAlert.lastTestChannelsTelegram,
        }
      : null,
  });
}

async function POST_impl() {
  return NextResponse.json(
    { error: "Gunakan GET untuk melihat kesehatan notifikasi." },
    { status: 405 }
  );
}

export const POST = withErrorHandling(POST_impl);
