"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { PublicSite } from "@/components/public/public-site";

export default function StrukturOrganisasiPage() {
  const fetchSettings = useAppStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return <PublicSite initialView="struktur-organisasi" />;
}