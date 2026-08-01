"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardPage() {
  const fetchMe = useAppStore((s) => s.fetchMe);
  const fetchSettings = useAppStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchMe();
    fetchSettings();
  }, [fetchMe, fetchSettings]);

  return <DashboardShell />;
}
