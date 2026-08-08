import { NextRequest, NextResponse } from "next/server";
import { DapodikClient } from "@/lib/dapodik-client";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

// Uji koneksi: panggil getSekolah dengan konfigurasi yang dikirim (atau yang
// tersimpan) dan laporkan nama sekolah yang berhasil dijangkau.
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const npsn = String(body.npsn ?? "").trim();
  const token = String(body.token ?? "").trim();
  if (!npsn || !token) {
    return NextResponse.json({ success: false, error: "NPSN dan token wajib diisi." }, { status: 400 });
  }

  try {
    const client = new DapodikClient({
      npsn,
      token,
      host: String(body.host ?? "localhost").trim() || "localhost",
      port: Number(body.port ?? 5774) || 5774,
      protocol: body.protocol === "https" ? "https" : "http",
      allowInsecureInProduction: true,
    });
    const sekolah = await client.getSekolah();
    await logActivity(auth.user, "UPDATE", "Dapodik", `Uji koneksi Dapodik berhasil (${sekolah.nama})`);
    return NextResponse.json({ success: true, sekolah });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal terhubung ke Dapodik";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
