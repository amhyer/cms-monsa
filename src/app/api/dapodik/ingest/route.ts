import { NextRequest, NextResponse } from "next/server";
import { authenticateBridgeRequest } from "@/lib/dapodik-bridge";
import { applyDapodikPayload, normalizeDapodikPayload } from "@/lib/dapodik-sync";
import { rateLimitPublicForm } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Penerimaan payload dari aplikasi jembatan di PC sekolah.
 * Autentikasi: Bearer kunci pairing (bukan sesi dashboard / CSRF).
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitPublicForm(req, 30, 15 * 60 * 1000);
    if (limited) return limited;

    const auth = await authenticateBridgeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body JSON wajib." }, { status: 400 });
    }

    if ((body as { ping?: unknown }).ping === true) {
      return NextResponse.json({ ok: true, message: "Kunci pairing valid." });
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") === "dry-run" ? "dry-run" : "commit";

    try {
      const payload = normalizeDapodikPayload(body);
      const result = await applyDapodikPayload(payload, mode, { userId: "jembatan" });
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      logger.error({ err }, "[dapodik-ingest] Gagal memproses sinkronisasi Dapodik");

      const rawMessage = err instanceof Error ? err.message : "Gagal memproses data Dapodik";
      const isValidation = /wajib|tidak valid|Terlalu banyak/i.test(rawMessage);
      const isTimeout = /transaction.*timeout|transaction not found|P2028|P2024|timed out/i.test(rawMessage);

      if (isValidation) {
        return NextResponse.json({ error: rawMessage }, { status: 400 });
      }

      if (isTimeout) {
        return NextResponse.json(
          { error: "Batas waktu transaksi database terlampaui saat memproses data Dapodik. Silakan coba kembali." },
          { status: 504 }
        );
      }

      const safeMessage = /prisma|postgres|database|connection|syntax|foreign key|unique constraint/i.test(rawMessage)
        ? "Gagal memproses data Dapodik pada database. Silakan coba beberapa saat lagi."
        : rawMessage;

      return NextResponse.json({ error: safeMessage }, { status: 502 });
    }
  } catch (outerErr) {
    logger.error({ err: outerErr }, "[dapodik-ingest] Unhandled exception");
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server saat memproses permintaan." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST dari aplikasi jembatan (Authorization: Bearer …)." },
    { status: 405 }
  );
}
