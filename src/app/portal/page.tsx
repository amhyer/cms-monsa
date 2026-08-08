"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { ParentPortal } from "@/components/portal/parent-portal";
import { useRouter } from "next/navigation";

export default function PortalPage() {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const fetchMe = useAppStore((s) => s.fetchMe);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const router = useRouter();

  useEffect(() => {
    fetchMe();
    fetchSettings();
  }, [fetchMe, fetchSettings]);

  // Guard: hanya ORANG_TUA yang boleh di sini; yang lain (sudah login)
  // diarahkan ke dashboard agar tidak terjadi round-trip ke /login.
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "ORANG_TUA") {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Memuat portal…</p>
        </div>
      </div>
    );
  }

  return <ParentPortal />;
}
