import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { getDapodikClient } from "@/lib/dapodik-sync";
import { logActivity } from "@/lib/log";

// Dipanggil dari DapodikManager (fetchData) dengan body { endpoint }.
// endpoint: "all" (default) | "sekolah" | "siswa"/"peserta_didik" | "guru"/"gtk" | "rombel"
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  let endpoint = "all";
  try {
    const body = await req.json();
    if (body?.endpoint) endpoint = body.endpoint;
  } catch {
    // body kosong/tidak valid — pakai default "all"
  }

  try {
    const client = await getDapodikClient();
    let data: Record<string, unknown>;

    // Sequential, bukan Promise.all — Dapodik lokal sering gagal
    // ("Tidak terhubung dengan database") kalau menerima request paralel.
    switch (endpoint) {
      case "sekolah":
        data = { sekolah: await client.getSekolah() };
        break;
      case "siswa":
      case "peserta_didik":
        data = { peserta_didik: await client.getPesertaDidik() };
        break;
      case "guru":
      case "gtk":
        data = { gtk: await client.getGTK() };
        break;
      case "rombel":
        data = { rombel: await client.getRombonganBelajar() };
        break;
      case "all":
      default: {
        const sekolah = await client.getSekolah();
        const peserta_didik = await client.getPesertaDidik();
        const gtk = await client.getGTK();
        const rombel = await client.getRombonganBelajar();
        data = { sekolah, peserta_didik, gtk, rombel };
        break;
      }
    }

    await logActivity(auth.user, "READ", "DapodikClient", `Tarik data Dapodik (${endpoint})`);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data Dapodik";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}