import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { getDapodikClient } from "@/lib/dapodik-sync";
import { logActivity } from "@/lib/log";

// Endpoint sementara untuk intip struktur field mentah dari Dapodik
// sebelum jalankan sync penuh. Aman dihapus setelah field sudah dikonfirmasi cocok.
export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const client = await getDapodikClient();

    // Dapodik lokal sering tidak tahan request paralel ke database-nya —
    // jadi dipanggil satu per satu (sequential), bukan Promise.all.
    const sekolah = await client.getSekolah();
    const siswa = await client.getPesertaDidik();
    const gtk = await client.getGTK();
    const rombel = await client.getRombonganBelajar();

    await logActivity(auth.user, "READ", "DapodikClient", "Preview struktur data Dapodik");

    return NextResponse.json({
      success: true,
      sekolah,
      totalSiswa: siswa.length,
      contohSiswa: siswa[0] ?? null,
      totalGtk: gtk.length,
      contohGtk: gtk[0] ?? null,
      totalRombel: rombel.length,
      contohRombel: rombel[0] ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data Dapodik";
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST untuk preview data Dapodik." },
    { status: 405 }
  );
}