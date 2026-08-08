import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { getDapodikClient } from "@/lib/dapodik-sync";

export const dynamic = "force-dynamic";

// Tarik data mentah dari Dapodik untuk ditampilkan di halaman (tanpa menulis
// ke database). Endpoint: "sekolah" | "siswa" | "gtk" | "rombel" | "all".
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint ?? "all");
  const semesterId = body.semesterId ? String(body.semesterId) : undefined;

  try {
    const client = await getDapodikClient();
    switch (endpoint) {
      case "sekolah": {
        const sekolah = await client.getSekolah();
        return NextResponse.json({ success: true, sekolah });
      }
      case "siswa": {
        const peserta_didik = await client.getPesertaDidik(semesterId);
        return NextResponse.json({ success: true, peserta_didik });
      }
      case "gtk": {
        const gtk = await client.getGTK(semesterId);
        return NextResponse.json({ success: true, gtk });
      }
      case "rombel": {
        const rombel = await client.getRombonganBelajar(semesterId);
        return NextResponse.json({ success: true, rombel });
      }
      default: {
        const all = await client.getAllData(semesterId);
        await logActivity(auth.user, "UPDATE", "Dapodik", `Tarik data Dapodik (semester ${semesterId ?? "aktif"}): ${all.peserta_didik.length} siswa, ${all.gtk.length} guru, ${all.rombel.length} rombel`);
        return NextResponse.json({ success: true, ...all });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal menarik data dari Dapodik";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
