import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CSRF_COOKIE = "monsa_csrf";
const CSRF_HEADER = "x-csrf-token";
const TOKEN_LENGTH = 32;
const MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Generate a new CSRF token and set it as a cookie.
 * Returns the token string.
 */
export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(TOKEN_LENGTH).toString("hex");
  const store = await cookies();
  store.set(CSRF_COOKIE, token, {
    httpOnly: false, // Must be readable by JavaScript
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return token;
}

/**
 * Get the current CSRF token from cookie.
 * Returns null if no token exists.
 */
export async function getCsrfToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? null;
}

/**
 * Validate the CSRF token from the request header against the cookie.
 * Returns true if valid, false otherwise.
 */
export async function validateCsrfToken(req: Request): Promise<boolean> {
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);

  // Both must exist
  if (!cookieToken || !headerToken) return false;

  // Must be same length (timing-safe comparison)
  if (cookieToken.length !== headerToken.length) return false;

  // Timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(cookieToken, "utf-8"),
      Buffer.from(headerToken, "utf-8")
    );
  } catch {
    return false;
  }
}

/**
 * Require valid CSRF token for state-changing requests.
 * Returns null if valid, or a NextResponse with 403 if invalid.
 * Skips validation for GET/HEAD/OPTIONS and public endpoints.
 */
export async function requireCsrf(
  req: Request
): Promise<NextResponse | null> {
  const method = req.method.toUpperCase();

  // Safe methods don't need CSRF
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  // Skip CSRF for public endpoints that don't require auth
  const url = new URL(req.url);
  const publicPaths = [
    "/api/auth/login",
    "/api/complaints",  // POST is public submission
    "/api/contact",     // Public contact form
    "/api/dapodik/ingest", // jembatan PC sekolah (Bearer pairing, bukan cookie)
  ];
  const isPublicPost = method === "POST" && publicPaths.some(p => url.pathname === p || url.pathname.startsWith(p + "/"));
  if (isPublicPost) {
    return null;
  }

  const isValid = await validateCsrfToken(req);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid atau kadaluarsa CSRF token. Silakan muat ulang halaman." },
      { status: 403 }
    );
  }
  return null;
}
