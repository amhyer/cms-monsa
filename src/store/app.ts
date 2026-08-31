import { create } from "zustand";
import type { SessionUser, SiteSettingItem } from "@/lib/types";

type AppState = {
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

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authLoading: true,
  fetchMe: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      const user = data.user ?? null;
      set({ user, authLoading: false });
      return user;
    } catch (e) {
      console.error("[store] fetchMe failed:", e);
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
    } catch (e) {
      console.error("[store] fetchSettings failed:", e);
      set({ settingsLoading: false });
    }
  },
}));
