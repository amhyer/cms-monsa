"use client";

import { useEffect, useState } from "react";
import { Calendar, Award, Star, Trophy, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimelineItem {
  id: string;
  title: string;
  description: string | null;
  date: string;
  type: "achievement" | "certification" | "training" | "other";
}

interface TeacherTimelineProps {
  teacherId: string;
}

const typeConfig = {
  achievement: {
    icon: Trophy,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    label: "Prestasi",
  },
  certification: {
    icon: Award,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Sertifikasi",
  },
  training: {
    icon: GraduationCap,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Pelatihan",
  },
  other: {
    icon: Star,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Lainnya",
  },
};

export function TeacherTimeline({ teacherId }: TeacherTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, [teacherId]);

  async function fetchTimeline() {
    try {
      const res = await fetch(`/api/teachers/${teacherId}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="size-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-sans text-base font-bold">
        <Calendar className="size-4 text-primary" /> Linimasa Prestasi
      </h2>
      <div className="relative space-y-4">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        {items.map((item) => {
          const config = typeConfig[item.type] || typeConfig.other;
          const Icon = config.icon;
          return (
            <div key={item.id} className="relative flex gap-4">
              {/* Icon */}
              <div
                className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
              >
                <Icon className={`size-5 ${config.color}`} />
              </div>
              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {item.title}
                  </h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {config.label}
                  </Badge>
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
