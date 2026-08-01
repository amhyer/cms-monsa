"use client";

import { useEffect } from "react";
import { initHashRouter } from "@/store/app";
import { setupCsrfInterceptor } from "@/lib/csrf-client";

/**
 * Installs global client hooks exactly once, mounted inside the root layout:
 *  1. hashchange → store route sync (public site + dashboard), and
 *  2. the CSRF fetch interceptor so all state-changing API calls send the
 *     `x-csrf-token` header (the API layer enforces CSRF on POST/PUT/DELETE).
 */
export function RouteSync() {
  useEffect(() => {
    // Cleanup the hashchange listener on unmount (React StrictMode in dev
    // double-mounts effects, which would otherwise register it twice).
    const cleanup = initHashRouter();
    setupCsrfInterceptor();
    return cleanup;
  }, []);
  return null;
}

export default RouteSync;
