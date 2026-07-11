import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/log";

export async function POST() {
  const user = await getSession();
  if (user) {
    await logActivity(user, "LOGOUT", "Auth", "Logout dari sistem");
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
