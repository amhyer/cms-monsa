import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { testConnection } from "@/lib/dapodik-sync";
import { logActivity } from "@/lib/log";

export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const result = await testConnection();

  if (result.success) {
    await logActivity(auth.user, "READ", "DapodikClient", "Test koneksi Dapodik berhasil");
  }

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST untuk test koneksi." },
    { status: 405 }
  );
}
