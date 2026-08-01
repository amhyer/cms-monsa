"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { LoginView } from "@/components/auth/login-view";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const user = useAppStore((s) => s.user);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const router = useRouter();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (user) return null;

  return <LoginView />;
}
