"use client";

import { useEffect } from "react";
import { useAppStore, initHashRouter } from "@/store/app";
import { PublicSite } from "@/components/public/public-site";
import { LoginView } from "@/components/auth/login-view";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function Home() {
  const route = useAppStore((s) => s.route);
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const fetchMe = useAppStore((s) => s.fetchMe);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    initHashRouter();
    fetchMe();
    fetchSettings();
  }, [fetchMe, fetchSettings]);

  // While initial auth check is running, show a branded loader.
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            Memuat SMA Negeri 1 Nusantara…
          </p>
        </div>
      </div>
    );
  }

  // --- Route resolution (hash-based, single-page) ---
  // /login -> LoginView (redirect to /dashboard if already authenticated)
  // /dashboard* -> DashboardShell (handles its own auth guard)
  // everything else -> public site
  if (route === "/login") {
    if (user) {
      navigate("/dashboard");
      return null;
    }
    return <LoginView />;
  }

  if (route === "/dashboard" || route.startsWith("/dashboard/")) {
    return <DashboardShell />;
  }

  return <PublicSite />;
}
