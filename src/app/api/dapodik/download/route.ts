import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getJembatanFiles } from "@/lib/dapodik-jembatan-files";
import { buildZipStore } from "@/lib/zip-store";

export const dynamic = "force-dynamic";

/** Unduh paket aplikasi jembatan (ZIP) untuk dijalankan di PC sekolah. */
export async function GET() {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const files = getJembatanFiles();
    const zip = buildZipStore(files);
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="jembatan-dapodik-monsa.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat berkas unduhan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
