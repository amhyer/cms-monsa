"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Newspaper, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { NewsItem } from "@/lib/types";
import { PageLoader, EmptyState, Pagination, usePersistedPageSize } from "../../_shared";
import { NewsFilters } from "./news-filters";
import { NewsTable } from "./news-table";
import { NewsFormDialog } from "./news-form-dialog";
import { EMPTY_FORM, type FormState } from "./form-state";

export type { FormState };
export { EMPTY_FORM };
export { RichTextEditor } from "./rich-text-editor";
export { NewsFilters } from "./news-filters";
export { NewsTable } from "./news-table";
export { NewsFormDialog } from "./news-form-dialog";

/* ------------------------------------------------------------------ */
/* News Manager                                                       */
/* ------------------------------------------------------------------ */

export function NewsManager() {
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedPageSize("news", 10, [10, 20, 24]);
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
        limit: String(pageSize),
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
  }, [page, pageSize, status, category, debounced]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Ganti ukuran halaman → kembali ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

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
          <NewsFilters
            search={search}
            status={status}
            category={category}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            onStatusChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            onCategoryChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          />

          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Belum ada berita"
              description="Tambahkan berita pertama Anda menggunakan tombol di atas."
            />
          ) : (
            <NewsTable
              items={items}
              selected={selected}
              bulkDeleting={bulkDeleting}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onClearSelection={() => setSelected(new Set())}
              onBulkDelete={handleBulkDelete}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}

          {!loading && items.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
              pageSize={pageSize}
              pageSizes={[10, 20, 24]}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      <NewsFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}

export default NewsManager;
