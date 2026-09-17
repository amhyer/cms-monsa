/**
 * Notifikasi kegagalan health check harian — MANDIRI dari aplikasi.
 *
 * Mengirim ringkasan kegagalan `health:daily` ke admin via kanal notifikasi
 * yang sama dengan aplikasi (Telegram + WhatsApp/Fonnte) TAPI tanpa mengimpor
 * koneksi database — dibutuhkan justru saat aplikasi/situs yang diaudit mati.
 *
 * Sengaja menyalin bentuk pemanggilan API dari src/lib/whatsapp.ts dan
 * sendTelegram() (src/lib/notifications.ts) alih-alih mengimpornya: satu-satunya
 * dependensi yang dibutuhkan adalah fetch, sehingga runner ini aman dijalankan
 * dari CI maupun cron container tanpa .env aplikasi.
 *
 * Usage:
 *   bunx tsx scripts/notify-health-failure.ts
 *
 * Environment:
 *   HEALTH_SUMMARY — baris-baris kegagalan (output "✗ ..." dari health:daily)
 *   BASE_URL       — situs yang diaudit (untuk isi pesan)
 *   RUN_URL        — URL run CI (opsional, ditautkan di pesan)
 *   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID — kanal Telegram (opsional)
 *   FONNTE_TOKEN + ADMIN_PHONE            — kanal WhatsApp (opsional)
 *
 * Exit code selalu 0: status gagal job sudah ditentukan langkah health —
 * notifier tidak boleh menambah kegagalan baru; saluran kosong hanya diperingatkan.
 */

const HEALTH_SUMMARY = process.env.HEALTH_SUMMARY?.trim() || "";
const BASE_URL = process.env.BASE_URL ?? "https://sdn-mongisidi1.sch.id";
const RUN_URL = process.env.RUN_URL ?? "";

function buildMessage(): string {
  const failures = HEALTH_SUMMARY
    ? HEALTH_SUMMARY.split("\n").map((l) => `✗ ${l.replace(/^\s*✗\s*/, "")}`)
    : ["(rincian tidak tersedia — lihat log run)"];

  return [
    "🚨 *HEALTH CHECK HARIAN GAGAL*",
    "",
    `*Situs:* ${BASE_URL}`,
    ...failures,
    ...(RUN_URL ? ["", `*Log run:* ${RUN_URL}`] : []),
    "",
    "— CMS MONSA (cron harian)",
  ].join("\n");
}

async function sendTelegram(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
    clearTimeout(timer);
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

async function sendWhatsApp(message: string): Promise<boolean> {
  const token = process.env.FONNTE_TOKEN;
  const phone = process.env.ADMIN_PHONE;
  if (!token || !phone) return false;
  try {
    const body = new URLSearchParams({ target: phone, message });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const message = buildMessage();
  const telegram = await sendTelegram(message);
  const whatsapp = await sendWhatsApp(message);
  console.log(`notify: telegram=${telegram} whatsapp=${whatsapp}`);
  if (!telegram && !whatsapp) {
    console.warn(
      "Tidak ada saluran terkirim — set secret TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID " +
        "dan/atau FONNTE_TOKEN + ADMIN_PHONE di repo (Settings → Secrets → Actions). " +
        "Kegagalan tetap tercatat di run ini dan issue GitHub.",
    );
  }
}

main();
