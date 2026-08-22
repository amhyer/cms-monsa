import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Escape HTML special characters to prevent HTML injection in email templates.
 * This is critical for user-supplied data in email notifications.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    if (!process.env.SMTP_USER) {
      logger.warn("[email] SMTP not configured, skipping email send");
      return false;
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info({ to: options.to, subject: options.subject }, "[email] Sent");
    return true;
  } catch (error) {
    logger.error({ err: error }, "[email] Failed to send");
    return false;
  }
}

// Email templates
export const emailTemplates = {
  contactNotification: (name: string, subject: string, message: string) => ({
    subject: `[CMS] Pesan Baru: ${escapeHtml(subject)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Pesan Baru dari Formulir Kontak</h2>
        <p><strong>Dari:</strong> ${escapeHtml(name)}</p>
        <p><strong>Subjek:</strong> ${escapeHtml(subject)}</p>
        <hr style="border: 1px solid #e5e7eb;" />
        <p>${escapeHtml(message)}</p>
        <hr style="border: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Email ini dikirim otomatis dari CMS UPT SPF SD Negeri Unggulan Mongisidi 1
        </p>
      </div>
    `,
  }),

  complaintNotification: (name: string, subject: string, message: string, category: string) => ({
    subject: `[CMS] Pengaduan Baru: ${escapeHtml(subject)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Pengaduan Baru</h2>
        <p><strong>Dari:</strong> ${escapeHtml(name)}</p>
        <p><strong>Kategori:</strong> ${escapeHtml(category)}</p>
        <p><strong>Subjek:</strong> ${escapeHtml(subject)}</p>
        <hr style="border: 1px solid #e5e7eb;" />
        <p>${escapeHtml(message)}</p>
        <hr style="border: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Email ini dikirim otomatis dari CMS UPT SPF SD Negeri Unggulan Mongisidi 1
        </p>
      </div>
    `,
  }),

  passwordReset: (userName: string, newPassword: string) => ({
    subject: `[CMS] Password Telah Direset`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Password Telah Direset</h2>
        <p>Halo ${escapeHtml(userName)},</p>
        <p>Password Anda telah direset oleh administrator.</p>
        <p><strong>Password Baru:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${escapeHtml(newPassword)}</code></p>
        <p style="color: #dc2626;"><strong>Harap segera ubah password Anda setelah login.</strong></p>
        <hr style="border: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Email ini dikirim otomatis dari CMS UPT SPF SD Negeri Unggulan Mongisidi 1
        </p>
      </div>
    `,
  }),
};
