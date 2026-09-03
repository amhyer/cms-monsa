"use client";

import { useCallback, useEffect, useState } from "react";
import { Printer, FileBarChart, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/store/app";
import type { ClassItem } from "@/lib/types";
import { PageLoader, EmptyState } from "../_shared";

type AttendanceReportRow = {
  studentId: string;
  nis: string;
  name: string;
  gender: string | null;
  counts: { HADIR: number; SAKIT: number; IZIN: number; ALFA: number };
  total: number;
  rate: number | null;
};

function currentMonthInput(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}`;
}

export function ReportsManager() {
  const user = useAppStore((s) => s.user);
  const isGuru = user?.role === "GURU";
  const waliClassId = user?.guardianClassId ?? null;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [attClassId, setAttClassId] = useState<string>(waliClassId ?? "");
  const [attMonth, setAttMonth] = useState(currentMonthInput);
  const [attRows, setAttRows] = useState<AttendanceReportRow[]>([]);
  const [attMeta, setAttMeta] = useState<{ className: string; totalDays: number } | null>(null);
  const [attLoading, setAttLoading] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes?scope=admin", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      let items: ClassItem[] = data.items || [];
      if (isGuru && waliClassId) items = items.filter((c) => c.id === waliClassId);
      setClasses(items);
      if (items.length > 0) setAttClassId((prev) => prev || items[0].id);
    } catch {
    }
  }, [isGuru, waliClassId]);

  const fetchAttendanceReport = useCallback(async () => {
    if (!attClassId || !attMonth) return;
    setAttLoading(true);
    try {
      const res = await fetch(
        `/api/attendances/report?classId=${encodeURIComponent(attClassId)}&month=${attMonth}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat laporan");
      setAttRows(data.items || []);
      setAttMeta({ className: data.className, totalDays: data.totalDays });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat laporan absensi.");
      setAttRows([]);
      setAttMeta(null);
    } finally {
      setAttLoading(false);
    }
  }, [attClassId, attMonth]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchAttendanceReport();
  }, [fetchAttendanceReport]);

  return (
    <div className="space-y-4 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Laporan</h2>
          <p className="text-sm text-muted-foreground">
            Rekap absensi bulanan, siap cetak.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Cetak Laporan
        </Button>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">
            <CalendarDays className="size-4" /> Rekap Absensi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card className="print:hidden">
            <CardContent className="flex flex-wrap items-end gap-3 py-4">
              <div className="space-y-2">
                <Label>Kelas (Rombel)</Label>
                <Select value={attClassId} onValueChange={setAttClassId}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Input
                  type="month"
                  value={attMonth}
                  onChange={(e) => setAttMonth(e.target.value)}
                  className="w-44"
                />
              </div>
            </CardContent>
          </Card>

          <div className="print:hidden flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              Kelas: {attMeta?.className ?? "—"}
            </Badge>
            <Badge variant="outline">Hari tercatat: {attMeta?.totalDays ?? 0}</Badge>
            <Badge variant="outline">Siswa: {attRows.length}</Badge>
          </div>

          {attLoading ? (
            <PageLoader label="Menghitung rekap…" />
          ) : attRows.length === 0 ? (
            <EmptyState
              icon={FileBarChart}
              title="Belum ada data absensi"
              description="Isi kehadiran di menu Kehadiran, lalu laporan ini terisi otomatis."
            />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">No</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead className="text-center">Hadir</TableHead>
                      <TableHead className="text-center">Sakit</TableHead>
                      <TableHead className="text-center">Izin</TableHead>
                      <TableHead className="text-center">Alfa</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-right">Kehadiran</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attRows.map((r, idx) => (
                      <TableRow key={r.studentId}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-muted-foreground">{r.nis}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-center">{r.counts.HADIR}</TableCell>
                        <TableCell className="text-center">{r.counts.SAKIT}</TableCell>
                        <TableCell className="text-center">{r.counts.IZIN}</TableCell>
                        <TableCell className="text-center">{r.counts.ALFA}</TableCell>
                        <TableCell className="text-center">{r.total}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={
                              r.rate === null
                                ? "bg-muted text-muted-foreground"
                                : r.rate >= 90
                                  ? "bg-emerald-600 text-white"
                                  : r.rate >= 75
                                    ? "bg-amber-500 text-white"
                                    : "bg-rose-600 text-white"
                            }
                          >
                            {r.rate === null ? "—" : `${r.rate}%`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

export default ReportsManager;
