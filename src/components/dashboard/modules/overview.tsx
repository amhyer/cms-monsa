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
  GraduationCap,
  ClipboardCheck,
  Wallet,
  CheckCircle2,
  Stethoscope,
  UserX,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader, actionBadgeClass, actionLabel } from "../_shared";
import { relativeTime, formatCurrency } from "@/lib/format";
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
  };
  attendance: {
    hadir: number;
    sakit: number;
    izin: number;
    alfa: number;
    total: number;
  };
  payments?: {
    monthPeriod: string;
    totalAmount: number;
  } | null;
  recentLogs: ActivityLogItem[];
  recentMessages: ContactMessageItem[];
};

const primaryCards = (s: Stats, isGuru: boolean) => [
  {
    label: isGuru ? "Siswa Saya" : "Total Siswa",
    value: s.counts.studentCount,
    icon: GraduationCap,
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    label: isGuru ? "Kelas Saya" : "Total Kelas",
    value: s.counts.classCount,
    icon: Users,
    color: "bg-emerald-100 text-emerald-700",
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
    color: "bg-amber-100 text-amber-700",
  },
];

export function Overview() {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const isGuru = user?.role === "GURU";

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
    { label: "User Admin", value: stats.counts.userCount, icon: UserCircle2, hide: isGuru },
  ].filter((s) => !s.hide);

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryCards(stats, isGuru).map((c) => {
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

      {/* Attendance & Payment Highlight */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-indigo-900">
              <ClipboardCheck className="size-4" />
              Kehadiran Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.attendance.total === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-indigo-600/70">Belum ada absensi hari ini.</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="mt-1 text-indigo-600"
                  onClick={() => navigate("/dashboard/attendance")}
                >
                  Buka Absensi <ArrowRight className="ml-1 size-3" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col items-center gap-1 rounded-lg bg-emerald-100/50 p-2 text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.hadir}</span>
                  <span className="text-[10px] font-medium uppercase">Hadir</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-amber-100/50 p-2 text-amber-700">
                  <Stethoscope className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.sakit}</span>
                  <span className="text-[10px] font-medium uppercase">Sakit</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-100/50 p-2 text-blue-700">
                  <FileText className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.izin}</span>
                  <span className="text-[10px] font-medium uppercase">Izin</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg bg-rose-100/50 p-2 text-rose-700">
                  <UserX className="size-4" />
                  <span className="text-lg font-bold">{stats.attendance.alfa}</span>
                  <span className="text-[10px] font-medium uppercase">Alfa</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!isGuru && stats.payments && (
          <Card className="border-emerald-100 bg-emerald-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-emerald-900">
                <Wallet className="size-4" />
                Pendapatan Bulan Ini ({stats.payments.monthPeriod})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(stats.payments.totalAmount)}
                </p>
                <p className="text-xs text-emerald-600/80">
                  Total iuran terkumpul periode berjalan.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                onClick={() => navigate("/dashboard/payments")}
              >
                Detail
              </Button>
            </CardContent>
          </Card>
        )}
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
