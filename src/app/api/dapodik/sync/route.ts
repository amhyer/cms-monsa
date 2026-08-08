import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { runSync } from "@/lib/dapodik-sync";

export const dynamic = "force-dynamic";

// Sinkronisasi NYATA: tarik data Dapodik lalu tulis ke database CMS
// (Student, Teacher, Class). Melaporkan jumlah yang dibuat/diperbarui/error.
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const semesterId = body.semesterId ? String(body.semesterId) : undefined;

  try {
    const result = await runSync({
      semesterId,
      byUser: { id: auth.user.id, name: auth.user.name },
    });
    const c = result.counts;
    await logActivity(
      auth.user,
      "UPDATE",
      "Dapodik",
      `Sinkronisasi Dapodik (semester ${semesterId ?? "aktif"}): siswa ${c.siswa.update}+${c.siswa.create} (${c.siswa.error} error), guru ${c.gtk.update}+${c.gtk.create} (${c.gtk.error} error), rombel ${c.rombel.update}+${c.rombel.create}`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal sinkronisasi Dapodik";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
