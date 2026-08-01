"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { AdminLoginView } from "@/components/auth/admin-login-view";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const user = useAppStore((s) => s.user);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const router = useRouter();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (user?.role === "SUPER_ADMIN") return null;

  return <AdminLoginView />;
}
