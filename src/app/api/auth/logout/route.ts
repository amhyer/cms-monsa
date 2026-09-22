import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { withErrorHandling } from "@/lib/api-helpers";

async function POST_impl(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const user = await getSession();
  if (user) {
    await logActivity(user, "LOGOUT", "Auth", "Logout dari sistem");
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(POST_impl);
