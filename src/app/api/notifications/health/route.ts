import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET status kesehatan semua channel notifikasi + log aktivitas terakhir.
 * Menampilkan apakah SMTP / Fonnte / Telegram terkonfigurasi, beserta
 * info singkat tanpa membocorkan secret/token.
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
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Gunakan GET untuk melihat kesehatan notifikasi." },
    { status: 405 }
  );
}
