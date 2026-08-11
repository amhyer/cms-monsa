"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { PublicSite } from "@/components/public/public-site";

export default function TransparansiPage() {
  const fetchSettings = useAppStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return <PublicSite initialView="transparansi" />;
}
