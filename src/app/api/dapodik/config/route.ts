import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { saveDapodikConfig, getDapodikConfig } from "@/lib/dapodik-sync";

export async function GET() {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const config = await getDapodikConfig();
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { npsn, token, host, port, protocol, archiveUnlisted, allowInsecureInProduction } = body;

  if (!npsn || !String(npsn).trim()) {
    return NextResponse.json(
      { error: "NPSN wajib diisi." },
      { status: 400 }
    );
  }

  try {
    await saveDapodikConfig({
      npsn: String(npsn).trim(),
      token: typeof token === "string" ? token.trim() : undefined,
      host: String(host || "localhost").trim(),
      port: Number(port || 5774),
      protocol: String(protocol || "http"),
      archiveUnlisted: typeof archiveUnlisted === "boolean" ? archiveUnlisted : true,
      allowInsecureInProduction:
        typeof allowInsecureInProduction === "boolean" ? allowInsecureInProduction : false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan konfigurasi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Konfigurasi tersimpan." });
}
