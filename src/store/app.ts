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
  fetchSettings: () => Promise<void>;
};

function currentHashRoute(): string {
  if (typeof window === "undefined") return "/";
  const h = window.location.hash.replace(/^#/, "");
  return h || "/";
}

export const useAppStore = create<AppState>((set, get) => ({
  route: "/",
  setRoute: (r) => set({ route: r }),
  navigate: (r) => {
    if (typeof window !== "undefined") {
      if (currentHashRoute() === r) {
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
  fetchSettings: async () => {
    if (get().settings) return;
    set({ settingsLoading: true });
    try {
      const res = await fetch("/api/site-settings", { cache: "no-store" });
      const data = await res.json();
      set({ settings: data, settingsLoading: false });
    } catch {
      set({ settingsLoading: false });
    }
  },
}));

/** Subscribe to hashchange so the store route stays in sync with the URL. */
export function initHashRouter() {
  if (typeof window === "undefined") return;
  const apply = () => useAppStore.getState().setRoute(currentHashRoute());
  apply();
  window.addEventListener("hashchange", apply);
}
