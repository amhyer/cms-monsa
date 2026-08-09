import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { runSync } from "@/lib/dapodik-sync";
import { logActivity } from "@/lib/log";

export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "commit" ? "commit" : "dry-run";

  try {
    const result = await runSync(mode);

    if (mode === "commit") {
      await logActivity(
        auth.user,
        "CREATE",
        "DapodikSync",
        `Sinkronisasi Dapodik (commit): ${result.siswa.created + result.siswa.updated} siswa, ${result.gtk.created + result.gtk.updated} guru, ${result.rombel.created + result.rombel.updated} rombel`
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal melakukan sinkronisasi";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Gunakan POST untuk sync." },
    { status: 405 }
  );
}
