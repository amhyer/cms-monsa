"use client";

/**
 * Client-side CSRF support.
 *
 * The API layer enforces CSRF on every state-changing request via
 * `requireCsrf` (see src/lib/csrf.ts). The token is stored in an httpOnly:false
 * cookie (`monsa_csrf`) so JS can read it. This module:
 *  1. ensures the cookie exists by calling GET /api/csrf-token once, and
 *  2. installs a small `window.fetch` interceptor that automatically attaches
 *     the token as the `x-csrf-token` header on non-safe requests.
 *
 * Install it once from a client component (RouteSync) — no per-call changes
 * needed in any manager component.
 */

const CSRF_COOKIE = "monsa_csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

let fetchingToken: Promise<string | null> | null = null;

/** Return the current CSRF token, fetching it once if the cookie is absent. */
export async function getCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  if (!fetchingToken) {
    fetchingToken = fetch("/api/csrf-token", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        return data?.token ?? readCookie(CSRF_COOKIE);
      })
      .catch(() => null)
      .finally(() => {
        fetchingToken = null;
      });
  }
  return fetchingToken;
}

let interceptorInstalled = false;

function isSameOriginRequest(input: RequestInfo | URL): boolean {
  if (typeof input === "string") {
    // Protocol-relative (`//host/...`) is cross-origin unless it matches ours.
    if (input.startsWith("//")) {
      return new URL(input, window.location.href).origin === window.location.origin;
    }
    // Bare path or scheme-less URL → same-origin relative request.
    if (input.startsWith("/") || !/^[a-z][a-z0-9+.-]*:/i.test(input)) {
      return true;
    }
    // Absolute http(s) URL → compare origins (covers absolute same-origin URLs).
    return new URL(input, window.location.href).origin === window.location.origin;
  }
  if (input instanceof URL) {
    return input.origin === window.location.origin;
  }
  return new URL(input.url, window.location.href).origin === window.location.origin;
}

/** Wrap window.fetch so same-origin state-changing requests carry the CSRF header. */
export function setupCsrfInterceptor(): void {
  if (typeof window === "undefined" || interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const method = (
      init?.method ??
      (typeof input === "object" && "method" in input ? input.method : undefined) ??
      "GET"
    ).toUpperCase();

    // Only inject the double-submit token for same-origin state-changing calls.
    if (!SAFE_METHODS.has(method) && isSameOriginRequest(input)) {
      const token = await getCsrfToken();
      if (token) {
        const headers = new Headers(
          init?.headers ??
            (typeof input === "object" && !(input instanceof URL)
              ? (input as Request).headers
              : undefined)
        );
        if (!headers.has(CSRF_HEADER)) {
          headers.set(CSRF_HEADER, token);
        }
        init = { ...init, headers };
      }
    }
    return originalFetch(input, init);
  };
}
