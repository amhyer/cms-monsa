import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { runSync } from "@/lib/dapodik-sync";

export const dynamic = "force-dynamic";

// Dry-run sinkronisasi: hitung berapa siswa/guru/rombel yang akan dibuat,
// diperbarui, error, atau dinonaktifkan — TANPA menulis apa pun ke database.
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const semesterId = body.semesterId ? String(body.semesterId) : undefined;

  try {
    const result = await runSync({ semesterId, dryRun: true });
    await logActivity(auth.user, "UPDATE", "Dapodik", `Preview sinkronisasi (semester ${semesterId ?? "aktif"})`);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal preview sinkronisasi";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
