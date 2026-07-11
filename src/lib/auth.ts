import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "smansara_session";

type SessionPayload = {
  userId: string;
  activeRole: Role;
};

function encode(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

function decode(token: string): SessionPayload | null {
  try {
    const json = Buffer.from(token, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as SessionPayload;
    if (!parsed.userId || !parsed.activeRole) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = decode(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: payload.activeRole,
    isActive: user.isActive,
  };
}

export async function setSession(userId: string, role: Role) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encode({ userId, activeRole: role }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function updateSessionRole(role: Role) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const payload = decode(token);
  if (!payload) return;
  store.set(SESSION_COOKIE, encode({ ...payload, activeRole: role }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Require any authenticated user. Returns 401 JSON response if not. */
export async function requireAuth(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const user = await getSession();
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user };
}

/** Require a specific minimum role. SUPER_ADMIN can do everything an OPERATOR can. */
export async function requireRole(
  min: Role
): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const allowed =
    min === "OPERATOR"
      ? true // any authenticated user
      : auth.user.role === "SUPER_ADMIN";
  if (!allowed) {
    return {
      ok: false,
      response: Response.json(
        { error: "Forbidden. Hak akses tidak mencukupi." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user: auth.user };
}

export function hasRole(user: SessionUser | null, min: Role): boolean {
  if (!user) return false;
  if (min === "OPERATOR") return true;
  return user.role === "SUPER_ADMIN";
}
