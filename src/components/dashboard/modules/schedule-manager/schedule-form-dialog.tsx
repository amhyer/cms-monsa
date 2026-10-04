"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Save } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAYS, type Day } from "@/lib/schedule-constants";
import type { ScheduleEntryItem, ClassItem, TeacherItem } from "@/lib/types";
import { MAX_SLOTS } from "./schedule-helpers";
import type { FormState } from "./form-state";

type ScheduleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ScheduleEntryItem | null;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  saving: boolean;
  onSave: () => void;
  teachers: TeacherItem[];
  classes: ClassItem[];
};

export function ScheduleFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  saving,
  onSave,
  teachers,
  classes,
}: ScheduleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin" /> Menyimpan…</> : <><Save className="size-4" /> Simpan</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
