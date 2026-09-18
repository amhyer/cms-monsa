import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/cron-auth";
import { notifyAdmin } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// notifyAdmin mengirim maks 2 kanal × 10s.
export const maxDuration = 30;

/**
 * Laporan kegagalan job cron dari container cron self-host.
 *
 * Runner `scripts/cron-job.sh` mencoba job wget sekali + satu ulangan.
 * Bila SEMUA percobaan gagal (app down, 401, 5xx, timeout), runner mem-post
 * laporan ke sini sehingga admin tetap diberi tahu lewat kanal notifikasi
 * yang sudah ada (notifyAdmin → WhatsApp/Telegram) — bukan hanya dari
 * /backups/cron.log yang jarang dibaca.
 *
 * Kenapa endpoint terpisah (bukan kirim langsung dari container cron):
 * konfigurasi kanal (ADMIN_PHONE/FONNTE_TOKEN/TELEGRAM_*) hanya ada di app,
 * jadi satu pemilik pengiriman — container cron tidak perlu tahu apa pun
 * tentang notifikasi.
 *
 * Dedup sengaja tidak ada: job self-host berjalan harian dengan maks 2
 * percobaan, jadi laporan ≥ 1×/hari/job — aman tanpa state. Bila app sendiri
 * sedang down, POST ini juga gagal dan runner hanya mencatatnya di log.
 *
 * Body (JSON):
 *   job        — nama job (mis. "cleanup-uploads"), wajib, ≤ 100 karakter.
 *   attempts   — jumlah percobaan yang dilakukan (1..10).
 *   lastError  — (opsional) detail error percobaan terakhir.
 *   lastBody   — (opsional) body respons percobaan terakhir.
 *
 * Environment variables:
 *   CRON_SECRET — token otorisasi, sama dengan yang dipakai runner.
 *
 * Test manual:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"job":"cleanup-uploads","attempts":2,"lastError":"HTTP/1.1 502"}' \
 *     http://localhost:3000/api/cron/cron-failure
 */

const MAX_TEXT = 300;

function truncate(s: string, max = MAX_TEXT): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error(
      "[cron:cron-failure] CRON_SECRET belum di-set — laporan kegagalan dinonaktifkan."
    );
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET belum dikonfigurasi." },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  if (!bearerMatches(auth, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: {
    job?: unknown;
    attempts?: unknown;
    lastError?: unknown;
    lastBody?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body bukan JSON valid." },
      { status: 400 }
    );
  }

  const job = typeof body.job === "string" ? body.job.trim() : "";
  if (!job || job.length > 100) {
    return NextResponse.json(
      { ok: false, error: "Field 'job' wajib (string ≤ 100 karakter)." },
      { status: 400 }
    );
  }

  const attemptsNum = body.attempts;
  const attempts =
    typeof attemptsNum === "number" &&
    Number.isInteger(attemptsNum) &&
    attemptsNum >= 1 &&
    attemptsNum <= 10
      ? attemptsNum
      : null;
  if (attempts === null) {
    return NextResponse.json(
      { ok: false, error: "Field 'attempts' wajib integer 1..10." },
      { status: 400 }
    );
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const lastError = truncate(str(body.lastError));
  const lastBody = truncate(str(body.lastBody));

  const detail = [lastError, lastBody].filter(Boolean).join(" · ");
  const message = [
    "🚨 *Job Cron Gagal*",
    "",
    `*Job:* ${job}`,
    `*Percobaan:* ${attempts}× gagal`,
    detail ? `*Detail:* ${detail}` : "",
    "",
    "Selidiki: log /backups/cron.log di container cron.",
    "",
    "— CMS MONSA",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const channels = await notifyAdmin(message);
    if (!channels.whatsapp && !channels.telegram) {
      logger.warn(
        { job, attempts },
        "[cron:cron-failure] laporan diterima tapi tidak ada kanal terkirim (belum dikonfigurasi?)"
      );
    }
    return NextResponse.json({ ok: true, channels, timestamp: new Date().toISOString() });
  } catch (e) {
    logger.error({ err: e, job }, "[cron:cron-failure] notifyAdmin error");
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
