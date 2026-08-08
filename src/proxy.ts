import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * CORS handling for /api/* routes.
 *
 * Policy:
 * - No Origin header (curl, server-to-server, same-origin navigation) → allow.
 * - Same-origin requests (Origin matches the Host the client hit) → allow.
 * - Cross-origin requests from origins listed in ALLOWED_ORIGINS (comma
 *   separated env var) → allow and echo CORS headers.
 * - Any other cross-origin request → 403. Browsers block the response anyway,
 *   but rejecting early is defence-in-depth (plus CSRF already guards writes).
 */
export function handleApiCors(params: {
  origin: string | null;
  method: string;
  proto: string;
  host: string;
  allowedOrigins: string[];
}): NextResponse | null {
  const { origin, method, proto, host, allowedOrigins } = params;
  // No Origin header → not a browser CORS request.
  if (!origin) return null;
  const requestOrigin = `${proto}://${host}`;
  const isSameOrigin = origin === requestOrigin;
  if (isSameOrigin) return null;
  const isAllowed = allowedOrigins.includes(origin);
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
    "Access-Control-Max-Age": "86400",
  };
  if (isAllowed) {
    if (method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders)) {
      res.headers.set(k, v);
    }
    return res;
  }
  // Unknown cross-origin origin → reject.
  return NextResponse.json(
    { error: "Origin tidak diizinkan." },
    { status: 403 }
  );
}

/**
 * Auth guard for /dashboard/* routes.
 * Redirects unauthenticated users to /login, preserving the intended
 * destination via a `redirect` query param.
 */
async function handleDashboardAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return null;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const authResponse = await handleDashboardAuth(req);
    return authResponse ?? NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    const origin = req.headers.get("origin");
    const proto =
      req.headers.get("x-forwarded-proto") ??
      req.nextUrl.protocol.replace(":", "");
    const host = req.headers.get("host") ?? req.nextUrl.host;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      handleApiCors({ origin, method: req.method, proto, host, allowedOrigins }) ??
      NextResponse.next()
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};