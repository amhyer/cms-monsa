"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Trophy,
  Download,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_CATEGORIES,
} from "@/lib/nav";
import { formatDate } from "@/lib/format";
import { exportToCsv } from "@/lib/export";
import type { AchievementItem } from "@/lib/types";
import {
  PageLoader,
  EmptyState,
  toDateInputValue,
  fromDateInputValue,
} from "../_shared";

type FormState = {
  title: string;
  studentName: string;
  level: string;
  category: string;
  date: string;
  description: string;
};

const EMPTY: FormState = {
  title: "",
  studentName: "",
  level: "Kabupaten",
  category: "Akademik",
  date: "",
  description: "",
};

function levelBadgeClass(level: string): string {
  if (level === "Internasional" || level === "Nasional") {
    return "bg-gold text-gold-foreground";
  }
  if (level === "Provinsi") {
    return "bg-primary text-primary-foreground";
  }
  return "bg-muted text-muted-foreground";
}

export function AchievementsManager() {
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AchievementItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/achievements", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat prestasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(a: AchievementItem) {
    setEditing(a);
    setForm({
      title: a.title,
      studentName: a.studentName ?? "",
      level: a.level,
      category: a.category,
      date: toDateInputValue(a.date),
      description: a.description ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Judul prestasi wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        studentName: form.studentName || null,
        level: form.level,
        category: form.category,
        date: fromDateInputValue(form.date) || new Date().toISOString(),
        description: form.description || null,
      };
      const res = editing
        ? await fetch(`/api/achievements/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/achievements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Prestasi diperbarui." : "Prestasi ditambahkan.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: AchievementItem) {
    try {
      const res = await fetch(`/api/achievements/${a.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Prestasi dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Data Prestasi</h2>
          <p className="text-sm text-muted-foreground">
            Kelola daftar prestasi siswa SD Negeri Unggulan Mongisidi 1.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportToCsv(
                `data-prestasi-${new Date().toISOString().slice(0, 10)}`,
                items,
                [
                  { key: "title", label: "Judul Prestasi" },
                  { key: "studentName", label: "Nama Siswa" },
                  { key: "level", label: "Jenjang" },
                  { key: "category", label: "Kategori" },
                  { key: "date", label: "Tanggal" },
                ]
              );
              toast.success("Data prestasi diekspor ke CSV.");
            }}
            disabled={items.length === 0}
          >
            <Download className="size-4" /> Export CSV
          </Button>
          <Button
            onClick={openCreate}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="size-4" /> Tambah Prestasi
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Belum ada prestasi"
              description="Tambahkan prestasi siswa pertama Anda."
            />
          ) : (
            <div className="rounded-md border">
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Judul</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Jenjang</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[260px]">
                        <p className="line-clamp-1 font-medium">{a.title}</p>
                        {a.description && (
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {a.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.studentName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={levelBadgeClass(a.level)}>
                          {a.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.category}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(a.date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(a)}
                            aria-label="Edit prestasi"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                aria-label="Hapus prestasi"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                            title="Hapus Prestasi"
                            description={`Hapus "${a.title}"?`}
                            confirmText="Hapus"
                            onConfirm={() => handleDelete(a)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Prestasi" : "Tambah Prestasi"}
            </DialogTitle>
            <DialogDescription>
              Catat prestasi akademik maupun non-akademik siswa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ac-title">Judul Prestasi</Label>
              <Input
                id="ac-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Mis. Juara 1 Olimpiade Fisika"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ac-student">Nama Siswa</Label>
                <Input
                  id="ac-student"
                  value={form.studentName}
                  onChange={(e) =>
                    setForm({ ...form, studentName: e.target.value })
                  }
                  placeholder="Nama peserta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ac-date">Tanggal</Label>
                <Input
                  id="ac-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Jenjang</Label>
                <Select
                  value={form.level}
                  onValueChange={(v) => setForm({ ...form, level: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACHIEVEMENT_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACHIEVEMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-desc">Deskripsi</Label>
              <Textarea
                id="ac-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Detail kompetisi, penyelenggara, dll."
              />
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

export default AchievementsManager;
