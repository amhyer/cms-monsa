"use client";

import { useEffect, useState } from "react";

type TeacherSection = {
  id: string;
  title: string;
  content: string;
  icon: string | null;
  order: number;
  isVisible: boolean;
};

type SectionRendererProps = {
  teacherId: string;
};

export function SectionRenderer({ teacherId }: SectionRendererProps) {
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/teachers/${teacherId}/sections`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setSections(data.filter((s: TeacherSection) => s.isVisible));
        }
      } catch {
        // Ignore error
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 bg-muted animate-pulse rounded-lg" />
        <div className="h-24 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div
          key={section.id}
          className="rounded-lg border border-gold/20 bg-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{section.icon || "📝"}</span>
            <h3 className="font-semibold text-foreground">{section.title}</h3>
          </div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {section.content}
          </div>
        </div>
      ))}
    </div>
  );
}
