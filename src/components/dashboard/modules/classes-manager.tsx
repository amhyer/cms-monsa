"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  LayoutGrid,
  Download,
  Search,
  Users,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppStore } from "@/store/app";
import type { ClassItem, TeacherItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";
import { PageLoader, EmptyState } from "../_shared";
import { useSearch } from "../use-search";

const GRADES = ["1", "2", "3", "4", "5", "6"];

type FormState = {
  name: string;
  grade: string;
  stream: string;
  academicYear: string;
  homeroomTeacherId: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  grade: "1",
  stream: "",
  academicYear: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
  homeroomTeacherId: "",
  isActive: true,
};

export function ClassesManager() {
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { search, setSearch, filtered } = useSearch(items, (c) =>
    `${c.name} ${c.grade} ${c.academicYear} ${c.homeroomTeacherName ?? ""}`.toLowerCase()
  );
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/classes?scope=admin", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat data kelas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch("/api/teachers?scope=admin", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTeachers(data.items || []);
    } catch {
      // non-critical — dropdown wali kelas
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchTeachers();
  }, [fetchList, fetchTeachers]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(c: ClassItem) {
    setEditing(c);
    setForm({
      name: c.name,
      grade: c.grade,
      stream: c.stream ?? "",
      academicYear: c.academicYear,
      homeroomTeacherId: c.homeroomTeacherId ?? "",
      isActive: c.isActive,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.grade || !form.academicYear.trim()) {
      toast.error("Nama kelas, grade, dan tahun ajaran wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        grade: form.grade,
        stream: form.stream.trim() || null,
        academicYear: form.academicYear.trim(),
        homeroomTeacherId: form.homeroomTeacherId || null,
        isActive: form.isActive,
      };
      const res = editing
        ? await fetch(`/api/classes/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Data kelas diperbarui." : "Kelas ditambahkan.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ClassItem) {
    try {
      const res = await fetch(`/api/classes/${c.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Kelas dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Rombongan Belajar (Kelas)</h2>
          <p className="text-sm text-muted-foreground">
            Kelola kelas, wali kelas, dan tahun ajaran.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportToCsv(
                `data-kelas-${new Date().toISOString().slice(0, 10)}`,
                items,
                [
                  { key: "name", label: "Nama Kelas" },
                  { key: "grade", label: "Grade" },
                  { key: "stream", label: "Rombel" },
                  { key: "academicYear", label: "Tahun Ajaran" },
                  { key: "homeroomTeacherName", label: "Wali Kelas" },
                  { key: "studentCount", label: "Jumlah Siswa" },
                ]
              );
              toast.success("Data kelas diekspor ke CSV.");
            }}
            disabled={items.length === 0}
          >
            <Download className="size-4" /> Export CSV
          </Button>
          {isAdmin && (
            <Button
              onClick={openCreate}
              className="bg-gold text-gold-foreground hover:bg-gold/90"
            >
              <Plus className="size-4" /> Tambah Kelas
            </Button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Menambah/mengubah/menghapus kelas hanya untuk Super Admin. Operator
          tetap dapat melihat daftar kelas.
        </p>
      )}

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Belum ada data kelas"
          description="Buat rombongan belajar terlebih dahulu sebelum menambahkan siswa."
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kelas, grade, tahun ajaran…"
              className="max-w-xs"
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} dari {items.length} kelas
            </span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ditemukan"
              description="Tidak ada data yang cocok dengan pencarian Anda."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-foreground">
                          <LayoutGrid className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold leading-tight">{c.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            Kelas {c.grade}
                            {c.stream ? ` • Rombel ${c.stream}` : ""} • {c.academicYear}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(c)}
                            aria-label="Edit kelas"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                aria-label="Hapus kelas"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                            title="Hapus Kelas"
                            description={`Hapus kelas "${c.name}"? Kelas yang masih memiliki siswa tidak dapat dihapus.`}
                            confirmText="Hapus"
                            onConfirm={() => handleDelete(c)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="outline" className="gap-1">
                        <Users className="size-3" /> {c.studentCount ?? 0} siswa
                      </Badge>
                      {c.homeroomTeacherName && c.homeroomTeacherName !== "—" ? (
                        <Badge variant="outline">Wali: {c.homeroomTeacherName}</Badge>
                      ) : (
                        <Badge variant="outline">Wali: —</Badge>
                      )}
                      {c.isActive ? (
                        <Badge className="bg-emerald-600 text-white">Aktif</Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground">Nonaktif</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Kelas" : "Tambah Kelas"}
            </DialogTitle>
            <DialogDescription>
              Contoh nama: "Kelas 1A", "Kelas 3B". Tahun ajaran: "2026/2027".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-name">Nama Kelas *</Label>
                <Input
                  id="c-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Mis. Kelas 1A"
                />
              </div>
              <div className="space-y-2">
                <Label>Grade *</Label>
                <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>
                        Kelas {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-stream">Rombel</Label>
                <Input
                  id="c-stream"
                  value={form.stream}
                  onChange={(e) => setForm({ ...form, stream: e.target.value })}
                  placeholder="Mis. A / B / C (opsional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-year">Tahun Ajaran *</Label>
                <Input
                  id="c-year"
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                  placeholder="Mis. 2026/2027"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Wali Kelas</Label>
              <Select
                value={form.homeroomTeacherId || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, homeroomTeacherId: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih wali kelas (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.position || "Staf"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="c-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="c-active">Kelas aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyimpan…
                </>
              ) : (
                <>
                  <Save className="size-4" /> Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ClassesManager;
