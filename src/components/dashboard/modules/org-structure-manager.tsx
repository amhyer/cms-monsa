"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Network,
  GripVertical,
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageUpload } from "@/components/shared/image-upload";
import type { OrgStructureItem } from "@/lib/types";
import { PageLoader, EmptyState } from "../_shared";

type FormState = {
  name: string;
  position: string;
  photo: string | null;
  order: number;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  position: "",
  photo: null,
  order: 0,
  isActive: true,
};

export function OrgStructureManager() {
  const [items, setItems] = useState<OrgStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgStructureItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/org-structure?scope=admin", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat struktur organisasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, order: items.length });
    setOpen(true);
  }

  function openEdit(item: OrgStructureItem) {
    setEditing(item);
    setForm({
      name: item.name,
      position: item.position,
      photo: item.photo,
      order: item.order,
      isActive: item.isActive,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nama wajib diisi.");
      return;
    }
    if (!form.position.trim()) {
      toast.error("Jabatan wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        position: form.position.trim(),
        photo: form.photo || null,
        order: form.order,
        isActive: form.isActive,
      };
      const res = editing
        ? await fetch(`/api/org-structure/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/org-structure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Struktur organisasi diperbarui." : "Struktur organisasi ditambahkan.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: OrgStructureItem) {
    try {
      const res = await fetch(`/api/org-structure/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Struktur organisasi dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  if (loading) return <PageLoader label="Memuat struktur organisasi…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Struktur Organisasi Sekolah</h2>
          <p className="text-sm text-muted-foreground">
            Susunan organisasi yang ditampilkan di halaman publik website (khusus Super Admin).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Tambah Anggota
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada struktur organisasi"
          description="Tambahkan susunan organisasi (mis. Kepala Sekolah, Wakasek, Guru) agar tampil di website."
          icon={Network}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-4"
            >
              {item.photo ? (
                <img
                  src={item.photo}
                  alt={item.name}
                  className="size-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Network className="size-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                  <Badge variant="outline">{item.order}</Badge>
                  {!item.isActive && (
                    <Badge variant="secondary">Tidak tampil</Badge>
                  )}
                </div>
                <p className="mt-1 truncate font-medium">{item.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {item.position}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(item)}
                  aria-label="Edit"
                >
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label="Hapus"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                  title="Hapus struktur organisasi?"
                  description={`Anggota "${item.name}" (${item.position}) akan dihapus permanen.`}
                  confirmText="Hapus"
                  onConfirm={() => handleDelete(item)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Anggota Struktur" : "Tambah Anggota Struktur"}
            </DialogTitle>
            <DialogDescription>
              Anggota aktif akan ditampilkan di halaman Struktur Organisasi pada website.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="o-name">Nama</Label>
                  <Input
                    id="o-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-position">Jabatan</Label>
                  <Input
                    id="o-position"
                    value={form.position}
                    onChange={(e) =>
                      setForm({ ...form, position: e.target.value })
                    }
                    placeholder="Mis. Kepala Sekolah / Wakil Kepala Sekolah"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o-order">Urutan Tampil</Label>
                  <Input
                    id="o-order"
                    type="number"
                    min={0}
                    value={form.order}
                    onChange={(e) =>
                      setForm({ ...form, order: Number(e.target.value) || 0 })
                    }
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
            <div className="flex items-center gap-2">
              <Switch
                id="o-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="o-active">Tampilkan di website (Aktif)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}