"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  GraduationCap,
  ClipboardCheck,
  CheckCircle2,
  Stethoscope,
  UserX,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    studentCount: number;
    classCount: number;
    visits: number;
    userRoleCounts: {
      all: number;
      STAFF: number;
      GURU: number;
      ORANG_TUA: number;
      SISWA: number;
    };
  };
  attendance: {
    hadir: number;
    sakit: number;
    izin: number;
    alfa: number;
    total: number;
  };
  recentLogs: ActivityLogItem[];
  recentMessages: ContactMessageItem[];
};

const primaryCards = (s: Stats, isGuru: boolean) => [
  {
    label: isGuru ? "Siswa Saya" : "Total Siswa",
    value: s.counts.studentCount,
    icon: GraduationCap,
    color:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    label: isGuru ? "Kelas Saya" : "Total Kelas",
    value: s.counts.classCount,
    icon: Users,
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    label: "Total Berita",
    value: s.counts.totalNews,
    icon: Newspaper,
    color: "bg-gold/15 text-gold-foreground",
  },
  {
    label: "Total Kunjungan",
    value: s.counts.visits.toLocaleString("id-ID"),
    icon: Eye,
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
];

export function Overview() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const isGuru = user?.role === "GURU";
  const isAdmin = user?.role === "SUPER_ADMIN";

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
    { label: "Catat Kehadiran", path: "/dashboard/attendance", icon: ClipboardCheck, show: true },
    { label: "Tambah Berita", path: "/dashboard/news", icon: Newspaper, show: !isGuru },
    { label: "Buat Pengumuman", path: "/dashboard/announcements", icon: Megaphone, show: !isGuru },
    { label: "Jadwalkan Agenda", path: "/dashboard/agenda", icon: CalendarDays, show: !isGuru },
    { label: "Tambah Siswa", path: "/dashboard/students", icon: Plus, show: !isGuru },
  ].filter((a) => a.show);

  const secondary = [
    { label: "Pengumuman Aktif", value: stats.counts.activeAnnouncements, icon: Megaphone },
    { label: "Prestasi", value: stats.counts.achievementCount, icon: Trophy },
    { label: "Galeri Media", value: stats.counts.galleryCount, icon: ImageIcon },
    { label: "Pesan Baru", value: stats.counts.unreadMessages, icon: Mail },
    { label: "Guru & Staf", value: stats.counts.teacherCount, icon: Users, hide: isGuru },
  ].filter((s) => !s.hide);

  // Peran akun — sama dengan tab users page (Semua / Admin & Operator / Guru /
  // Orang Tua / Siswa) agar ringkasan konsisten dengan Manajemen Akun.
  const rolePills = [
    { label: "Admin & Operator", value: stats.counts.userRoleCounts.STAFF, icon: UserCircle2 },
    { label: "Akun Guru", value: stats.counts.userRoleCounts.GURU, icon: GraduationCap },
    { label: "Akun Orang Tua", value: stats.counts.userRoleCounts.ORANG_TUA, icon: Users },
    { label: "Akun Siswa", value: stats.counts.userRoleCounts.SISWA, icon: GraduationCap },
    { label: "Total Akun", value: stats.counts.userRoleCounts.all, icon: UserCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Selamat datang kembali, {user?.name} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          {isGuru
            ? "Berikut ringkasan kelas wali dan aktivitas Anda hari ini."
            : "Berikut ringkasan aktivitas dan statistik SD Negeri Unggulan Mongisidi 1."}
        </p>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {primaryCards(stats, isGuru).map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="overflow-hidden">
              <CardContent className="flex items-center justify-between gap-3 py-4 sm:gap-4 sm:py-5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
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

      {/* Attendance Highlight */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-indigo-100 bg-indigo-50/30 dark:border-indigo-500/20 dark:bg-indigo-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-indigo-900 dark:text-indigo-200">
              <ClipboardCheck className="size-4" />
              Kehadiran Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.attendance.total === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-indigo-600/70 dark:text-indigo-300/70">Belum ada absensi hari ini.</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="mt-1 text-indigo-600 dark:text-indigo-300"
                  onClick={() => router.push("/dashboard/attendance")}
                >
                  Buka Absensi <ArrowRight className="ml-1 size-3" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col items-center gap-1 rounded-lg bg-emerald-100/50 p-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CheckCircle2 className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.hadir}</span>
                  <span className="text-[10px] font-medium uppercase">Hadir</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-amber-100/50 p-2 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <Stethoscope className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.sakit}</span>
                  <span className="text-[10px] font-medium uppercase">Sakit</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-100/50 p-2 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <FileText className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.izin}</span>
                  <span className="text-[10px] font-medium uppercase">Izin</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-rose-100/50 p-2 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  <UserX className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.alfa}</span>
                  <span className="text-[10px] font-medium uppercase">Alfa</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Secondary stat pills */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
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

      {/* Peran akun — konsisten dengan tab Manajemen Akun (khusus admin) */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rolePills.map((r) => {
            const Icon = r.icon;
            return (
              <Card
                key={r.label}
                className="cursor-pointer py-3 transition hover:border-gold/50 hover:shadow-sm"
                onClick={() => router.push("/dashboard/users")}
              >
                <CardContent className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="size-3.5" />
                    <span className="truncate">{r.label}</span>
                  </div>
                  <span className="text-lg font-bold">{r.value}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="text-base">Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5 sm:gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.path}
                variant="outline"
                size="sm"
                onClick={() => router.push(a.path)}
              >
                <Icon className="size-3.5" />
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
              onClick={() => router.push("/dashboard/logs")}
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
              onClick={() => router.push("/dashboard/messages")}
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
