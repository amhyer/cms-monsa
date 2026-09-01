import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { issueBridgeToken, revokeBridgeToken } from "@/lib/dapodik-bridge";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Buat (atau ganti) kunci pairing aplikasi jembatan. Token utuh hanya di respons ini. */
export async function POST(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const { token, prefix } = await issueBridgeToken();
  await logActivity(
    auth.user,
    "UPDATE",
    "DapodikConfig",
    `Kunci pairing jembatan Dapodik dibuat (${prefix}…)`
  );

  return NextResponse.json({
    ok: true,
    token,
    prefix,
    message: "Simpan kunci ini sekarang. Setelah jendela ditutup, kunci tidak ditampilkan lagi.",
  });
}

/** Cabut kunci pairing. Aplikasi jembatan tidak bisa mengirim sampai kunci baru dibuat. */
export async function DELETE(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  await revokeBridgeToken();
  await logActivity(auth.user, "UPDATE", "DapodikConfig", "Kunci pairing jembatan Dapodik dicabut");

  return NextResponse.json({ ok: true, message: "Kunci pairing dicabut." });
}
