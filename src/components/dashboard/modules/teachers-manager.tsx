"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Users,
  UserCircle2,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/image-upload";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { TeacherItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";
import { PageLoader, EmptyState } from "../_shared";
import { useSearch } from "../use-search";

type FormState = {
  name: string;
  position: string;
  subject: string;
  education: string;
  photo: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  position: "",
  subject: "",
  education: "",
  photo: "",
  isActive: true,
};

export function TeachersManager() {
  const [items, setItems] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { search, setSearch, filtered } = useSearch(items, (t) =>
    `${t.name} ${t.position} ${t.subject ?? ""}`.toLowerCase()
  );
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teachers?scope=admin", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat data guru.");
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

  function openEdit(t: TeacherItem) {
    setEditing(t);
    setForm({
      name: t.name,
      position: t.position,
      subject: t.subject ?? "",
      education: t.education ?? "",
      photo: t.photo ?? "",
      isActive: t.isActive,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nama wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        position: form.position,
        subject: form.subject || null,
        education: form.education || null,
        photo: form.photo || null,
        isActive: form.isActive,
      };
      const res = editing
        ? await fetch(`/api/teachers/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/teachers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Data guru diperbarui." : "Data guru ditambahkan.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: TeacherItem) {
    try {
      const res = await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Data guru dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Guru & Staf</h2>
          <p className="text-sm text-muted-foreground">
            Kelola data profil guru dan staf sekolah.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportToCsv(
                `data-guru-staf-${new Date().toISOString().slice(0, 10)}`,
                items,
                [
                  { key: "name", label: "Nama" },
                  { key: "nuptk", label: "NUPTK" },
                  { key: "position", label: "Jabatan" },
                  { key: "subject", label: "Mata Pelajaran" },
                  { key: "education", label: "Pendidikan" },
                  { key: "isActive", label: "Status" },
                ]
              );
              toast.success("Data guru diekspor ke CSV.");
            }}
            disabled={items.length === 0}
          >
            <Download className="size-4" /> Export CSV
          </Button>
          <Button
            onClick={openCreate}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="size-4" /> Tambah Guru
          </Button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada data guru"
          description="Tambahkan data guru atau staf pertama Anda."
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, jabatan, atau mapel…"
              className="max-w-xs"
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} dari {items.length} data
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
          {filtered.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="size-14 shrink-0 overflow-hidden rounded-full bg-muted">
                  {t.photo ? (
                    <img
                      src={t.photo}
                      alt={t.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <UserCircle2 className="size-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="line-clamp-1 font-semibold">{t.name}</h3>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEdit(t)}
                        aria-label="Edit guru"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            aria-label="Hapus guru"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        title="Hapus Data Guru"
                        description={`Hapus data "${t.name}"?`}
                        confirmText="Hapus"
                        onConfirm={() => handleDelete(t)}
                      />
                    </div>
                  </div>
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    {t.position || "—"}
                  </p>
                  {t.nuptk && (
                    <p className="mt-0.5 text-xs text-muted-foreground">NUPTK: {t.nuptk}</p>
                  )}
                  {String(t.position).toLowerCase().includes("kepala sekolah") && (
                    <Badge className="mt-1 bg-gold text-gold-foreground">Kepala Sekolah</Badge>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {t.subject && <Badge variant="outline">{t.subject}</Badge>}
                    {t.isActive ? (
                      <Badge className="bg-emerald-600 text-white">Aktif</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">
                        Nonaktif
                      </Badge>
                    )}
                  </div>
                  {t.education && (
                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                      {t.education}
                    </p>
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
              {editing ? "Edit Data Guru" : "Tambah Data Guru"}
            </DialogTitle>
            <DialogDescription>
              Profil ini akan tampil di halaman publik jika berstatus aktif.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="t-name">Nama</Label>
                  <Input
                    id="t-name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-position">Jabatan</Label>
                  <Input
                    id="t-position"
                    value={form.position}
                    onChange={(e) =>
                      setForm({ ...form, position: e.target.value })
                    }
                    placeholder="Mis. Kepala Sekolah / Guru Matematika"
                  />
                </div>
              </div>
              <ImageUpload
                label="Foto"
                aspect="square"
                value={form.photo}
                onChange={(url) => setForm({ ...form, photo: url })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-subject">Mata Pelajaran</Label>
                <Input
                  id="t-subject"
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  placeholder="Mis. Matematika"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-education">Pendidikan</Label>
                <Input
                  id="t-education"
                  value={form.education}
                  onChange={(e) =>
                    setForm({ ...form, education: e.target.value })
                  }
                  placeholder="Mis. S.Pd., M.Pd."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="t-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="t-active">Tampilkan profil (Aktif)</Label>
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

export default TeachersManager;
