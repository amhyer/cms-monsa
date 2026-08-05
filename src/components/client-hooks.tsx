"use client";

import { useEffect } from "react";
import { setupCsrfInterceptor } from "@/lib/csrf-client";

/**
 * Installs global client hooks exactly once, mounted inside the root layout.
 *
 * The old RouteSync also subscribed to `hashchange` (initHashRouter) to keep
 * the store route in sync — that was removed with the App Router migration
 * (refactor 1A–1C). Routing is now fully handled by Next.js (usePathname /
 * useRouter), so the only remaining global hook is the CSRF fetch interceptor
 * that makes every state-changing API call send the `x-csrf-token` header.
 */
export function ClientHooks() {
  useEffect(() => {
    setupCsrfInterceptor();
  }, []);
  return null;
}

export default ClientHooks;
