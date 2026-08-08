import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

// Konfigurasi Dapodik tersimpan (dipakai form untuk diedit kembali).
export async function GET() {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    success: true,
    config: cfg
      ? {
          npsn: cfg.npsn,
          token: cfg.token,
          host: cfg.host,
          port: cfg.port,
          protocol: cfg.protocol,
          lastSyncAt: cfg.lastSyncAt,
          lastSyncBy: cfg.lastSyncBy,
        }
      : null,
  });
}

// Simpan / perbarui konfigurasi koneksi Dapodik.
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const npsn = String(body.npsn ?? "").trim();
  const token = String(body.token ?? "").trim();
  if (!npsn || !token) {
    return NextResponse.json({ success: false, error: "NPSN dan token wajib diisi." }, { status: 400 });
  }

  const config = await db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      npsn,
      token,
      host: String(body.host ?? "localhost").trim() || "localhost",
      port: Number(body.port ?? 5774) || 5774,
      protocol: body.protocol === "https" ? "https" : "http",
    },
    update: {
      npsn,
      token,
      host: String(body.host ?? "localhost").trim() || "localhost",
      port: Number(body.port ?? 5774) || 5774,
      protocol: body.protocol === "https" ? "https" : "http",
    },
  });

  await logActivity(auth.user, "UPDATE", "DapodikConfig", "Memperbarui konfigurasi koneksi Dapodik");
  return NextResponse.json({ success: true, config });
}
