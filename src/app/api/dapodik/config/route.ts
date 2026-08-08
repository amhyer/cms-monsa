import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { saveDapodikConfig, getDapodikConfig } from "@/lib/dapodik-sync";

export async function GET() {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const config = await getDapodikConfig();
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { npsn, token, host, port, protocol, archiveUnlisted } = body;

  if (!npsn || !token) {
    return NextResponse.json(
      { error: "NPSN dan Token wajib diisi." },
      { status: 400 }
    );
  }

  await saveDapodikConfig({
    npsn: String(npsn).trim(),
    token: String(token).trim(),
    host: String(host || "localhost").trim(),
    port: Number(port || 5774),
    protocol: String(protocol || "http"),
    archiveUnlisted: typeof archiveUnlisted === "boolean" ? archiveUnlisted : true,
  });

  return NextResponse.json({ ok: true, message: "Konfigurasi tersimpan." });
}
