import { NextRequest, NextResponse } from "next/server";
import { authenticateIngestRequest } from "@/lib/dapodik-auth";
import { archiveDapodikUnlisted } from "@/lib/dapodik-sync";
import { rateLimitPublicForm } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Arsipkan siswa/guru yang tidak ada lagi di Dapodik, dipanggil SETELAH semua
 * chunk sync berhasil dikirim. Autentikasi sama dengan /api/dapodik/ingest
 * (x-api-key ATAU Bearer kunci pairing).
 *
 * Body: { pesertaDidikIds: string[], gtkIds: string[] }
 *   - pesertaDidikIds: daftar lengkap peserta_didik_id yang ADA di Dapodik
 *   - gtkIds: daftar lengkap NUPTK/NIP yang ADA di Dapodik
 *
 * Response cepat (2-3 query) — aman di bawah batas waktu Vercel Hobby.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimitPublicForm(req, 30, 15 * 60 * 1000);
  if (limited) return limited;

  const auth = await authenticateIngestRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body JSON wajib." }, { status: 400 });
  }

  const pesertaDidikIds = Array.isArray(body.pesertaDidikIds)
    ? body.pesertaDidikIds.map(String)
    : [];
  const gtkIds = Array.isArray(body.gtkIds) ? body.gtkIds.map(String) : [];

  try {
    const result = await archiveDapodikUnlisted({ pesertaDidikIds, gtkIds });
    return NextResponse.json({
      success: true,
      ...result,
      message: `Diarsipkan: ${result.siswaArchived} siswa, ${result.gtkArchived} guru.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengarsipkan data.";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST dengan x-api-key atau Authorization: Bearer." },
    { status: 405 }
  );
}