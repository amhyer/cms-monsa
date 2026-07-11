import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSessionRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import type { Role } from "@/lib/types";

/** Mock role switcher for testing RBAC without re-login. */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const target = String(body.role ?? "") as Role;
  if (target !== "SUPER_ADMIN" && target !== "OPERATOR") {
    return NextResponse.json(
      { error: "Role tidak valid." },
      { status: 400 }
    );
  }
  // Only allow switching within authenticated session (mock/testing feature).
  await updateSessionRole(target);
  await logActivity(user, "SWITCH", "Auth", `Mengganti peran aktif ke ${target}`);
  return NextResponse.json({ role: target });
}
