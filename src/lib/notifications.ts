/**
 * Notification service for CMS MONSA.
 *
 * Sends notifications via WhatsApp (Fonnte) and Telegram (Bot API)
 * when new complaints or contact messages are submitted.
 *
 * Configuration (env):
 *   FONNTE_TOKEN = Fonnte API token for WhatsApp (optional)
 *   TELEGRAM_BOT_TOKEN = Telegram Bot API token (optional)
 *   TELEGRAM_CHAT_ID = Telegram chat/group ID for notifications (optional)
 *   ADMIN_PHONE = Admin phone number for WhatsApp notifications (optional)
 *
 * All notifications are fire-and-forget — they never block the main request.
 */

import { sendWhatsApp } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";
import { getSiteBaseUrl } from "@/lib/site-url";

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

const TELEGRAM_API_URL = "https://api.telegram.org/bot";

/**
 * Send a message via Telegram Bot API.
 * Returns true if the message was sent successfully.
 */
export async function sendTelegram(
  message: string,
  opts: { timeoutMs?: number } = {}
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    logger.debug("[notifications] Telegram not configured — skipping");
    return false;
  }

  const timeoutMs = opts.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${TELEGRAM_API_URL}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };

    if (!res.ok || !data.ok) {
      logger.error(
        { detail: data.description },
        "[notifications] Telegram send failed"
      );
      return false;
    }

    logger.info("[notifications] Telegram sent");
    return true;
  } catch (e) {
    if (controller.signal.aborted) {
      logger.error({ timeoutMs }, "[notifications] Telegram timeout");
    } else {
      logger.error({ err: e }, "[notifications] Telegram error");
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Complaint Notification
// ---------------------------------------------------------------------------

interface ComplaintNotificationData {
  name: string;
  subject: string;
  message: string;
  category: string;
  isAnonymous: boolean;
  priority: string;
  /** Kontak pelapor untuk tindak lanjut — null saat anonim */
  email?: string | null;
  phone?: string | null;
}

/**
 * Build a formatted complaint notification message for WhatsApp/Telegram.
 */
function buildComplaintMessage(data: ComplaintNotificationData): string {
  const priority = data.priority === "TINGGI" ? "🔴 TINGGI" : "🟡 NORMAL";
  const sender = data.isAnonymous ? "Anonim" : data.name;

  return [
    `📢 *Pengaduan Baru*`,
    "",
    `*Dari:* ${sender}`,
    `*Kategori:* ${data.category}`,
    `*Prioritas:* ${priority}`,
    `*Subjek:* ${data.subject}`,
    "",
    data.message.length > 500
      ? `${data.message.slice(0, 500)}…`
      : data.message,
    "",
    `*Balas di dashboard:* ${getSiteBaseUrl()}/dashboard/complaints`,
    "",
    "— CMS MONSA",
  ].join("\n");
}

/**
 * Escape karakter khusus Markdown Telegram (_ * [ ] `) pada nilai dinamis
 * (nama/kontak/subjek) agar format pesan tidak rusak — mis. underscore di
 * email yang dibaca Telegram sebagai penanda italic.
 */
function mdEscape(s: string): string {
  return s.replace(/[_*[\]`]/g, "\\$&");
}

/**
 * Pesan ringkas khusus prioritas TINGGI untuk Telegram — memuat kontak
 * pelapor agar admin bisa langsung menindaklanjuti tanpa membuka dashboard.
 */
export function buildPriorityComplaintMessage(
  data: ComplaintNotificationData
): string {
  const sender = data.isAnonymous ? "Anonim" : data.name;
  const contactLines = [
    data.email ? `*Email:* ${mdEscape(data.email)}` : "",
    data.phone ? `*Telepon:* ${mdEscape(data.phone)}` : "",
  ].filter(Boolean);

  return [
    "🚨 *PENGADUAN PRIORITAS TINGGI*",
    "",
    `*Dari:* ${mdEscape(sender)}`,
    `*Kategori:* ${mdEscape(data.category)}`,
    `*Subjek:* ${mdEscape(data.subject)}`,
    ...contactLines,
    "",
    `*Balas di dashboard:* ${getSiteBaseUrl()}/dashboard/complaints`,
  ].join("\n");
}

/**
 * Send complaint notification to admin via WhatsApp and/or Telegram.
 * Fire-and-forget — never throws, never blocks.
 */
export async function notifyComplaintToAdmin(
  data: ComplaintNotificationData
): Promise<void> {
  const message = buildComplaintMessage(data);
  const adminPhone = process.env.ADMIN_PHONE;

  // Send to WhatsApp (if configured)
  if (adminPhone) {
    try {
      const result = await sendWhatsApp(adminPhone, message, {
        timeoutMs: 10_000,
      });
      if (!result.ok) {
        logger.warn(
          { detail: result.message },
          "[notifications] WhatsApp complaint notification failed"
        );
      }
    } catch (e) {
      logger.warn(
        { err: e },
        "[notifications] WhatsApp complaint notification error"
      );
    }
  }

  // Send to Telegram (if configured)
  try {
    await sendTelegram(message, { timeoutMs: 10_000 });
  } catch (e) {
    logger.warn(
      { err: e },
      "[notifications] Telegram complaint notification error"
    );
  }

  // Notifikasi khusus prioritas TINGGI: pesan ringkas ke chat Telegram
  // admin dengan kontak pelapor, agar bisa ditindaklanjuti segera (real-time).
  if (data.priority === "TINGGI") {
    try {
      await sendTelegram(buildPriorityComplaintMessage(data), {
        timeoutMs: 10_000,
      });
    } catch (e) {
      logger.warn(
        { err: e },
        "[notifications] Telegram priority complaint alert error"
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Contact Message Notification
// ---------------------------------------------------------------------------

interface ContactNotificationData {
  name: string;
  subject: string;
  message: string;
}

/**
 * Build a formatted contact message notification for WhatsApp/Telegram.
 */
function buildContactMessage(data: ContactNotificationData): string {
  return [
    `💬 *Pesan Baru dari Formulir Kontak*`,
    "",
    `*Dari:* ${data.name}`,
    `*Subjek:* ${data.subject}`,
    "",
    data.message.length > 500
      ? `${data.message.slice(0, 500)}…`
      : data.message,
    "",
    "— CMS MONSA",
  ].join("\n");
}

/**
 * Send contact message notification to admin via WhatsApp and/or Telegram.
 * Fire-and-forget — never throws, never blocks.
 */
export async function notifyContactToAdmin(
  data: ContactNotificationData
): Promise<void> {
  const message = buildContactMessage(data);
  const adminPhone = process.env.ADMIN_PHONE;

  // Send to WhatsApp (if configured)
  if (adminPhone) {
    try {
      const result = await sendWhatsApp(adminPhone, message, {
        timeoutMs: 10_000,
      });
      if (!result.ok) {
        logger.warn(
          { detail: result.message },
          "[notifications] WhatsApp contact notification failed"
        );
      }
    } catch (e) {
      logger.warn(
        { err: e },
        "[notifications] WhatsApp contact notification error"
      );
    }
  }

  // Send to Telegram (if configured)
  try {
    await sendTelegram(message, { timeoutMs: 10_000 });
  } catch (e) {
    logger.warn(
      { err: e },
      "[notifications] Telegram contact notification error"
    );
  }
}
