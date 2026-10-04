"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app";
import { type Day } from "@/lib/schedule-constants";
import { SCHEDULE_TEMPLATES } from "@/lib/schedule-templates";
import type { ScheduleEntryItem, ClassItem, TeacherItem } from "@/lib/types";
import { PageLoader } from "../../_shared";
import { MAX_SLOTS, currentAcademicYear } from "./schedule-helpers";
import { EMPTY_FORM, type FormState } from "./form-state";
import { ScheduleToolbar } from "./schedule-toolbar";
import { ScheduleFilters } from "./schedule-filters";
import { ScheduleTable } from "./schedule-table";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import { ScheduleTemplateDialog } from "./schedule-template-dialog";

export type { FormState };
export { EMPTY_FORM };
export { MAX_SLOTS, currentAcademicYear, SUBJECT_COLORS, subjectColor } from "./schedule-helpers";
export { ScheduleToolbar } from "./schedule-toolbar";
export { ScheduleFilters } from "./schedule-filters";
export { ScheduleTable } from "./schedule-table";
export { ScheduleFormDialog } from "./schedule-form-dialog";
export { ScheduleTemplateDialog } from "./schedule-template-dialog";

/* ------------------------------------------------------------------ */
/* Schedule Manager                                                    */
/* ------------------------------------------------------------------ */

export function ScheduleManager() {
  const user = useAppStore((s) => s.user);
  // Guru wali kelas terkunci ke kelasnya (API juga memaksa di server);
  // guru mapel (tanpa kelas wali) tetap melihat semua kelas.
  const waliClassId =
    user?.role === "GURU" ? (user.guardianClassId ?? null) : null;
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
      const effectiveFilter = waliClassId ?? classFilter;
      const params = new URLSearchParams({ academicYear });
      if (effectiveFilter !== "all") params.set("classId", effectiveFilter);
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
  }, [waliClassId, classFilter, academicYear]);

  // Kunci filter ke kelas wali begitu identitas guru termuat (user datang
  // async setelah mount). Tanpa ini dropdown sempat di "Semua Kelas".
  useEffect(() => {
    if (waliClassId) setClassFilter(waliClassId);
  }, [waliClassId]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes?scope=admin&limit=200", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setClasses(data.items || []);
    } catch {
      // silent — non-critical
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch("/api/teachers?scope=admin&limit=500", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTeachers(data.items || []);
    } catch {
      // silent — non-critical
    }
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
      <ScheduleToolbar
        entries={entries}
        classFilter={classFilter}
        academicYear={academicYear}
        classMap={classMap}
        onImportTemplate={() => { setSelectedTemplateId(SCHEDULE_TEMPLATES[0].id); setTemplateClassId(classFilter === "all" ? "" : classFilter); setTemplateOpen(true); }}
      />

      {/* Filters */}
      <ScheduleFilters
        academicYear={academicYear}
        academicYears={academicYears}
        onAcademicYearChange={setAcademicYear}
        classFilter={classFilter}
        onClassFilterChange={setClassFilter}
        classes={classes}
        classMap={classMap}
        waliClassId={waliClassId}
        slotCount={slotCount}
        onSlotCountChange={setSlotCount}
        entryCount={entries.length}
      />

      {/* Grid */}
      {loading ? (
        <PageLoader label="Memuat jadwal…" />
      ) : (
        <ScheduleTable
          entries={entries}
          grid={grid}
          slotCount={slotCount}
          dragId={dragId}
          overCell={overCell}
          setOverCell={setOverCell}
          setDragId={setDragId}
          onMoveEntry={moveEntry}
          onOpenEdit={openEdit}
          onOpenCreate={openCreate}
          onDelete={handleDelete}
        />
      )}

      <ScheduleFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={handleSave}
        teachers={teachers}
        classes={classes}
      />

      {/* Template Import Dialog */}
      <ScheduleTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        selectedTemplateId={selectedTemplateId}
        onSelectedTemplateIdChange={setSelectedTemplateId}
        templateClassId={templateClassId}
        onTemplateClassIdChange={setTemplateClassId}
        classes={classes}
        importing={importing}
        onImport={handleImportTemplate}
      />
    </div>
  );
}

export default ScheduleManager;
