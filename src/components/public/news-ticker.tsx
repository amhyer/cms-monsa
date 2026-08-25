"use client";

import { useState, useEffect } from "react";
import { Megaphone, Info, Award, Calendar, AlertTriangle } from "lucide-react";

interface TickerItem {
  id: string;
  content: string;
  category: string;
  link: string | null;
  priority: number;
}

interface NewsTickerProps {
  className?: string;
}

const categoryConfig: Record<string, { icon: typeof Info; color: string }> = {
  "Info": { icon: Info, color: "text-blue-500" },
  "Prestasi": { icon: Award, color: "text-yellow-500" },
  "Jadwal": { icon: Calendar, color: "text-green-500" },
  "Penting": { icon: AlertTriangle, color: "text-red-500" },
};

export function NewsTicker({ className = "" }: NewsTickerProps) {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchTickers();
  }, []);

  useEffect(() => {
    if (tickers.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tickers.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [tickers.length]);

  async function fetchTickers() {
    try {
      const res = await fetch("/api/ticker");
      if (res.ok) {
        const data = await res.json();
        setTickers(data.tickers || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }

  if (loading || tickers.length === 0) {
    return null;
  }

  const currentItem = tickers[currentIndex];
  const config = categoryConfig[currentItem.category] || categoryConfig["Info"];
  const Icon = config.icon;

  return (
    <div className={`bg-sidebar text-sidebar-foreground ${className}`}>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <div className="flex shrink-0 items-center gap-2 text-gold">
          <Megaphone className="size-4" />
          <span className="text-xs font-semibold uppercase">Info</span>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <Icon className={`size-4 shrink-0 ${config.color}`} />
            {currentItem.link ? (
              <a
                href={currentItem.link}
                className="truncate text-sm hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {currentItem.content}
              </a>
            ) : (
              <span className="truncate text-sm">{currentItem.content}</span>
            )}
          </div>
        </div>

        {/* Dots indicator */}
        {tickers.length > 1 && (
          <div className="hidden items-center gap-1 sm:flex">
            {tickers.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`size-1.5 rounded-full transition-all ${
                  index === currentIndex
                    ? "bg-gold w-3"
                    : "bg-sidebar-foreground/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
