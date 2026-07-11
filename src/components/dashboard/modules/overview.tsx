"use client";

import { useEffect, useState } from "react";
import {
  Newspaper,
  Megaphone,
  Users,
  Eye,
  ImageIcon,
  Trophy,
  Mail,
  MailOpen,
  FileText,
  Plus,
  ArrowRight,
  Activity,
  UserCircle2,
  CalendarDays,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoader, actionBadgeClass, actionLabel } from "../_shared";
import { relativeTime } from "@/lib/format";
import type { ActivityLogItem, ContactMessageItem } from "@/lib/types";

type Stats = {
  counts: {
    totalNews: number;
    publishedNews: number;
    draftNews: number;
    activeAnnouncements: number;
    teacherCount: number;
    galleryCount: number;
    achievementCount: number;
    unreadMessages: number;
    userCount: number;
    visits: number;
  };
  recentLogs: ActivityLogItem[];
  recentMessages: ContactMessageItem[];
};

const primaryCards = (s: Stats) => [
  {
    label: "Total Berita",
    value: s.counts.totalNews,
    icon: Newspaper,
    color: "bg-gold/15 text-gold-foreground",
  },
  {
    label: "Pengumuman Aktif",
    value: s.counts.activeAnnouncements,
    icon: Megaphone,
    color: "bg-primary/10 text-primary",
  },
  {
    label: "Jumlah Guru",
    value: s.counts.teacherCount,
    icon: Users,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Total Kunjungan",
    value: s.counts.visits.toLocaleString("id-ID"),
    icon: Eye,
    color: "bg-amber-100 text-amber-700",
  },
];

export function Overview() {
  const navigate = useAppStore((s) => s.navigate);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Stats;
        if (alive) setStats(data);
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <PageLoader label="Memuat ringkasan…" />;
  if (!stats) {
    return (
      <p className="text-sm text-muted-foreground">
        Gagal memuat statistik. Coba segarkan halaman.
      </p>
    );
  }

  const quickActions = [
    { label: "Tambah Berita", path: "/dashboard/news", icon: Newspaper },
    { label: "Buat Pengumuman", path: "/dashboard/announcements", icon: Megaphone },
    { label: "Jadwalkan Agenda", path: "/dashboard/agenda", icon: CalendarDays },
    { label: "Tambah Galeri", path: "/dashboard/gallery", icon: ImageIcon },
    { label: "Tambah Prestasi", path: "/dashboard/achievements", icon: Trophy },
  ];

  const secondary = [
    { label: "Berita Terbit", value: stats.counts.publishedNews, icon: FileText },
    { label: "Draf Berita", value: stats.counts.draftNews, icon: FileText },
    { label: "Galeri Media", value: stats.counts.galleryCount, icon: ImageIcon },
    { label: "Prestasi", value: stats.counts.achievementCount, icon: Trophy },
    { label: "Pesan Belum Dibaca", value: stats.counts.unreadMessages, icon: Mail },
    { label: "Pengguna", value: stats.counts.userCount, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Selamat datang kembali 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          Berikut ringkasan aktivitas dan statistik konten SMA Negeri 1 Nusantara.
        </p>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryCards(stats).map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="overflow-hidden">
              <CardContent className="flex items-center justify-between gap-4 py-5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {c.value}
                  </p>
                </div>
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full ${c.color}`}
                >
                  <Icon className="size-6" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secondary stat pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {secondary.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="py-3">
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="size-3.5" />
                  <span className="truncate">{s.label}</span>
                </div>
                <span className="text-lg font-bold">{s.value}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.path}
                variant="outline"
                size="sm"
                onClick={() => navigate(a.path)}
              >
                <Plus className="size-3.5" />
                {a.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Two columns: activity + messages */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-gold-foreground" />
              Aktivitas Terakhir
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/logs")}
            >
              Lihat semua <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentLogs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada aktivitas tercatat.
              </p>
            ) : (
              <ul className="max-h-[60vh] space-y-3 overflow-y-auto custom-scroll pr-1">
                {stats.recentLogs.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 text-sm">
                    <Badge className={`mt-0.5 shrink-0 ${actionBadgeClass(log.action)}`}>
                      {actionLabel(log.action)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">{log.entity}</span>
                        <span className="text-muted-foreground"> · {log.detail}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <UserCircle2 className="size-3" />
                        {log.userName} · {relativeTime(log.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-gold-foreground" />
              Pesan Masuk Terbaru
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/messages")}
            >
              Kelola <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentMessages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada pesan masuk.
              </p>
            ) : (
              <ul className="max-h-[60vh] space-y-3 overflow-y-auto custom-scroll pr-1">
                {stats.recentMessages.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-md border p-3 transition hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      {!m.isRead && (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full bg-gold"
                        />
                      )}
                      <p
                        className={`min-w-0 flex-1 truncate text-sm ${
                          m.isRead ? "font-medium" : "font-bold"
                        }`}
                      >
                        {m.subject}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {m.message}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      {m.isRead ? (
                        <MailOpen className="size-3" />
                      ) : (
                        <Mail className="size-3" />
                      )}
                      {m.name} · {m.email}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Overview;
