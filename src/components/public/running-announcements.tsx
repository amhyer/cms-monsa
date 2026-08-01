"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import type { AnnouncementItem } from "@/lib/types";

export function RunningAnnouncements() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/announcements?scope=public", {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || items.length === 0) return null;

  // Build the marquee track (duplicate twice for seamless loop)
  const track = [...items, ...items];

  return (
    <div
      className="flex w-full items-center gap-3 bg-primary px-4 py-2 text-primary-foreground sm:px-6"
      role="region"
      aria-label="Pengumuman berjalan"
    >
      <span className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold sm:text-sm">
        <Megaphone className="size-4 text-gold" />
        <span className="hidden sm:inline">PENGUMUMAN:</span>
        <span className="sm:hidden">INFO:</span>
      </span>
      <div className="relative flex-1 overflow-hidden">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {track.map((a, idx) => (
            <span
              key={`${a.id}-${idx}`}
              className="inline-flex items-center gap-2 text-xs text-primary-foreground/90 sm:text-sm"
            >
              <span className="size-1.5 rounded-full bg-gold" />
              {a.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
