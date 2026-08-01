import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const user = await getSession();
  if (user) {
    await logActivity(user, "LOGOUT", "Auth", "Logout dari sistem");
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
