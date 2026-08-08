import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSessionRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { ROLES, type Role } from "@/lib/types";

const VALID_ROLES = Object.keys(ROLES);

/** Mock role switcher for testing RBAC without re-login. */
export async function POST(req: NextRequest) {
  // Dev-only mock (REFACTOR_PLAN #7 / SECURITY_AUDIT H4): tidak boleh aktif di produksi.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }
  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Hanya SUPER_ADMIN yang boleh mengganti peran." },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const target = String(body.role ?? "") as Role;
  if (!VALID_ROLES.includes(target)) {
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
