"use client";

import { useEffect, useState } from "react";
import { Megaphone, Pause, Play } from "lucide-react";
import type { AnnouncementItem } from "@/lib/types";

export function RunningAnnouncements() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Pause marquee (WCAG 2.2.2 — konten bergerak otomatis perlu kontrol jeda).
  const [paused, setPaused] = useState(false);

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

  return (
    <div
      className="flex w-full items-center gap-3 bg-sidebar px-4 py-2 text-sidebar-foreground sm:px-6"
      role="region"
      aria-label="Pengumuman berjalan"
    >
      <span className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold sm:text-sm">
        <Megaphone className="size-4 text-gold" />
        <span className="hidden sm:inline">PENGUMUMAN:</span>
        <span className="sm:hidden">INFO:</span>
      </span>
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex w-max animate-marquee gap-10 whitespace-nowrap"
          // Inline style mengalahkan shorthand `animation:` dari .animate-marquee.
          style={paused ? { animationPlayState: "paused" } : undefined}
        >
          {items.map((a, idx) => (
            <span
              key={`${a.id}-${idx}`}
              className="inline-flex items-center gap-2 text-xs text-sidebar-foreground/90 sm:text-sm"
            >
              <span className="size-1.5 rounded-full bg-gold" />
              {a.title}
            </span>
          ))}
          {/* Salinan kedua hanya untuk loop animasi — disembunyikan dari screen reader. */}
          <div aria-hidden className="contents">
            {items.map((a, idx) => (
              <span
                key={`${a.id}-dup-${idx}`}
                className="inline-flex items-center gap-2 text-xs text-sidebar-foreground/90 sm:text-sm"
              >
                <span className="size-1.5 rounded-full bg-gold" />
                {a.title}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Putar pengumuman" : "Jeda pengumuman"}
        // Sembunyikan saat prefers-reduced-motion — animasi sudah mati.
        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:hidden"
      >
        {paused ? (
          <Play className="size-3.5" />
        ) : (
          <Pause className="size-3.5" />
        )}
      </button>
    </div>
  );
}
