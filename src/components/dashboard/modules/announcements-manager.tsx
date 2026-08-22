"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Megaphone,
  Pin,
  Star,
  FileDown,
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/format";
import type { AnnouncementItem } from "@/lib/types";
import {
  PageLoader,
  EmptyState,
  toDateInputValue,
  fromDateInputValue,
} from "../_shared";

type FormState = {
  title: string;
  content: string;
  isPinned: boolean;
  expiresAt: string; // yyyy-mm-dd or ""
  isActive: boolean;
};

const EMPTY: FormState = {
  title: "",
  content: "",
  isPinned: false,
  expiresAt: "",
  isActive: true,
};

function exportAnnouncementsToPdf(items: AnnouncementItem[]) {
  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>Pengumuman Sekolah</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { text-align: center; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
        .item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
        .item h2 { margin: 0 0 8px; font-size: 16px; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
        .content { font-size: 14px; line-height: 1.6; }
        .badge { display: inline-block; background: #f3f4f6; border-radius: 4px; padding: 2px 8px; font-size: 11px; margin-right: 4px; }
        .pinned { background: #fef3c7; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>Pengumuman Sekolah</h1>
      <p style="text-align:center;color:#6b7280;font-size:12px;">Dicetak: ${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</p>
      ${items.map((a) => `
        <div class="item">
          <h2>${a.title}</h2>
          <div class="meta">
            <span class="badge">${new Date(a.createdAt).toLocaleDateString("id-ID")}</span>
            ${a.isPinned ? `<span class="badge pinned">📌 Dipinned</span>` : ""}
            ${!a.isActive ? `<span class="badge">Nonaktif</span>` : ""}
          </div>
          <div class="content">${a.content}</div>
        </div>
      `).join("")}
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:30px;">CMS MONSA — UPT SPF SD Negeri Unggulan Mongisidi 1</p>
    </body>
    </html>
  `;
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.print();
  }
}

export function AnnouncementsManager() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements?scope=admin", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat pengumuman.");
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

  function openEdit(a: AnnouncementItem) {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      isPinned: a.isPinned,
      expiresAt: toDateInputValue(a.expiresAt),
      isActive: a.isActive,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Judul wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        content: form.content,
        isPinned: form.isPinned,
        expiresAt: fromDateInputValue(form.expiresAt),
        isActive: form.isActive,
      };
      const res = editing
        ? await fetch(`/api/announcements/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Pengumuman diperbarui." : "Pengumuman dibuat.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: AnnouncementItem) {
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Pengumuman dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pengumuman</h2>
          <p className="text-sm text-muted-foreground">
            Kelola pengumuman yang tampil di situs publik.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAnnouncementsToPdf(items)}
            disabled={items.length === 0}
          >
            <FileDown className="size-4" /> Export PDF
          </Button>
          <Button
            onClick={openCreate}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="size-4" /> Buat Pengumuman
          </Button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Belum ada pengumuman"
          description="Buat pengumuman pertama untuk ditampilkan kepada publik."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {a.isPinned && (
                        <span
                          className="inline-flex size-6 items-center justify-center rounded-full bg-gold/15 text-gold-foreground"
                          title="Pinned"
                          aria-label="Disematkan"
                        >
                          <Pin className="size-3.5" />
                        </span>
                      )}
                      <h3 className="line-clamp-1 font-semibold">{a.title}</h3>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {a.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(a)}
                      aria-label="Edit pengumuman"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label="Hapus pengumuman"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title="Hapus Pengumuman"
                      description={`Hapus "${a.title}"?`}
                      confirmText="Hapus"
                      onConfirm={() => handleDelete(a)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {a.isActive ? (
                    <Badge className="bg-emerald-600 text-white">Aktif</Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground">
                      Nonaktif
                    </Badge>
                  )}
                  {a.isPinned && (
                    <Badge className="bg-gold text-gold-foreground">
                      <Star className="size-3" /> Disematkan
                    </Badge>
                  )}
                  <span>
                    Berakhir: {a.expiresAt ? formatDate(a.expiresAt) : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pengumuman" : "Buat Pengumuman"}</DialogTitle>
            <DialogDescription>
              Pengumuman aktif akan tampil di situs publik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-title">Judul</Label>
              <Input
                id="a-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Judul pengumuman"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-content">Isi Pengumuman</Label>
              <Textarea
                id="a-content"
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Tulis isi pengumuman…"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a-expires">Berlaku Hingga</Label>
                <Input
                  id="a-expires"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm({ ...form, expiresAt: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-6 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="a-pinned"
                    checked={form.isPinned}
                    onCheckedChange={(v) => setForm({ ...form, isPinned: v })}
                  />
                  <Label htmlFor="a-pinned">Sematkan</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="a-active"
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                  <Label htmlFor="a-active">Aktif</Label>
                </div>
              </div>
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

export default AnnouncementsManager;
