import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Alias GET konfigurasi Dapodik (dipakai saat halaman dimuat).
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
