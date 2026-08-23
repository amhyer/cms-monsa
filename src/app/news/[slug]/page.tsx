"use client";

import { useEffect, use } from "react";
import { useAppStore } from "@/store/app";
import { PublicSite } from "@/components/public/public-site";

export default function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const fetchSettings = useAppStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return <PublicSite initialView="news" initialSlug={slug} />;
}
