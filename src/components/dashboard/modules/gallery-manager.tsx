"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Image as ImageIcon,
  Video,
  PlayCircle,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/image-upload";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { GALLERY_CATEGORIES } from "@/lib/nav";
import type { GalleryItem } from "@/lib/types";
import { PageLoader, EmptyState, Pagination, usePersistedPageSize } from "../_shared";

type FormState = {
  title: string;
  type: "PHOTO" | "VIDEO";
  category: string;
  description: string;
  url: string;
  thumbnail: string;
};

const EMPTY: FormState = {
  title: "",
  type: "PHOTO",
  category: "Kegiatan",
  description: "",
  url: "",
  thumbnail: "",
};

export function GalleryManager() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedPageSize("gallery", 12, [12, 24, 48]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      const res = await fetch(`/api/gallery?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      toast.error("Gagal memuat galeri.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Ganti ukuran halaman → kembali ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // Jaga agar page tidak melewati totalPages (mis. setelah menghapus baris).
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(g: GalleryItem) {
    setEditing(g);
    setForm({
      title: g.title,
      type: g.type === "VIDEO" ? "VIDEO" : "PHOTO",
      category: g.category,
      description: g.description ?? "",
      url: g.url,
      thumbnail: g.thumbnail ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Judul wajib diisi.");
      return;
    }
    if (!form.url.trim()) {
      toast.error(
        form.type === "PHOTO" ? "Gambar wajib diisi." : "URL video wajib diisi."
      );
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        type: form.type,
        category: form.category,
        description: form.description || null,
        url: form.url,
        thumbnail: form.type === "VIDEO" ? form.thumbnail || null : null,
      };
      const res = editing
        ? await fetch(`/api/gallery/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/gallery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Media diperbarui." : "Media ditambahkan.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(g: GalleryItem) {
    try {
      const res = await fetch(`/api/gallery/${g.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Media dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  function previewSrc(g: GalleryItem) {
    if (g.type === "PHOTO") return g.url;
    return g.thumbnail || "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Galeri Media</h2>
          <p className="text-sm text-muted-foreground">
            Unggah foto atau tautkan video YouTube ke galeri publik.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {items.length} dari {total} media
          </span>
          <Button
            onClick={openCreate}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="size-4" /> Tambah Media
          </Button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Belum ada media"
          description="Unggah foto pertama atau tambahkan video ke galeri."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((g) => {
            const src = previewSrc(g);
            return (
              <Card key={g.id} className="overflow-hidden py-0">
                <div className="relative aspect-video bg-muted">
                  {src ? (
                    <img
                      src={src}
                      alt={g.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-7" />
                    </div>
                  )}
                  <Badge
                    className={`absolute left-2 top-2 ${
                      g.type === "VIDEO"
                        ? "bg-primary text-primary-foreground"
                        : "bg-gold text-gold-foreground"
                    }`}
                  >
                    {g.type === "VIDEO" ? (
                      <PlayCircle className="size-3" />
                    ) : (
                      <ImageIcon className="size-3" />
                    )}
                    {g.type}
                  </Badge>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(g)}
                      aria-label="Edit media"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          aria-label="Hapus media"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                      title="Hapus Media"
                      description={`Hapus "${g.title}"?`}
                      confirmText="Hapus"
                      onConfirm={() => handleDelete(g)}
                    />
                  </div>
                </div>
                <CardContent className="space-y-1 py-3">
                  <p className="line-clamp-1 text-sm font-semibold">{g.title}</p>
                  <p className="text-xs text-muted-foreground">{g.category}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        pageSize={pageSize}
        pageSizes={[12, 24, 48]}
        onPageSizeChange={setPageSize}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Media" : "Tambah Media"}
            </DialogTitle>
            <DialogDescription>
              Unggah foto atau tambahkan video dari YouTube.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="g-title">Judul</Label>
              <Input
                id="g-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Judul media"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipe Media</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm({ ...form, type: v as "PHOTO" | "VIDEO" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHOTO">
                      <ImageIcon className="size-3.5" /> Foto
                    </SelectItem>
                    <SelectItem value="VIDEO">
                      <Video className="size-3.5" /> Video
                    </SelectItem>
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
                    {GALLERY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.type === "PHOTO" ? (
              <ImageUpload
                label="Foto"
                value={form.url}
                onChange={(url) => setForm({ ...form, url })}
                helperText="Unggah file gambar atau tempel URL gambar."
              />
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="g-url">URL Video (Embed YouTube)</Label>
                  <Input
                    id="g-url"
                    value={form.url}
                    onChange={(e) =>
                      setForm({ ...form, url: e.target.value })
                    }
                    placeholder="https://www.youtube.com/embed/xxxx"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempel URL embed YouTube (mis. https://www.youtube.com/embed/VIDEO_ID).
                  </p>
                </div>
                <ImageUpload
                  label="Thumbnail (opsional)"
                  aspect="video"
                  value={form.thumbnail}
                  onChange={(url) => setForm({ ...form, thumbnail: url })}
                />
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="g-desc">Deskripsi</Label>
              <Textarea
                id="g-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Deskripsi singkat media…"
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

export default GalleryManager;
