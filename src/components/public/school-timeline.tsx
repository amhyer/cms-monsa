"use client";

import { useState, useEffect } from "react";
import { Calendar, Award, Building, Star, GraduationCap } from "lucide-react";

interface TimelineItem {
  id: string;
  year: number;
  month: number | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
}

interface SchoolTimelineProps {
  limit?: number;
}

const categoryConfig: Record<string, { icon: typeof Star; color: string; bgColor: string }> = {
  "Pencapaian": { icon: Award, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  "Pembangunan": { icon: Building, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  "Penghargaan": { icon: Star, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  "Peristiwa": { icon: Calendar, color: "text-green-500", bgColor: "bg-green-500/10" },
};

export function SchoolTimeline({ limit = 20 }: SchoolTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedTimeline, setGroupedTimeline] = useState<Record<number, TimelineItem[]>>({});

  useEffect(() => {
    fetchTimeline();
  }, []);

  async function fetchTimeline() {
    try {
      const res = await fetch(`/api/timeline?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline || []);
        setGroupedTimeline(data.groupedByYear || {});
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 w-48 rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="h-12 w-24 rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const years = Object.keys(groupedTimeline)
    .map(Number)
    .sort((a, b) => b - a);

  if (years.length === 0) {
    return null;
  }

  const monthNames = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-sans text-base font-bold">
        <Calendar className="size-4 text-primary" /> Sejarah Sekolah
      </h2>

      <div className="mt-4 space-y-8">
        {years.map((year) => (
          <div key={year}>
            {/* Year Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-sm font-bold">{year}</span>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Timeline Items */}
            <div className="relative ml-6 space-y-4 border-l-2 border-border pl-6">
              {groupedTimeline[year]?.map((item) => {
                const config = categoryConfig[item.category] || categoryConfig["Peristiwa"];
                const Icon = config.icon;
                return (
                  <div key={item.id} className="relative">
                    {/* Dot */}
                    <div className={`absolute -left-[31px] flex size-6 items-center justify-center rounded-full ${config.bgColor}`}>
                      <Icon className={`size-3 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="rounded-lg border bg-background p-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{item.title}</h4>
                        <span className={`text-[10px] ${config.color}`}>
                          {item.category}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      {item.month && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {monthNames[item.month]} {item.year}
                        </p>
                      )}
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="mt-2 h-24 w-full rounded object-cover"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
