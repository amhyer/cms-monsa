import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/types";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-monsa_session" : "monsa_session";

const DEFAULT_DEV_SECRET = "monsa-dev-secret-DO-NOT-USE-IN-PROD-9f2a7c1e";

/**
 * HMAC secret used to sign the session cookie so it cannot be tampered with.
 * MUST be set via the AUTH_SECRET env var in production.
 */
function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error(
      "[AUTH] CRITICAL: AUTH_SECRET tidak di-set. " +
      "Session cookies tidak akan aman. " +
      "Set AUTH_SECRET di .env atau environment variables."
    );
    // Use dev fallback only in development, throw in production
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET harus di-set untuk production environment. " +
        "Generate dengan: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    console.warn("[AUTH] Menggunakan dev fallback secret. JANGAN gunakan di production!");
    return DEFAULT_DEV_SECRET;
  }
  if (secret === DEFAULT_DEV_SECRET) {
    console.warn(
      "[AUTH] WARNING: AUTH_SECRET masih menggunakan default dev value. " +
      "Generate secret baru untuk keamanan: " +
      "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}

const SESSION_SECRET = getSessionSecret();

type SessionPayload = {
  userId: string;
  activeRole: Role;
  /** Server-side session creation timestamp (ms since epoch). */
  createdAt: number;
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

/** Verify signature and return payload, or null if tampered/expired/invalid. */
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
    // H3: server-side session expiry check (7 days)
    const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    if (parsed.createdAt && Date.now() - parsed.createdAt > SESSION_MAX_AGE_MS) {
      return null; // Session expired server-side
    }
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
  // The DB role is the source of truth: only SUPER_ADMIN may keep the
  // role stored in the cookie (the switch-role mock). OPERATOR and GURU
  // can never escalate by tampering with the cookie.
  const dbRole = user.role as Role;
  const effectiveRole: Role =
    dbRole === "SUPER_ADMIN" ? payload.activeRole : dbRole;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole,
    isActive: user.isActive,
    guardianClassId: user.guardianClassId ?? null,
    guardianStudentId: user.guardianStudentId ?? null,
  };
}

export async function setSession(userId: string, role: Role) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encode({ userId, activeRole: role, createdAt: Date.now() }), {
    httpOnly: true,
    // "lax" in production blocks CSRF via cross-site requests; "none" is only
    // used in development so the cookie is sent when the app runs inside the
    // cross-origin preview iframe. Browsers treat localhost as a secure
    // context, so Secure cookies work in local dev too.
    sameSite: process.env.NODE_ENV === "production" ? "lax" : "none",
    secure: true,
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
  // Only SUPER_ADMIN may switch roles; OPERATOR/GURU cannot escalate.
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== "SUPER_ADMIN") return;
  store.set(SESSION_COOKIE, encode({ ...payload, activeRole: role }), {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "lax" : "none",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  // __Host- prefix cookies need path=/ to delete; Next.js cookies.delete
  // handles this automatically.
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

/**
 * Role hierarchy: SUPER_ADMIN (3) > OPERATOR (2) > GURU (1).
 * ORANG_TUA (0) tidak punya akses dashboard — hanya portal orang tua.
 * `requireRole(min)` passes when the user's level is >= the minimum level.
 */
const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 3,
  OPERATOR: 2,
  GURU: 1,
  ORANG_TUA: 0,
  SISWA: 0,
};

/** Require a specific minimum role. SUPER_ADMIN can do everything an OPERATOR can. */
export async function requireRole(
  min: Role
): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (ROLE_LEVEL[auth.user.role] < ROLE_LEVEL[min]) {
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
  return ROLE_LEVEL[user.role] >= ROLE_LEVEL[min];
}

/** A GURU may only work with their own wali class; other roles are unrestricted. */
export function canAccessClass(user: SessionUser, classId: string): boolean {
  if (user.role === "GURU") return user.guardianClassId === classId;
  return true;
}

/**
 * Guard untuk Portal Orang Tua (API /api/parent/* dan halaman /portal).
 * Hanya akun role ORANG_TUA yang tertaut ke siswa (guardianStudentId) yang
 * lolos. Nilai studentId diambil dari session — tidak pernah dari input user.
 */
export async function requireParent(): Promise<
  { ok: true; user: SessionUser; studentId: string } | { ok: false; response: Response }
> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  if (auth.user.role !== "ORANG_TUA" || !auth.user.isActive) {
    return {
      ok: false,
      response: Response.json(
        { error: "Forbidden. Hanya akun orang tua yang dapat mengakses portal." },
        { status: 403 }
      ),
    };
  }
  if (!auth.user.guardianStudentId) {
    return {
      ok: false,
      response: Response.json(
        { error: "Akun belum ditautkan ke siswa. Hubungi operator sekolah." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user: auth.user, studentId: auth.user.guardianStudentId };
}
