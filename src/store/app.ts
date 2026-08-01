import { create } from "zustand";
import type { SessionUser, SiteSettingItem } from "@/lib/types";

type AppState = {
  // routing
  route: string;
  setRoute: (r: string) => void;
  navigate: (r: string) => void;

  // auth
  user: SessionUser | null;
  authLoading: boolean;
  fetchMe: () => Promise<SessionUser | null>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: "SUPER_ADMIN" | "OPERATOR") => Promise<void>;

  // site settings cache
  settings: SiteSettingItem | null;
  settingsLoading: boolean;
  fetchSettings: (force?: boolean) => Promise<void>;
};

function currentHashRoute(): string {
  if (typeof window === "undefined") return "/";
  const h = window.location.hash.replace(/^#/, "");
  return h || "/";
}

/** Top-level App Router pages (each has its own route file under src/app). */
const APP_PAGE_ROUTES = new Set([
  "/",
  "/login",
  "/admin-login",
  "/dashboard",
  "/profile",
  "/academic",
  "/news",
  "/gallery",
  "/contact",
  "/complaint",
]);

/** True for real App Router pages, including the `/news/:slug` detail route. */
function isAppPageRoute(r: string): boolean {
  if (APP_PAGE_ROUTES.has(r)) return true;
  return r.startsWith("/news/");
}

export const useAppStore = create<AppState>((set, get) => ({
  route: "/",
  setRoute: (r) => set({ route: r }),
  navigate: (r) => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (isAppPageRoute(r)) {
        // Real App Router page — full navigation so the server renders it.
        if (path !== r) {
          window.location.href = r;
          return;
        }
        // Already on the target page — clear any stale hash sub-route so the
        // route store matches the pathname (e.g. back to Ringkasan on /dashboard).
        if (window.location.hash) {
          window.location.hash = "";
        }
        set({ route: r });
      } else if (currentHashRoute() === r) {
        set({ route: r });
      } else {
        window.location.hash = r;
      }
      // scroll to top on navigation
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } else {
      set({ route: r });
    }
  },

  user: null,
  authLoading: true,
  fetchMe: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      const user = data.user ?? null;
      set({ user, authLoading: false });
      return user;
    } catch {
      set({ user: null, authLoading: false });
      return null;
    }
  },
  login: async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Login gagal." };
    }
    set({ user: data.user });
    return { ok: true };
  },
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null });
    get().navigate("/login");
  },
  switchRole: async (role) => {
    const res = await fetch("/api/auth/switch-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const u = get().user;
      if (u) set({ user: { ...u, role } });
    }
  },

  settings: null,
  settingsLoading: false,
  fetchSettings: async (force?: boolean) => {
    // Skip re-fetch only if we already have settings AND force is not set.
    if (get().settings && !force) return;
    set({ settingsLoading: true });
    try {
      const res = await fetch("/api/site-settings", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      set({ settings: data, settingsLoading: false });
    } catch {
      set({ settingsLoading: false });
    }
  },
}));

/**
 * Subscribe to hashchange so the store route stays in sync with the URL.
 * Prefers the hash sub-route (e.g. `/dashboard#/dashboard/news`), falling back
 * to the App Router pathname for top-level pages (`/login`, `/dashboard`, …).
 * Returns a cleanup function so callers (e.g. RouteSync under React StrictMode)
 * can remove the listener and avoid double registration on remount.
 */
export function initHashRouter(): (() => void) | void {
  if (typeof window === "undefined") return;
  const apply = () => {
    const hash = currentHashRoute();
    const route = hash !== "/" ? hash : window.location.pathname || "/";
    useAppStore.getState().setRoute(route);
  };
  apply();
  window.addEventListener("hashchange", apply);
  return () => window.removeEventListener("hashchange", apply);
}
