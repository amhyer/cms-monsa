/**
 * WhatsApp notification service (Fonnte).
 *
 * Digunakan untuk notifikasi broadcast ke nomor HP orang tua siswa yang
 * tersimpan di field `parentPhone` pada model Student.
 *
 * Konfigurasi (env):
 *   FONNTE_TOKEN = token API dari dashboard Fonnte (WAJIB untuk mengirim).
 *   FONNTE_DEVICE_ID = id device jika akun punya >1 perangkat (opsional).
 *
 * Tanpa FONNTE_TOKEN, semua fungsi mengembalikan false — app tetap berjalan
 * normal (fitur ini opsional, seperti SMTP).
 */

import { logger } from "@/lib/logger";

const FONNTE_API_URL = "https://api.fonnte.com/send";

/** Token API Fonnte — dibaca sekali (lazy, agar test mudah di-mock). */
function fonnteToken(): string | null {
  return process.env.FONNTE_TOKEN || null;
}

/**
 * Normalisasi nomor HP Indonesia ke format internasional 628xxx.
 * - Hapus semua karakter non-digit (spasi, strip, tanda kurung).
 * - "08xx" → "628xx"
 * - Sudah "62..." → dibiarkan.
 * - Nomor < 9 digit atau berisi huruf → null (tidak valid).
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  // Nomor asing / format tidak dikenal — jangan dikirim (default aman).
  return null;
}

export interface SendWhatsAppResult {
  ok: boolean;
  message?: string;
  detail?: string;
  id?: string;
}

export interface SendWhatsAppOptions {
  /**
   * Batas waktu tunggu respons Fonnte (ms). Default: 20 detik.
   * Dipakai juga oleh test untuk menghindari timer panjang yang nyata.
   */
  timeoutMs?: number;
}

/**
 * Kirim satu pesan WA ke satu nomor (format internasional).
 * Mengembalikan true jika Fonnte menerima pengiriman.
 *
 * Timeout memakai AbortController manual + clearTimeout (bukan
 * `AbortSignal.timeout`) supaya timer SELALU dibersihkan setelah fetch
 * selesai — tidak ada timer 20s yang tertinggal di worker test.
 */
export async function sendWhatsApp(
  phone: string,
  message: string,
  opts: SendWhatsAppOptions = {}
): Promise<SendWhatsAppResult> {
  const token = fonnteToken();
  if (!token) {
    logger.warn("[whatsapp] FONNTE_TOKEN belum di-set — pengiriman dilewati.");
    return { ok: false, message: "FONNTE_TOKEN belum dikonfigurasi." };
  }
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new URLSearchParams();
    body.append("target", phone);
    body.append("message", message);

    const res = await fetch(FONNTE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      detail?: string;
      id?: string;
      message?: string;
    };

    if (!res.ok || data.status === false) {
      logger.error({ phone, detail: data.detail }, "[whatsapp] Gagal mengirim");
      return { ok: false, message: data.detail || "Gagal mengirim." };
    }
    logger.info({ phone, preview: message.slice(0, 60) }, "[whatsapp] Terkirim");
    return { ok: true, detail: data.detail, id: data.id };
  } catch (e) {
    if (controller.signal.aborted) {
      logger.error({ phone, timeoutMs }, "[whatsapp] Timeout");
      return {
        ok: false,
        message: `Timeout: Fonnte tidak merespons dalam ${timeoutMs} ms.`,
      };
    }
    logger.error({ err: e }, "[whatsapp] Error");
    return { ok: false, message: e instanceof Error ? e.message : "Network error." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kirim pesan ke banyak nomor (sequential, dengan jeda kecil per pesan
 * untuk menghindari rate-limit Fonnte). Nomor yang tidak valid dilewati.
 *
 * `message` bisa berupa string (sama untuk semua) atau fungsi per-nomor
 * (untuk pesan yang dipersonalisasi per penerima).
 */
export async function sendBulkWhatsApp(
  phones: string[],
  message: string | ((phone: string) => string),
  opts: {
    delayMs?: number;
    timeoutMs?: number;
    onProgress?: (sent: number, total: number) => void;
  } = {}
): Promise<{ sent: number; failed: number; skipped: number; errors: string[] }> {
  const delayMs = opts.delayMs ?? 1500;
  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    opts.onProgress?.(sent, phones.length);
    const body =
      typeof message === "function" ? message(phone) : message;
    const result = await sendWhatsApp(phone, body, { timeoutMs: opts.timeoutMs });
    if (result.ok) {
      sent++;
    } else {
      errors.push(`${phone}: ${result.message ?? "gagal"}`);
    }
    if (i < phones.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  skipped = Math.max(0, phones.length - sent - errors.length);
  return { sent, failed: errors.length, skipped, errors };
}

/**
 * Kirim satu notifikasi WhatsApp ke orang tua secara NON-BLOKIR.
 *
 * `build` adalah pembuat pesan yang dieksekusi LAZY di dalam try/catch — jadi
 * kegagalan apa pun (token belum di-set, network error, bahkan error saat
 * menyiapkan pesan seperti membaca setting sekolah) hanya dicatat di console,
 * tidak pernah melempar ke pemanggil. Dipakai oleh route yang aksinya tidak
 * boleh gagal karena notifikasi (buat akun portal, catat pembayaran).
 */
export async function notifyParentWhatsApp(
  phone: string,
  build: () => string | Promise<string>
): Promise<void> {
  try {
    const message = await build();
    const result = await sendWhatsApp(phone, message);
    if (!result.ok) {
      logger.warn({ phone, message: result.message }, "[whatsapp] Notifikasi orang tua gagal");
    }
  } catch (e) {
    logger.warn({ err: e }, "[whatsapp] Notifikasi orang tua gagal");
  }
}

/** "2026-07" → "Juli 2026" (untuk template pesan). */
export function monthLabel(period: string): string {
  const [y, m] = period.split("-");
  const names = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 && y ? `${names[idx]} ${y}` : period;
}

/**
 * Template pesan WhatsApp saat akun Portal Orang Tua dibuat untuk orang tua
 * (dikirim otomatis oleh operator melalui dashboard). Menyertakan kredensial
 * login (email + password) sesuai keputusan sekolah.
 */
export function parentAccountCreatedMessage(opts: {
  schoolName: string;
  parentName?: string | null;
  studentName: string;
  email: string;
  password: string;
  portalUrl: string;
}): string {
  const greeting = opts.parentName
    ? `Kepada Bapak/Ibu ${opts.parentName},`
    : "Kepada Bapak/Ibu Orang Tua/Wali Siswa,";
  return [
    greeting,
    "",
    "Selamat, akun *Portal Orang Tua* untuk anak Anda telah dibuat oleh sekolah.",
    "",
    `Siswa: *${opts.studentName}*`,
    `Email: ${opts.email}`,
    `Password: ${opts.password}`,
    "",
    `Masuk di: ${opts.portalUrl}`,
    "",
    "Silakan segera login dan ubah password untuk keamanan akun Anda.",
    "",
    `— ${opts.schoolName}`,
  ].join("\n");
}

/**
 * Template pesan pengumuman untuk orang tua.
 */
export function announcementMessage(opts: {
  schoolName: string;
  title: string;
  content: string;
  parentName?: string | null;
}): string {
  const greeting = opts.parentName
    ? `Kepada Bapak/Ibu ${opts.parentName},`
    : "Kepada Bapak/Ibu Orang Tua/Wali Siswa,";
  const content = opts.content.trim();
  const body = content.length > 800 ? `${content.slice(0, 800)}…` : content;
  return [
    greeting,
    "",
    `📢 *${opts.title.trim()}*`,
    "",
    body,
    "",
    `— ${opts.schoolName}`,
  ].join("\n");
}
