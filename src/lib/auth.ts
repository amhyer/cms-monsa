import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "smansara_session";

/**
 * HMAC secret used to sign the session cookie so it cannot be tampered with.
 * In production this MUST be set via the AUTH_SECRET env var. A dev fallback
 * is provided so the app still runs locally without configuration.
 */
const SESSION_SECRET =
  process.env.AUTH_SECRET || "smansara-dev-secret-DO-NOT-USE-IN-PROD-9f2a7c1e";

type SessionPayload = {
  userId: string;
  activeRole: Role;
};

function b64encode(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64");
}

function b64decode(s: string): string {
  return Buffer.from(s, "base64").toString("utf-8");
}

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
}

/** Encode payload to a signed token: "base64(payload).hmac". */
function encode(payload: SessionPayload): string {
  const data = b64encode(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

/** Verify signature and return payload, or null if tampered/invalid. */
function decode(token: string): SessionPayload | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 1) return null;
    const data = token.slice(0, dot);
    const mac = token.slice(dot + 1);
    const expected = sign(data);
    if (mac.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const json = b64decode(data);
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
  // Clamp the active role: an operator cannot escalate to admin via switch-role
  // if their DB role is OPERATOR. (Switch-role mock only lets admin↔operator.)
  const dbRole = user.role as Role;
  const effectiveRole: Role =
    dbRole === "OPERATOR" ? "OPERATOR" : payload.activeRole;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole,
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
    secure: process.env.NODE_ENV === "production",
  });
}

export async function updateSessionRole(role: Role) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const payload = decode(token);
  if (!payload) return;
  // Prevent privilege escalation: operators cannot switch themselves to admin.
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user) return;
  const dbRole = user.role as Role;
  if (dbRole === "OPERATOR" && role === "SUPER_ADMIN") return;
  store.set(SESSION_COOKIE, encode({ ...payload, activeRole: role }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
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
