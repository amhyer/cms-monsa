import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getDapodikClient } from "@/lib/dapodik-sync";

export const dynamic = "force-dynamic";

// Daftar periode semester yang benar-benar tersedia di Dapodik lokal,
// dikumpulkan dari nilai semester_id pada data (peserta didik + rombel).
// Dipakai dropdown periode agar hanya menampilkan semester yang ada datanya.
export async function GET() {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const client = await getDapodikClient();
    // counts berisi jumlah siswa & rombel per semester untuk badge di dropdown.
    const { semesters, counts } = await client.getSemestersWithCounts();
    return NextResponse.json({ success: true, semesters, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat daftar semester";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
