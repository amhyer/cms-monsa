import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { db } from "@/lib/db";
import {
  getAutoSyncStatus,
  setAutoSyncSettings,
  sanitizeIntervalHours,
} from "@/lib/dapodik-scheduler";

export const dynamic = "force-dynamic";

// Status sinkronisasi otomatis (toggle, interval, jadwal berikutnya, riwayat).
export async function GET() {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const status = await getAutoSyncStatus();
  return NextResponse.json({ success: true, ...status });
}

// Perbarui pengaturan sinkronisasi otomatis.
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const intervalHours = sanitizeIntervalHours(Number(body.intervalHours) || 24);

  // Jangan izinkan auto-sync aktif sebelum konfigurasi Dapodik (NPSN & token)
  // tersimpan — scheduler tidak punya kredensial untuk dipakai.
  if (enabled) {
    const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
    if (!cfg || !cfg.npsn.trim() || !cfg.token.trim()) {
      return NextResponse.json(
        { success: false, error: "Simpan konfigurasi Dapodik (NPSN & token) terlebih dahulu." },
        { status: 400 }
      );
    }
  }

  const status = await setAutoSyncSettings({ enabled, intervalHours });
  await logActivity(
    auth.user,
    "UPDATE",
    "DapodikConfig",
    `Sinkronisasi otomatis ${enabled ? "diaktifkan" : "dinonaktifkan"} (interval ${status.intervalHours} jam)`
  );
  return NextResponse.json({ success: true, ...status });
}
