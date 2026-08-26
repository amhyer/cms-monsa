"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, AlertTriangle, Info, Calendar, Eye, Pin, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Announcement {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string;
  priority: string;
  imageUrl: string | null;
  isPinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  targetAudience: string;
  createdAt: string;
}

interface AnnouncementSystemProps {
  limit?: number;
  showAll?: boolean;
}

const priorityConfig: Record<string, { icon: typeof Bell; color: string; bgColor: string; label: string }> = {
  "LOW": { icon: Info, color: "text-gray-600", bgColor: "bg-gray-100", label: "Rendah" },
  "NORMAL": { icon: Info, color: "text-blue-600", bgColor: "bg-blue-100", label: "Normal" },
  "HIGH": { icon: AlertTriangle, color: "text-yellow-600", bgColor: "bg-yellow-100", label: "Tinggi" },
  "URGENT": { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-100", label: "Mendesak" },
};

const categoryConfig: Record<string, { color: string; bgColor: string }> = {
  "Info": { color: "text-blue-600", bgColor: "bg-blue-100" },
  "Penting": { color: "text-red-600", bgColor: "bg-red-100" },
  "Jadwal": { color: "text-green-600", bgColor: "bg-green-100" },
  "Akademik": { color: "text-purple-600", bgColor: "bg-purple-100" },
  "Keuangan": { color: "text-yellow-600", bgColor: "bg-yellow-100" },
};

export function AnnouncementSystem({ limit = 10 }: AnnouncementSystemProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch(`/api/announcements?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const filteredAnnouncements = filter === "all"
    ? announcements
    : announcements.filter((a) => a.category === filter);

  // Sort: pinned first, then by priority, then by date
  const sortedAnnouncements = [...filteredAnnouncements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold">
          <Bell className="size-4 text-primary" /> Pengumuman
        </h2>
        {announcements.length > 0 && (
          <Badge variant="secondary">{announcements.length} pengumuman</Badge>
        )}
      </div>

      {/* Filter */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Semua
        </Button>
        {Object.keys(categoryConfig).map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={filter === cat ? "default" : "outline"}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Announcements List */}
      <div className="mt-4 space-y-3">
        {sortedAnnouncements.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Tidak ada pengumuman.
          </p>
        ) : (
          sortedAnnouncements.map((announcement) => {
            const priority = priorityConfig[announcement.priority] || priorityConfig["NORMAL"];
            const PriorityIcon = priority.icon;
            const category = categoryConfig[announcement.category] || categoryConfig["Info"];
            const isExpanded = expandedId === announcement.id;

            return (
              <div
                key={announcement.id}
                className={`rounded-lg border bg-background p-4 transition-all ${
                  announcement.isPinned ? "border-primary/50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${priority.bgColor}`}>
                    <PriorityIcon className={`size-5 ${priority.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{announcement.title}</h4>
                      {announcement.isPinned && (
                        <Pin className="size-3 text-primary" />
                      )}
                      <Badge variant="outline" className={`text-[10px] ${category.color}`}>
                        {announcement.category}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${priority.color}`}>
                        {priority.label}
                      </Badge>
                    </div>

                    {/* Summary or Content */}
                    <div className="mt-2">
                      {isExpanded ? (
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-line text-sm text-muted-foreground">
                            {announcement.content}
                          </p>
                        </div>
                      ) : (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {announcement.summary || announcement.content}
                        </p>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {announcement.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(announcement.publishedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {announcement.viewCount} dilihat
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {announcement.targetAudience}
                      </Badge>
                    </div>

                    {/* Expand Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 gap-1 text-xs"
                      onClick={() => setExpandedId(isExpanded ? null : announcement.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="size-3" /> Lebih sedikit
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3" /> Baca selengkapnya
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
