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
  // Timeout agar POST pengaduan/kontak tidak menggantung saat SMTP lambat
  // atau tidak merespons (sendEmail di-await oleh route handler).
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
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

  complaintNotification: (data: {
    name: string;
    subject: string;
    message: string;
    category: string;
    /** Kontak pelapor untuk tindak lanjut — null saat anonim */
    email?: string | null;
    phone?: string | null;
    priority?: string;
  }) => {
    const priorityLabel = data.priority === "TINGGI" ? "🔴 TINGGI" : "🟡 NORMAL";
    const contactRows = [
      data.email ? `<p><strong>Email:</strong> ${escapeHtml(data.email)}</p>` : "",
      data.phone ? `<p><strong>Telepon:</strong> ${escapeHtml(data.phone)}</p>` : "",
    ]
      .filter(Boolean)
      .join("\n        ");

    return {
      subject: `[CMS] Pengaduan Baru: ${escapeHtml(data.subject)}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Pengaduan Baru</h2>
        <p><strong>Dari:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Kategori:</strong> ${escapeHtml(data.category)}</p>
        <p><strong>Prioritas:</strong> ${priorityLabel}</p>
        <p><strong>Subjek:</strong> ${escapeHtml(data.subject)}</p>
        ${contactRows}
        <hr style="border: 1px solid #e5e7eb;" />
        <p>${escapeHtml(data.message)}</p>
        <hr style="border: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Email ini dikirim otomatis dari CMS UPT SPF SD Negeri Unggulan Mongisidi 1
        </p>
      </div>
    `,
    };
  },

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

  /**
   * Email uji SMTP — dikirim lewat dashboard (Settings → Uji Kirim Email)
   * agar admin bisa memverifikasi konfigurasi SMTP tanpa membuat pengaduan.
   */
  testNotification: (recipientName: string) => ({
    subject: `[CMS] Uji Kirim Email Berhasil`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">✅ Uji Kirim Email Berhasil</h2>
        <p>Halo ${escapeHtml(recipientName)},</p>
        <p>
          Email ini dikirim dari dashboard CMS untuk memverifikasi konfigurasi
          SMTP. Jika Anda menerimanya, berarti pengaturan <code>SMTP_HOST</code>,
          <code>SMTP_USER</code>, dan <code>SMTP_PASS</code> sudah benar.
        </p>
        <p><strong>Waktu kirim:</strong> ${new Date().toLocaleString("id-ID")}</p>
        <hr style="border: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Email ini dikirim otomatis dari CMS UPT SPF SD Negeri Unggulan Mongisidi 1
        </p>
      </div>
    `,
  }),
};
