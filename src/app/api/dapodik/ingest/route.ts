import { NextRequest, NextResponse } from "next/server";
import { authenticateIngestRequest } from "@/lib/dapodik-auth";
import { applyDapodikPayload, normalizeDapodikPayload } from "@/lib/dapodik-sync";
import { rateLimitPublicForm } from "@/lib/rate-limit";
import { describeIngestError, ingestErrorStatus } from "@/lib/dapodik-ingest-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Penerimaan payload dari aplikasi jembatan / script Python lokal.
 * Autentikasi: x-api-key (SYNC_SECRET_KEY) ATAU Bearer kunci pairing.
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
    return NextResponse.json(describeIngestError(err), {
      status: ingestErrorStatus(err),
    });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST dengan x-api-key atau Authorization: Bearer …." },
    { status: 405 }
  );
}
