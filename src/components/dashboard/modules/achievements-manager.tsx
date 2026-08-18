"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Trophy,
  Download,
  Search,
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyableId } from "@/components/shared/copyable-id";
import { StudentTypeahead } from "../student-typeahead";
import {
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_CATEGORIES,
} from "@/lib/nav";
import {
  applyScopeFilter,
  computeScopeCounts,
  scopeCounter,
} from "@/lib/scope-filter";
import { formatDate } from "@/lib/format";
import { exportToCsv } from "@/lib/export";
import type { AchievementItem } from "@/lib/types";
import {
  PageLoader,
  EmptyState,
  toDateInputValue,
  fromDateInputValue,
} from "../_shared";
import { useSearch } from "../use-search";

type FormState = {
  title: string;
  studentName: string;
  studentId: string;
  level: string;
  category: string;
  date: string;
  description: string;
};

const EMPTY: FormState = {
  title: "",
  studentName: "",
  studentId: "",
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
  const [students, setStudents] = useState<
    { id: string; name: string; className: string; nis: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { search, setSearch, filtered } = useSearch(items, (a) =>
    `${a.title} ${a.studentName ?? ""} ${a.level} ${a.category}`.toLowerCase()
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const counts = useMemo(
    () => computeScopeCounts(items, "category", ACHIEVEMENT_CATEGORIES),
    [items]
  );

  const scoped = useMemo(
    () => applyScopeFilter(filtered, "category", categoryFilter),
    [filtered, categoryFilter]
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AchievementItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      // scope=admin → API mengembalikan NIS/NISN siswa tertaut (identitas
      // hanya untuk dashboard; GET publik men-strip-nya).
      const res = await fetch("/api/achievements?scope=admin", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat prestasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/students?limit=1000", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStudents(
        (data.items || []).map(
          (s: { id: string; name: string; className?: string; nis: string }) => ({
            id: s.id,
            name: s.name,
            className: s.className || "—",
            nis: s.nis,
          })
        )
      );
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (open && students.length === 0) fetchStudents();
  }, [open, students.length, fetchStudents]);

  // --- Pemilih siswa (typeahead) — input primer form. Komponen bersama
  // StudentTypeahead (perilaku identik dengan Manajemen Akun). ---
  const [studentQuery, setStudentQuery] = useState("");

  useEffect(() => {
    if (open) {
      setStudentQuery(editing?.studentName ?? "");
    }
  }, [open, editing]);

  function handleStudentQueryChange(v: string) {
    setStudentQuery(v);
    // Mengetik manual memutus tautan siswa — hanya pemilihan dari daftar
    // (typeahead) yang mengisi studentId, agar NIS/NISN di kartu akurat.
    setForm((f) =>
      f.studentName === v ? f : { ...f, studentName: v, studentId: "" }
    );
  }

  function handlePickStudent(s: { id: string; name: string }) {
    setForm((f) => ({ ...f, studentId: s.id, studentName: s.name }));
    setStudentQuery(s.name);
  }

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
      studentId: a.studentId ?? "",
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
        studentId: form.studentId || null,
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

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Belum ada prestasi"
          description="Tambahkan prestasi siswa pertama Anda."
        />
      ) : (
        <>
          <Tabs
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v)}
          >
            <TabsList className="flex-wrap h-auto mb-4">
              <TabsTrigger value="all">
                Semua ({counts.all})
              </TabsTrigger>
              {ACHIEVEMENT_CATEGORIES.map((c) => (
                <TabsTrigger key={c} value={c}>
                  {c} ({counts[c]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="mb-4 flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari prestasi atau siswa…"
              className="max-w-xs"
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {scopeCounter(
                counts,
                categoryFilter,
                scoped,
                "prestasi",
                search.trim() !== ""
              )}
            </span>
          </div>
          {scoped.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ditemukan"
              description="Tidak ada data yang cocok dengan pencarian Anda."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scoped.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-start justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-medium">{a.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge className={levelBadgeClass(a.level)}>
                          {a.level}
                        </Badge>
                        <Badge variant="outline">{a.category}</Badge>
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {a.studentName && (
                          <p className="truncate">Siswa: {a.studentName}</p>
                        )}
                        {(a.studentNis || a.studentNisn) && (
                          <div className="space-y-0.5 pt-1">
                            {a.studentNis && (
                              <CopyableId label="NIS" value={a.studentNis} />
                            )}
                            {a.studentNisn && (
                              <CopyableId label="NISN" value={a.studentNisn} />
                            )}
                          </div>
                        )}
                        <p className="truncate">Tanggal: {formatDate(a.date)}</p>
                      </div>
                      {a.description && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                          {a.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEdit(a)}
                        aria-label="Edit prestasi"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            aria-label="Hapus prestasi"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        title="Hapus Prestasi"
                        description={`Hapus "${a.title}"?`}
                        confirmText="Hapus"
                        onConfirm={() => handleDelete(a)}
                      />
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
              {editing ? "Edit Prestasi" : "Tambah Prestasi"}
            </DialogTitle>
            <DialogDescription>
              Catat prestasi akademik maupun non-akademik siswa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Input primer: pemilih siswa dengan pencarian/typeahead. */}
            <div className="space-y-2">
              <Label htmlFor="ac-student">Siswa / Tim</Label>
              <StudentTypeahead
                id="ac-student"
                students={students}
                query={studentQuery}
                onQueryChange={handleStudentQueryChange}
                onPick={handlePickStudent}
                placeholder="Ketik nama siswa / NIS, atau nama tim…"
              />
              {form.studentId ? (
                <p className="text-xs font-medium text-emerald-600">
                  ✓ Tertaut ke siswa — NIS/NISN akan tampil di kartu
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pilih siswa dari daftar untuk menampilkan NIS/NISN di kartu;
                  ketik bebas untuk prestasi tim.
                </p>
              )}
            </div>
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
                <Label htmlFor="ac-date">Tanggal</Label>
                <Input
                  id="ac-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
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
