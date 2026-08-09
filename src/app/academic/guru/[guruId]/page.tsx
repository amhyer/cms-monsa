"use client";

import { useEffect, use } from "react";
import { useAppStore } from "@/store/app";
import { PublicSite } from "@/components/public/public-site";

export default function TeacherPortfolioPage({
  params,
}: {
  params: Promise<{ guruId: string }>;
}) {
  const { guruId } = use(params);
  const fetchSettings = useAppStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return <PublicSite initialView="teacher" initialGuruId={guruId} />;
}