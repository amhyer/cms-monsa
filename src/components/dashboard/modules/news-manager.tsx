"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Newspaper,
  Eye,
  Pencil as PencilIcon,
  type LucideIcon,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/image-upload";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { NEWS_CATEGORIES } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import type { NewsItem } from "@/lib/types";
import { PageLoader, EmptyState } from "../_shared";

/* ------------------------------------------------------------------ */
/* Simple rich text editor (contentEditable + execCommand)            */
/* ------------------------------------------------------------------ */

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

function exec(command: string, value?: string) {
  // focus ensures command applies to the editor, not the toolbar button
  document.execCommand(command, false, value);
}

function RichTextEditor({ value, onChange, label = "Konten" }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Set initial HTML once on mount. Using `key` from the parent
  // (editing.id ?? "new") guarantees a fresh mount whenever the dialog
  // opens on a different item, so we never need to sync props -> DOM
  // after mount (which would reset the cursor).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
    // intentionally run once on mount; the parent passes a `key` prop so a
    // fresh mount happens whenever the dialog opens on a different item,
    // which avoids the need to sync props -> DOM after mount (that would
    // reset the user's caret position).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount (see comment above)
  }, []);

  const handleInput = useCallback(() => {
    const el = ref.current;
    if (el) onChange(el.innerHTML);
  }, [onChange]);

  const runTool = useCallback(
    (action: "bold" | "italic" | "underline" | "h2" | "h3" | "p" | "ul" | "ol" | "link" | "image") => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      switch (action) {
        case "bold":
          exec("bold");
          break;
        case "italic":
          exec("italic");
          break;
        case "underline":
          exec("underline");
          break;
        case "h2":
          exec("formatBlock", "<h2>");
          break;
        case "h3":
          exec("formatBlock", "<h3>");
          break;
        case "p":
          exec("formatBlock", "<p>");
          break;
        case "ul":
          exec("insertUnorderedList");
          break;
        case "ol":
          exec("insertOrderedList");
          break;
        case "link": {
          const url = window.prompt("Masukkan URL tautan:", "https://");
          if (url) exec("createLink", url);
          break;
        }
        case "image": {
          const url = window.prompt("Masukkan URL gambar:", "https://");
          if (url) exec("insertImage", url);
          break;
        }
      }
      handleInput();
    },
    [handleInput]
  );

  const tools: { icon: LucideIcon; title: string; action: Parameters<typeof runTool>[0] }[] = [
    { icon: Bold, title: "Tebal", action: "bold" },
    { icon: Italic, title: "Miring", action: "italic" },
    { icon: Underline, title: "Garis Bawah", action: "underline" },
    { icon: Heading2, title: "Judul H2", action: "h2" },
    { icon: Heading3, title: "Sub Judul H3", action: "h3" },
    { icon: List, title: "Daftar Poin", action: "ul" },
    { icon: ListOrdered, title: "Daftar Nomor", action: "ol" },
    { icon: LinkIcon, title: "Sisipkan Tautan", action: "link" },
    { icon: ImageIcon, title: "Sisipkan Gambar (URL)", action: "image" },
  ];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="overflow-hidden rounded-md border">
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.action}
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                title={t.title}
                aria-label={t.title}
                onClick={() => runTool(t.action)}
                tabIndex={-1}
              >
                <Icon className="size-4" />
              </Button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => runTool("p")}
            tabIndex={-1}
          >
            Paragraf
          </Button>
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleInput}
          className="news-content min-h-[240px] max-h-[55vh] overflow-y-auto custom-scroll bg-background px-4 py-3 text-sm outline-none"
          role="textbox"
          aria-multiline="true"
          aria-label="Konten berita"
          data-placeholder="Tulis konten berita di sini…"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Editor sederhana berbasis contentEditable. Teks disimpan sebagai HTML.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* News Manager                                                       */
/* ------------------------------------------------------------------ */

type FormState = {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  status: "DRAFT" | "PUBLISHED";
};

const EMPTY_FORM: FormState = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: "Kegiatan",
  status: "DRAFT",
};

export function NewsManager() {
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [previewMode, setPreviewMode] = useState(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        scope: "admin",
        page: String(page),
        limit: "10",
      });
      if (status) qs.set("status", status);
      if (category) qs.set("category", category);
      if (debounced) qs.set("search", debounced);
      const res = await fetch(`/api/news?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      // Clear selection when list refreshes (items may have changed).
      setSelected(new Set());
    } catch {
      toast.error("Gagal memuat daftar berita.");
    } finally {
      setLoading(false);
    }
  }, [page, status, category, debounced]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPreviewMode(false);
    setDialogOpen(true);
  }

  function openEdit(n: NewsItem) {
    setEditing(n);
    setForm({
      title: n.title,
      excerpt: n.excerpt,
      content: n.content,
      coverImage: n.coverImage ?? "",
      category: n.category,
      status: n.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    });
    setPreviewMode(false);
    setDialogOpen(true);
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
        excerpt: form.excerpt,
        content: form.content,
        coverImage: form.coverImage || null,
        category: form.category,
        status: form.status,
      };
      const res = editing
        ? await fetch(`/api/news/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Berita diperbarui." : "Berita dibuat.");
      setDialogOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan berita.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(n: NewsItem) {
    try {
      const res = await fetch(`/api/news/${n.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Berita dihapus.", {
        action: {
          label: "Lihat di Log",
          onClick: () => router.push("/dashboard/logs"),
        },
      });
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus berita.");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((n) => n.id))
    );
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    const ids = [...selected];
    let ok = 0;
    let fail = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/news/${id}`, { method: "DELETE" });
          if (res.ok) ok++;
          else fail++;
        } catch {
          fail++;
        }
      })
    );
    setBulkDeleting(false);
    setSelected(new Set());
    if (ok > 0) {
      toast.success(`${ok} berita dihapus.`, {
        action: {
          label: "Lihat di Log",
          onClick: () => router.push("/dashboard/logs"),
        },
      });
    }
    if (fail > 0) {
      toast.error(`${fail} berita gagal dihapus.`);
    }
    fetchList();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Berita & Artikel</h2>
          <p className="text-sm text-muted-foreground">
            Kelola publikasi berita sekolah.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Plus className="size-4" /> Tambah Berita
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              placeholder="Cari judul berita…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              value={status || "all"}
              onValueChange={(v) => {
                setStatus(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={category || "all"}
              onValueChange={(v) => {
                setCategory(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {NEWS_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Belum ada berita"
              description="Tambahkan berita pertama Anda menggunakan tombol di atas."
            />
          ) : (
            <div className="rounded-md border">
              {selected.size > 0 && (
                <div className="mb-3 flex items-center gap-3 rounded-md border border-gold/40 bg-gold/10 px-4 py-2">
                  <span className="text-sm font-medium">
                    {selected.size} berita dipilih
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Hapus Terpilih
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                  >
                    Batal
                  </Button>
                </div>
              )}
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            items.length > 0 && selected.size === items.length
                          }
                          onCheckedChange={toggleSelectAll}
                          aria-label="Pilih semua berita"
                        />
                      </TableHead>
                      <TableHead className="min-w-[220px]">Judul</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Penulis</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((n) => (
                    <TableRow key={n.id} data-selected={selected.has(n.id)}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(n.id)}
                          onCheckedChange={() => toggleSelect(n.id)}
                          aria-label={`Pilih ${n.title}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="flex items-center gap-3">
                          {n.coverImage ? (
                            <img
                              src={n.coverImage}
                              alt=""
                              className="size-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                              <Newspaper className="size-4" />
                            </div>
                          )}
                          <span className="line-clamp-2 font-medium">{n.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{n.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {n.status === "PUBLISHED" ? (
                          <Badge className="bg-emerald-600 text-white">Published</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {n.authorName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(n.publishedAt || n.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(n)}
                            aria-label="Edit berita"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                aria-label="Hapus berita"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                            title="Hapus Berita"
                            description={`Hapus "${n.title}"? Tindakan ini tidak dapat dibatalkan.`}
                            confirmText="Hapus"
                            onConfirm={() => handleDelete(n)}
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

          {!loading && items.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl custom-scroll">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>
                  {editing ? "Edit Berita" : "Tambah Berita"}
                  {previewMode && " — Pratinjau"}
                </DialogTitle>
                <DialogDescription>
                  {previewMode
                    ? "Tampilan pratinjau seperti yang akan dilihat pengunjung."
                    : editing
                    ? "Perbarui detail berita lalu simpan."
                    : "Lengkapi formulir di bawah untuk menerbitkan berita baru."}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 rounded-md border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={!previewMode ? "default" : "ghost"}
                  className="h-7"
                  onClick={() => setPreviewMode(false)}
                >
                  <PencilIcon className="size-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode ? "default" : "ghost"}
                  className="h-7"
                  onClick={() => setPreviewMode(true)}
                >
                  <Eye className="size-3.5" /> Pratinjau
                </Button>
              </div>
            </div>
          </DialogHeader>

          {previewMode ? (
            <article className="space-y-4 rounded-lg border bg-background p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  {form.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    form.status === "PUBLISHED"
                      ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }
                >
                  {form.status === "PUBLISHED" ? "Published" : "Draft"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(new Date().toISOString())}
                </span>
              </div>
              <h1 className="font-sans text-2xl font-bold leading-tight tracking-tight">
                {form.title.trim() || (
                  <span className="text-muted-foreground">(Tanpa judul)</span>
                )}
              </h1>
              {form.excerpt && (
                <p className="text-base font-medium leading-relaxed text-muted-foreground">
                  {form.excerpt}
                </p>
              )}
              {form.coverImage && (
                <img
                  src={form.coverImage}
                  alt={form.title || "Gambar sampul"}
                  className="aspect-[16/9] w-full rounded-lg border object-cover"
                />
              )}
              <div
                className="news-content text-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(form.content) || "<p class='text-muted-foreground italic'>Belum ada konten.</p>",
                }}
              />
            </article>
          ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Judul</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Judul berita"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    {NEWS_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as "DRAFT" | "PUBLISHED" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Ringkasan</Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder="Cuplikan singkat berita…"
                rows={2}
              />
            </div>

            <ImageUpload
              label="Gambar Sampul"
              aspect="video"
              value={form.coverImage}
              onChange={(url) => setForm({ ...form, coverImage: url })}
              helperText="Rasio 16:9 disarankan."
            />

            {/* remount on dialog open to reset contentEditable content */}
            {dialogOpen && (
              <RichTextEditor
                key={editing?.id ?? "new"}
                value={form.content}
                onChange={(html) => setForm({ ...form, content: html })}
              />
            )}
          </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
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

export default NewsManager;
