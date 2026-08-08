"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  LogOut,
  User,
  CalendarCheck2,
  CalendarX2,
  BookOpenCheck,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

type StudentInfo = {
  id: string;
  nisn: string | null;
  name: string;
  gender: string | null;
  className: string;
  grade: string;
  academicYear: string;
  parentName: string | null;
};

type AttendanceSummary = {
  monthLabel: string;
  total: number;
  summary: Record<string, number>;
};

type AttendanceRow = {
  id: string;
  date: string;
  status: string;
  note: string | null;
};

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  HADIR: { label: "Hadir", className: "bg-emerald-600 text-white" },
  SAKIT: { label: "Sakit", className: "bg-amber-500 text-white" },
  IZIN: { label: "Izin", className: "bg-sky-600 text-white" },
  ALFA: { label: "Alpa", className: "bg-rose-600 text-white" },
};

function statusStyle(status: string) {
  return STATUS_STYLE[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
}

export function ParentPortal() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.settings);
  const logout = useAppStore((s) => s.logout);

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [overview, setOverview] = useState<AttendanceSummary | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [rowsSummary, setRowsSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigasi bulan untuk riwayat absensi.
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/parent", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat data.");
      setStudent(data.student);
      setOverview(data.attendance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    try {
      const res = await fetch(`/api/parent/attendance?month=${month}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat absensi.");
      setRows(data.items || []);
      setRowsSummary(data.summary || {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat absensi.");
    }
  }, [month]);

  useEffect(() => {
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  }, [month]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function handleLogout() {
    await logout();
    toast.success("Anda telah keluar.");
    router.replace("/login");
  }

  const total = rows.length;
  const hadir = rowsSummary.HADIR ?? 0;
  const attendanceRate = total > 0 ? Math.round((hadir / total) * 100) : 0;

  const schoolName = settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md text-center">
          <CardHeader className="items-center">
            <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-7" />
            </div>
            <CardTitle>Data Tidak Tersedia</CardTitle>
            <CardDescription>
              {error ??
                "Akun belum ditautkan ke data siswa. Silakan hubungi admin sekolah."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLogout}>Keluar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <GraduationCap className="size-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold">{schoolName}</span>
            <span className="text-[11px] text-muted-foreground">
              Portal Orang Tua · {user?.name}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/")}
            className="hidden sm:inline-flex"
          >
            <ExternalLink className="size-4" /> Lihat Situs
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" /> Keluar
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        {/* Profil anak */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-gold via-amber-400 to-gold" />
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                <User className="size-8" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Data Siswa
                </p>
                <h1 className="truncate text-2xl font-bold tracking-tight">
                  {student.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{student.className}</Badge>
                  {student.nisn && (
                    <Badge variant="outline" className="font-mono">
                      NISN {student.nisn}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Tahun Ajaran {student.academicYear}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ringkasan absensi bulan berjalan */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<CalendarCheck2 className="size-5" />}
            label="Hadir"
            value={overview?.summary.HADIR ?? 0}
            tone="emerald"
          />
          <StatCard
            icon={<BookOpenCheck className="size-5" />}
            label="Sakit"
            value={overview?.summary.SAKIT ?? 0}
            tone="amber"
          />
          <StatCard
            icon={<CalendarCheck2 className="size-5" />}
            label="Izin"
            value={overview?.summary.IZIN ?? 0}
            tone="sky"
          />
          <StatCard
            icon={<CalendarX2 className="size-5" />}
            label="Alpa"
            value={overview?.summary.ALFA ?? 0}
            tone="rose"
          />
        </div>

        {/* Riwayat absensi */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Riwayat Absensi</CardTitle>
              <CardDescription>
                {monthLabel} · Kehadiran {attendanceRate}%
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CalendarX2 className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Belum ada catatan absensi pada {monthLabel.toLowerCase()}.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="table-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const s = statusStyle(r.status);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap font-medium">
                              {formatDate(r.date)}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(s.className)}>{s.label}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.note || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Placeholder nilai e-rapor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpenCheck className="size-5 text-gold" /> Nilai (E-Rapor)
            </CardTitle>
            <CardDescription>
              Nilai rapor anak akan tersedia di sini setelah integrasi dengan
              e-Rapor Dapodik diaktifkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              <BookOpenCheck className="size-5 shrink-0" />
              <p>
                Segera hadir — penarikan data nilai dari e-Rapor akan
                menampilkan nilai per mata pelajaran dan deskripsi capaian.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {schoolName} · Portal Orang Tua
        </p>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "sky" | "rose";
}) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-500",
    sky: "text-sky-600",
    rose: "text-rose-600",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <span className={cn("flex size-10 items-center justify-center rounded-lg bg-muted", tones[tone])}>
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
