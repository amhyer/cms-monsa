"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Save, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DAYS, type Day } from "@/lib/schedule-constants";
import { SCHEDULE_TEMPLATES } from "@/lib/schedule-templates";
import type { ScheduleEntryItem, ClassItem, TeacherItem } from "@/lib/types";
import { exportToCsv, exportScheduleToPdf } from "@/lib/export";
import { PageLoader } from "../_shared";

const MAX_SLOTS = 8;

function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() < 6 ? `${y - 1}/${y}` : `${y}/${y + 1}`;
}

const SUBJECT_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
];

function subjectColor(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

type FormState = {
  day: Day;
  timeSlot: number;
  timeLabel: string;
  subject: string;
  teacherId: string;
  roomId: string;
  classId: string;
  academicYear: string;
};

const EMPTY_FORM: FormState = {
  day: "Senin",
  timeSlot: 1,
  timeLabel: "",
  subject: "",
  teacherId: "",
  roomId: "",
  classId: "",
  academicYear: currentAcademicYear(),
};

export function ScheduleManager() {
  const [entries, setEntries] = useState<ScheduleEntryItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("all");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [slotCount, setSlotCount] = useState(7);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntryItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(SCHEDULE_TEMPLATES[0].id);
  const [templateClassId, setTemplateClassId] = useState("");
  const [importing, setImporting] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYear });
      if (classFilter !== "all") params.set("classId", classFilter);
      const res = await fetch(`/api/schedule?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.items || []);
      const maxSlot = Math.max(7, ...((data.items || []) as ScheduleEntryItem[]).map((e) => e.timeSlot));
      setSlotCount(Math.min(maxSlot, MAX_SLOTS));
    } catch {
      toast.error("Gagal memuat jadwal pelajaran.");
    } finally {
      setLoading(false);
    }
  }, [classFilter, academicYear]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes?scope=admin&limit=200", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setClasses(data.items || []);
    } catch { /* non-critical */ }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch("/api/teachers?scope=admin&limit=500", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTeachers(data.items || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchClasses(); fetchTeachers(); }, [fetchClasses, fetchTeachers]);

  const grid = useMemo(() => {
    const map = new Map<string, ScheduleEntryItem>();
    for (const e of entries) map.set(`${e.day}-${e.timeSlot}`, e);
    return map;
  }, [entries]);

  const academicYears = useMemo(() => {
    const s = new Set([currentAcademicYear(), ...entries.map((e) => e.academicYear)]);
    return Array.from(s).sort().reverse();
  }, [entries]);

  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) m.set(c.id, c.name);
    return m;
  }, [classes]);

  function openCreate(day: Day, timeSlot: number) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, day, timeSlot, classId: classFilter === "all" ? "" : classFilter, academicYear });
    setOpen(true);
  }

  function openEdit(entry: ScheduleEntryItem) {
    setEditing(entry);
    setForm({
      day: entry.day as Day,
      timeSlot: entry.timeSlot,
      timeLabel: entry.timeLabel ?? "",
      subject: entry.subject,
      teacherId: entry.teacherId ?? "",
      roomId: entry.roomId ?? "",
      classId: entry.classId ?? "",
      academicYear: entry.academicYear,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.subject.trim()) {
      toast.error("Mata pelajaran wajib diisi.");
      return;
    }
    if (!form.academicYear.trim()) {
      toast.error("Tahun ajaran wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        day: form.day,
        timeSlot: form.timeSlot,
        timeLabel: form.timeLabel.trim() || null,
        subject: form.subject.trim(),
        teacherId: form.teacherId || null,
        roomId: form.roomId.trim() || null,
        classId: form.classId || null,
        academicYear: form.academicYear.trim(),
      };
      const res = editing
        ? await fetch(`/api/schedule/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Jadwal diperbarui." : "Jadwal ditambahkan.");
      setOpen(false);
      fetchEntries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function moveEntry(entryId: string, newDay: string, newSlot: number) {
    const target = grid.get(`${newDay}-${newSlot}`);
    const source = entries.find((e) => e.id === entryId);
    if (!source) return;
    // Drop ke cell yang sama — no-op
    if (source.day === newDay && source.timeSlot === newSlot) return;

    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id === entryId) return { ...e, day: newDay, timeSlot: newSlot };
        if (target && e.id === target.id) return { ...e, day: source.day, timeSlot: source.timeSlot };
        return e;
      })
    );

    const bodies: Promise<Response>[] = [
      fetch(`/api/schedule/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...source, day: newDay, timeSlot: newSlot }),
      }),
    ];
    if (target) {
      bodies.push(
        fetch(`/api/schedule/${target.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...target, day: source.day, timeSlot: source.timeSlot }),
        })
      );
    }

    const results = await Promise.all(bodies);
    const failed = results.find((r) => !r.ok);
    if (failed) {
      toast.error("Gagal memindahkan jadwal.");
      fetchEntries();
    } else {
      toast.success(target ? "Jadwal ditukar." : "Jadwal dipindahkan.");
    }
  }

  async function handleDelete(entry: ScheduleEntryItem) {
    try {
      const res = await fetch(`/api/schedule/${entry.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Jadwal dihapus.");
      fetchEntries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  async function handleImportTemplate() {
    const tpl = SCHEDULE_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setImporting(true);
    try {
      const res = await fetch("/api/schedule/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: tpl.entries.map((e) => ({
            ...e,
            classId: templateClassId || null,
            academicYear,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal import");
      toast.success(`Import selesai: ${data.imported} ditambahkan, ${data.skipped} dilewati.`);
      setTemplateOpen(false);
      fetchEntries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal import template.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Jadwal Pelajaran</h2>
          <p className="text-sm text-muted-foreground">
            Klik sel kosong (+) untuk menambah, klik jadwal untuk mengedit. Seret jadwal untuk memindahkan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedTemplateId(SCHEDULE_TEMPLATES[0].id); setTemplateClassId(classFilter === "all" ? "" : classFilter); setTemplateOpen(true); }}>
            <Plus className="size-4" /> Import Template
          </Button>
          <Button variant="outline" size="sm" disabled={entries.length === 0}
            onClick={() => {
              exportToCsv(
                `jadwal-${classFilter === "all" ? "semua" : classFilter}-${academicYear}`,
                entries.map((e) => ({
                  day: e.day,
                  timeSlot: e.timeSlot,
                  timeLabel: e.timeLabel ?? "",
                  subject: e.subject,
                  teacherName: e.teacherName ?? "",
                  roomId: e.roomId ?? "",
                  academicYear: e.academicYear,
                })),
                [
                  { key: "day", label: "Hari" },
                  { key: "timeSlot", label: "Jam ke-" },
                  { key: "timeLabel", label: "Waktu" },
                  { key: "subject", label: "Mata Pelajaran" },
                  { key: "teacherName", label: "Guru" },
                  { key: "roomId", label: "Ruang" },
                  { key: "academicYear", label: "Tahun Ajaran" },
                ]
              );
              toast.success("Jadwal diekspor ke CSV.");
            }}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" disabled={entries.length === 0}
            onClick={() => {
              const cls = classFilter === "all" ? "Semua Kelas" : classMap.get(classFilter) ?? classFilter;
              exportScheduleToPdf({ entries, days: DAYS, className: cls, academicYear });
              toast.success("Jadwal diekspor ke PDF.");
            }}>
            <Download className="size-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label className="text-xs">Tahun Ajaran</Label>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {academicYears.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kelas</Label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Jam ke-</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" onClick={() => setSlotCount((s) => Math.max(1, s - 1))} disabled={slotCount <= 1}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">{slotCount}</span>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setSlotCount((s) => Math.min(MAX_SLOTS, s + 1))} disabled={slotCount >= MAX_SLOTS}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto">
          {classFilter === "all" ? "Semua Kelas" : classMap.get(classFilter) ?? classFilter} — {academicYear} · {entries.length} jadwal
        </Badge>
      </div>

      {/* Grid */}
      {loading ? (
        <PageLoader label="Memuat jadwal…" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-24 border px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Jam ke-</th>
                {DAYS.map((day) => (
                  <th key={day} className="border px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: slotCount }, (_, i) => i + 1).map((slot) => (
                <tr key={slot}>
                  <td className="border bg-muted/30 px-2 py-1 text-center font-semibold text-muted-foreground">
                    <div className="text-xs">Jam {slot}</div>
                    {(() => {
                      const firstEntry = entries.find((e) => e.timeSlot === slot && e.timeLabel);
                      return firstEntry?.timeLabel ? (
                        <div className="text-[10px] text-muted-foreground/70">{firstEntry.timeLabel}</div>
                      ) : null;
                    })()}
                  </td>
                  {DAYS.map((day) => {
                    const entry = grid.get(`${day}-${slot}`);
                    return (
                      <td key={`${day}-${slot}`} className={`border px-1 py-1 transition ${overCell === `${day}-${slot}` && dragId ? "bg-primary/10 ring-2 ring-inset ring-primary/40" : ""}`} onDragOver={(e) => { e.preventDefault(); setOverCell(`${day}-${slot}`); }} onDragLeave={() => setOverCell(null)} onDrop={(e) => { e.preventDefault(); setOverCell(null); setDragId(null); const id = e.dataTransfer.getData("text/plain"); if (id) moveEntry(id, day, slot); }}>
                        {entry ? (
                          <div
                            draggable="true"
                            onDragStart={(e) => { e.dataTransfer.setData("text/plain", entry.id); e.dataTransfer.effectAllowed = "move"; setDragId(entry.id); }}
                            onDragEnd={() => { setDragId(null); setOverCell(null); }}
                            className={`group relative flex cursor-grab flex-col rounded-md px-2 py-1.5 transition hover:ring-2 hover:ring-primary/50 ${subjectColor(entry.subject)} ${dragId === entry.id ? "opacity-40" : ""}`}
                            onClick={() => openEdit(entry)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(entry); } }}
                          >
                            <span className="text-xs font-semibold leading-tight line-clamp-2">{entry.subject}</span>
                            {entry.teacherName && (
                              <span className="mt-0.5 text-[10px] leading-tight opacity-75 line-clamp-1">{entry.teacherName}</span>
                            )}
                            {entry.roomId && (
                              <span className="text-[10px] leading-tight opacity-60 line-clamp-1">📍 {entry.roomId}</span>
                            )}
                            <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                              <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(entry); }} className="rounded bg-background/80 p-0.5 text-muted-foreground hover:text-foreground" aria-label="Edit jadwal">
                                <Pencil className="size-3" />
                              </button>
                              <ConfirmDialog
                                trigger={<button type="button" onClick={(e) => e.stopPropagation()} className="rounded bg-background/80 p-0.5 text-destructive hover:text-destructive" aria-label="Hapus jadwal"><Trash2 className="size-3" /></button>}
                                title="Hapus Jadwal"
                                description={`Hapus jadwal "${entry.subject}" hari ${entry.day} jam ${entry.timeSlot}?`}
                                confirmText="Hapus"
                                onConfirm={() => handleDelete(entry)}
                              />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCreate(day, slot)}
                            className="flex h-full min-h-[48px] w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/20 text-muted-foreground/40 transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary/60"
                            aria-label={`Tambah jadwal ${day} jam ${slot}`}
                          >
                            <Plus className="size-4" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Jadwal" : "Tambah Jadwal"}</DialogTitle>
            <DialogDescription>
              {editing ? `Mengedit jadwal ${editing.day} jam ${editing.timeSlot}.` : "Menambahkan jadwal baru."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hari *</Label>
                <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v as Day })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jam ke- *</Label>
                <Select value={String(form.timeSlot)} onValueChange={(v) => setForm({ ...form, timeSlot: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).map((s) => (
                      <SelectItem key={s} value={String(s)}>Jam {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-time-label">Label Waktu (opsional)</Label>
              <Input id="sched-time-label" value={form.timeLabel} onChange={(e) => setForm({ ...form, timeLabel: e.target.value })} placeholder="Misal: 07.00–07.35" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-subject">Mata Pelajaran *</Label>
              <Input id="sched-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Misal: Matematika, Bahasa Indonesia…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Guru Pengampu</Label>
                <Select value={form.teacherId || "none"} onValueChange={(v) => setForm({ ...form, teacherId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sched-room">Ruang / Lokasi</Label>
                <Input id="sched-room" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} placeholder="Misal: R.1, Aula…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kelas</Label>
                <Select value={form.classId || "none"} onValueChange={(v) => setForm({ ...form, classId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sched-year">Tahun Ajaran *</Label>
                <Input id="sched-year" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} placeholder="2025/2026" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="size-4 animate-spin" /> Menyimpan…</> : <><Save className="size-4" /> Simpan</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Import Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Template Jadwal</DialogTitle>
            <DialogDescription>
              Pilih template standar SD. Slot yang sudah terisi tidak akan ditimpa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const tpl = SCHEDULE_TEMPLATES.find((t) => t.id === selectedTemplateId);
                return tpl ? (
                  <p className="text-xs text-muted-foreground">{tpl.description} · {tpl.entries.length} slot</p>
                ) : null;
              })()}
            </div>
            <div className="space-y-2">
              <Label>Target Kelas (opsional)</Label>
              <Select value={templateClassId || "none"} onValueChange={(v) => setTemplateClassId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Tanpa kelas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Semua Kelas —</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)} disabled={importing}>Batal</Button>
            <Button onClick={handleImportTemplate} disabled={importing}>
              {importing ? <><Loader2 className="size-4 animate-spin" /> Mengimport…</> : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ScheduleManager;
