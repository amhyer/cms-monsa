"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Loader2,
  Save,
  CheckCircle2,
  Stethoscope,
  FileText,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
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
import type { AttendanceRow, AttendanceStatus, ClassItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { PageLoader, EmptyState, toDateInputValue } from "../_shared";

const STATUSES: { value: AttendanceStatus; label: string; icon: typeof CheckCircle2; active: string }[] = [
  { value: "HADIR", label: "Hadir", icon: CheckCircle2, active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "SAKIT", label: "Sakit", icon: Stethoscope, active: "bg-amber-500 text-white border-amber-500" },
  { value: "IZIN", label: "Izin", icon: FileText, active: "bg-blue-600 text-white border-blue-600" },
  { value: "ALFA", label: "Alfa", icon: UserX, active: "bg-rose-600 text-white border-rose-600" },
];

export function AttendanceManager() {
  const user = useAppStore((s) => s.user);
  const isGuru = user?.role === "GURU";
  const waliClassId = user?.guardianClassId ?? null;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState<string>(waliClassId ?? "");
  const [date, setDate] = useState<string>(() =>
    toDateInputValue(new Date().toISOString())
  );

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes?scope=admin", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      let items: ClassItem[] = data.items || [];
      if (isGuru && waliClassId) {
        items = items.filter((c) => c.id === waliClassId);
      }
      setClasses(items);
      if (items.length > 0) {
        setClassId((prev) => prev || items[0].id);
      }
    } catch {
      // non-critical
    }
  }, [isGuru, waliClassId]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const fetchAttendance = useCallback(async (cid: string, d: string) => {
    if (!cid || !d) return;
    setLoading(true);
    setLoaded(false);
    try {
      const res = await fetch(
        `/api/attendances?classId=${encodeURIComponent(cid)}&date=${encodeURIComponent(d)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const items: AttendanceRow[] = data.items || [];
      setRows(items);
      const st: Record<string, AttendanceStatus> = {};
      const nt: Record<string, string> = {};
      for (const it of items) {
        st[it.studentId] = it.status ?? "HADIR";
        nt[it.studentId] = it.note ?? "";
      }
      setStatuses(st);
      setNotes(nt);
      setLoaded(true);
    } catch {
      toast.error("Gagal memuat data kehadiran.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (classId && date) fetchAttendance(classId, date);
  }, [classId, date, fetchAttendance]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, ALFA: 0 };
    for (const s of Object.values(statuses)) counts[s] = (counts[s] ?? 0) + 1;
    return counts;
  }, [statuses]);

  async function handleSaveAll() {
    if (!classId || !date || rows.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendances/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          date,
          records: rows.map((r) => ({
            studentId: r.studentId,
            status: statuses[r.studentId] ?? "HADIR",
            note: notes[r.studentId]?.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(`Kehadiran ${data.saved} siswa tersimpan untuk tanggal ${date}.`);
      fetchAttendance(classId, date);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan kehadiran.");
    } finally {
      setSaving(false);
    }
  }

  const className = classes.find((c) => c.id === classId)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Kehadiran (Absensi)</h2>
          <p className="text-sm text-muted-foreground">
            Catat kehadiran siswa harian per rombongan belajar.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-2">
            <Label>Kelas (Rombel)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} • {c.academicYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="att-date">Tanggal</Label>
            <Input
              id="att-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Badge className="bg-emerald-600 text-white">Hadir: {summary.HADIR}</Badge>
            <Badge className="bg-amber-500 text-white">Sakit: {summary.SAKIT}</Badge>
            <Badge className="bg-blue-600 text-white">Izin: {summary.IZIN}</Badge>
            <Badge className="bg-rose-600 text-white">Alfa: {summary.ALFA}</Badge>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <PageLoader label="Memuat daftar siswa…" />
      ) : loaded && rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Belum ada siswa di kelas ini"
          description="Tambahkan siswa ke kelas ini lewat menu Data Siswa."
        />
      ) : (
        rows.length > 0 && (
          <>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">No</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Orang Tua / Wali</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-44">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow key={r.studentId}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.nis}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.parentName || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {STATUSES.map((s) => {
                              const Icon = s.icon;
                              const active = statuses[r.studentId] === s.value;
                              return (
                                <Button
                                  key={s.value}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={cn(
                                    "h-7 gap-1 px-2 text-xs",
                                    active && s.active
                                  )}
                                  onClick={() =>
                                    setStatuses((prev) => ({ ...prev, [r.studentId]: s.value }))
                                  }
                                  aria-pressed={active}
                                >
                                  <Icon className="size-3.5" />
                                  {s.label}
                                </Button>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={notes[r.studentId] ?? ""}
                            onChange={(e) =>
                              setNotes((prev) => ({ ...prev, [r.studentId]: e.target.value }))
                            }
                            placeholder="Catatan (opsional)"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {rows.length} siswa • {className} • {date}
              </p>
              <Button
                onClick={handleSaveAll}
                disabled={saving || rows.length === 0}
                className="bg-gold text-gold-foreground hover:bg-gold/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan…
                  </>
                ) : (
                  <>
                    <Save className="size-4" /> Simpan Semua
                  </>
                )}
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}

export default AttendanceManager;
