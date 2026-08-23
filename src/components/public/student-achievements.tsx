"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Award, Star, Calendar, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  category: string;
  level: string;
  date: string;
  certificate: string | null;
  issuedBy: string | null;
}

interface AchievementStats {
  category: string;
  count: number;
}

interface StudentAchievementsProps {
  studentId: string;
}

const categoryConfig: Record<string, { icon: typeof Trophy; color: string; bgColor: string }> = {
  "Akademik": { icon: Trophy, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  "Non-Akademik": { icon: Medal, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  "Olahraga": { icon: Star, color: "text-green-500", bgColor: "bg-green-500/10" },
  "Seni": { icon: Award, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  "Teknologi": { icon: Star, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
};

const levelColors: Record<string, string> = {
  "Sekolah": "bg-gray-100 text-gray-700",
  "Kecamatan": "bg-blue-100 text-blue-700",
  "Kabupaten": "bg-green-100 text-green-700",
  "Provinsi": "bg-yellow-100 text-yellow-700",
  "Nasional": "bg-red-100 text-red-700",
  "Internasional": "bg-purple-100 text-purple-700",
};

export function StudentAchievements({ studentId }: StudentAchievementsProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchAchievements();
  }, [studentId]);

  async function fetchAchievements() {
    try {
      const res = await fetch(`/api/students/${studentId}/achievements`);
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements || []);
        setStats(data.stats || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }

  const filteredAchievements = filter === "all"
    ? achievements
    : achievements.filter((a) => a.category === filter);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (achievements.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold">
          <Trophy className="size-4 text-yellow-500" /> Prestasi Siswa
        </h2>
        <Badge variant="secondary">{achievements.length} prestasi</Badge>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.map((s) => (
            <Badge key={s.category} variant="outline" className="text-xs">
              {s.category}: {s.count}
            </Badge>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Semua
        </Button>
        {stats.map((s) => (
          <Button
            key={s.category}
            size="sm"
            variant={filter === s.category ? "default" : "outline"}
            onClick={() => setFilter(s.category)}
          >
            {s.category}
          </Button>
        ))}
      </div>

      {/* Achievements List */}
      <div className="mt-4 space-y-3">
        {filteredAchievements.map((achievement) => {
          const config = categoryConfig[achievement.category] || categoryConfig["Akademik"];
          const Icon = config.icon;
          return (
            <div
              key={achievement.id}
              className="flex items-start gap-3 rounded-lg border bg-background p-3"
            >
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                <Icon className={`size-5 ${config.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{achievement.title}</h4>
                  <Badge className={`text-[10px] ${levelColors[achievement.level] || ""}`}>
                    {achievement.level}
                  </Badge>
                </div>
                {achievement.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {achievement.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(achievement.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {achievement.issuedBy && (
                    <span>oleh {achievement.issuedBy}</span>
                  )}
                </div>
              </div>
              {achievement.certificate && (
                <a href={achievement.certificate} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" className="gap-1">
                    <ExternalLink className="size-3" />
                  </Button>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
