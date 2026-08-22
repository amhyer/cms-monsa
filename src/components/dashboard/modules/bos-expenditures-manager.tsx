"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Landmark,
  Upload,
  FileText,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { BosExpenditureItem, BosDocumentItem } from "@/lib/types";
import { formatCurrency, formatCompactCurrency, formatBytes } from "@/lib/format";
import { PageLoader, EmptyState, CursorPagination, usePersistedPageSize, useCursorPagination } from "../_shared";

const SOURCES = ["BOS Reguler", "BOS Kinerja", "DAK", "Lainnya"] as const;

type FormState = {
  year: number;
  source: string;
  category: string;
  item: string;
  amount: number;
  quarter: number | null;
  note: string;
};

const EMPTY: FormState = {
  year: new Date().getFullYear(),
  source: SOURCES[0],
  category: "",
  item: "",
  amount: 0,
  quarter: null,
  note: "",
};

const EMPTY_DOC = { year: new Date().getFullYear(), title: "", description: "" };

const EXP_LIMIT = 10;
const DOC_LIMIT = 10;

export function BosExpendituresManager() {
  const [items, setItems] = useState<BosExpenditureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [yearFilter, setYearFilter] = useState<string>("all");
  const [years, setYears] = useState<number[]>([]);
  const [yearStats, setYearStats] = useState<
    { year: number; count: number; docs: number; amount: number }[]
  >([]);
  const [expPageSize, setExpPageSize] = usePersistedPageSize("bos-expenditures", EXP_LIMIT, [10, 25, 50]);
  const [expTotal, setExpTotal] = useState(0);
  const [expNextCursor, setExpNextCursor] = useState<string | null>(null);
  const expCp = useCursorPagination({ limit: expPageSize, total: expTotal, nextCursor: expNextCursor });
  const [expTotalAmount, setExpTotalAmount] = useState(0);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BosExpenditureItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  // ---- Dokumen PDF (output ARKAS / bukti belanja) ----
  const [docs, setDocs] = useState<BosDocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docPageSize, setDocPageSize] = usePersistedPageSize("bos-documents", DOC_LIMIT, [10, 25, 50]);
  const [docTotal, setDocTotal] = useState(0);
  const [docNextCursor, setDocNextCursor] = useState<string | null>(null);
  const docCp = useCursorPagination({ limit: docPageSize, total: docTotal, nextCursor: docNextCursor });
  const [uploading, setUploading] = useState(false);
  const [docForm, setDocForm] = useState(EMPTY_DOC);
  const [docFile, setDocFile] = useState<File | null>(null);

  // ---- Filter & pagination server-side (query params) ----
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(expPageSize),
      });
      if (expCp.currentCursor) params.set("cursor", expCp.currentCursor);
      if (yearFilter !== "all") params.set("year", yearFilter);
      const res = await fetch(`/api/bos-expenditures?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setExpTotal(data.total ?? 0);
      setExpNextCursor(data.nextCursor ?? null);
      setExpTotalAmount(data.totalAmount ?? 0);
      if (Array.isArray(data.years)) setYears(data.years);
      if (Array.isArray(data.yearStats)) setYearStats(data.yearStats);
    } catch {
      toast.error("Gagal memuat data anggaran.");
    } finally {
      setLoading(false);
    }
  }, [yearFilter, expCp.currentCursor, expPageSize]);

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(docPageSize),
      });
      if (docCp.currentCursor) params.set("cursor", docCp.currentCursor);
      const res = await fetch(`/api/bos-documents?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocs(data.items || []);
      setDocTotal(data.total ?? 0);
      setDocNextCursor(data.nextCursor ?? null);
    } catch {
      toast.error("Gagal memuat dokumen.");
    } finally {
      setDocsLoading(false);
    }
  }, [docCp.currentCursor, docPageSize]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Ganti tahun / ukuran halaman → kembali ke halaman 1.
  useEffect(() => {
    expCp.reset();
  }, [yearFilter, expPageSize]);

  useEffect(() => {
    docCp.reset();
  }, [docPageSize]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, year: years[0] ?? new Date().getFullYear() });
    setOpen(true);
  }

  function openEdit(item: BosExpenditureItem) {
    setEditing(item);
    setForm({
      year: item.year,
      source: item.source,
      category: item.category,
      item: item.item,
      amount: item.amount,
      quarter: item.quarter,
      note: item.note ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.item.trim()) {
      toast.error("Uraian belanja wajib diisi.");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Kategori belanja wajib diisi.");
      return;
    }
    if (!form.amount || form.amount <= 0) {
      toast.error("Nominal harus lebih dari nol.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        year: form.year,
        source: form.source,
        category: form.category.trim(),
        item: form.item.trim(),
        amount: form.amount,
        quarter: form.quarter || null,
        note: form.note.trim() || null,
      };
      const res = editing
        ? await fetch(`/api/bos-expenditures/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/bos-expenditures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(
        editing ? "Belanja diperbarui." : "Belanja ditambahkan."
      );
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: BosExpenditureItem) {
    try {
      const res = await fetch(`/api/bos-expenditures/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Belanja dihapus.");
      // Hapus baris terakhir di halaman → mundur satu halaman.
      if (items.length === 1 && expCp.canGoBack) expCp.goPrev();
      else fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) {
      toast.error("Pilih file PDF terlebih dahulu.");
      return;
    }
    if (!docForm.title.trim()) {
      toast.error("Judul dokumen wajib diisi.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("year", String(docForm.year));
      body.append("title", docForm.title.trim());
      body.append("description", docForm.description.trim());
      body.append("file", docFile);
      const res = await fetch("/api/bos-documents", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah");
      toast.success("Dokumen diunggah dan dipublikasikan.");
      setDocForm(EMPTY_DOC);
      setDocFile(null);
      fetchDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDocDelete(doc: BosDocumentItem) {
    try {
      const res = await fetch(`/api/bos-documents/${doc.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Dokumen dihapus.");
      // Hapus dokumen terakhir di halaman → mundur satu halaman.
      if (docs.length === 1 && docCp.canGoBack) docCp.goPrev();
      else fetchDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  if (loading && docsLoading) return <PageLoader label="Memuat data anggaran…" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          Transparansi Anggaran (ARKAS / Dana BOS)
        </h2>
        <p className="text-sm text-muted-foreground">
          Publikasi belanja dana BOS dan dokumen pendukung (output ARKAS) yang
          tampil untuk semua pengunjung situs (khusus Super Admin).
        </p>
      </div>

      <Tabs defaultValue="belanja">
        <TabsList>
          <TabsTrigger value="belanja">Belanja BOS</TabsTrigger>
          <TabsTrigger value="dokumen">Dokumen (PDF)</TabsTrigger>
        </TabsList>

        <TabsContent value="belanja" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Semua Tahun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun</SelectItem>
                  {yearStats.length > 0
                    ? yearStats.map((s) => (
                        <SelectItem
                          key={s.year}
                          value={String(s.year)}
                          meta={
                            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                              {s.count} item · {s.docs} dokumen ·{" "}
                              {formatCompactCurrency(s.amount)}
                            </span>
                          }
                        >
                          {s.year}
                        </SelectItem>
                      ))
                    : years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-sm">
                {expTotal} item · Total {formatCurrency(expTotalAmount)}
              </Badge>
            </div>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Tambah Belanja
            </Button>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Belum ada data anggaran"
              description="Tambahkan belanja dana BOS (mis. honorarium, sarana prasarana) agar transparansi anggaran tampil di website."
              icon={Landmark}
            />
          ) : (
            <>
            <div className="rounded-md border">
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tahun</TableHead>
                      <TableHead>Sumber Dana</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Uraian Belanja</TableHead>
                      <TableHead className="text-center">Triwulan</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.year}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.source}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.category}
                        </TableCell>
                        <TableCell>{item.item}</TableCell>
                        <TableCell className="text-center">
                          {item.quarter ? `TW ${item.quarter}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
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
                              title="Hapus belanja?"
                              description={`"${item.item}" (${item.year}) akan dihapus permanen.`}
                              confirmText="Hapus"
                              onConfirm={() => handleDelete(item)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <CursorPagination
              page={expCp.page}
              totalPages={expCp.totalPages}
              total={expTotal}
              canGoBack={expCp.canGoBack}
              canGoForward={expCp.canGoForward}
              onPrev={expCp.goPrev}
              onNext={expCp.goNext}
              pageSize={expPageSize}
              onPageSizeChange={(s) => {
                setExpPageSize(s);
                expCp.reset();
              }}
            />
            </>
          )}
        </TabsContent>

        <TabsContent value="dokumen" className="space-y-4">
          <form
            onSubmit={handleDocUpload}
            className="rounded-xl border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <Upload className="size-4" />
              <h3 className="font-semibold">Upload Dokumen PDF</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Output ARKAS atau bukti belanja dana BOS — file PDF diunggah
              langsung dan tampil di halaman Transparansi untuk diunduh publik.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-year">Tahun Anggaran</Label>
                <Input
                  id="d-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={docForm.year}
                  onChange={(e) =>
                    setDocForm({
                      ...docForm,
                      year: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-title">Judul Dokumen</Label>
                <Input
                  id="d-title"
                  value={docForm.title}
                  onChange={(e) =>
                    setDocForm({ ...docForm, title: e.target.value })
                  }
                  placeholder="Mis. Output ARKAS 2026, SPJ Belanja TW 1"
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor="d-desc">Deskripsi (opsional)</Label>
              <Input
                id="d-desc"
                value={docForm.description}
                onChange={(e) =>
                  setDocForm({ ...docForm, description: e.target.value })
                }
                placeholder="Keterangan singkat dokumen"
              />
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor="d-file">File PDF</Label>
              <Input
                id="d-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Upload PDF
              </Button>
              {docFile && (
                <span className="truncate text-sm text-muted-foreground">
                  {docFile.name} · {formatBytes(docFile.size)}
                </span>
              )}
            </div>
          </form>

          {docsLoading ? (
            <PageLoader label="Memuat dokumen…" />
          ) : docs.length === 0 ? (
            <EmptyState
              title="Belum ada dokumen"
              description="Unggah output ARKAS atau bukti belanja BOS dalam PDF agar publik dapat mengunduhnya dari halaman Transparansi."
              icon={FileText}
            />
          ) : (
            <>
            <div className="mb-3 flex justify-end">
              <Badge variant="secondary" className="text-sm">
                {docTotal} dokumen
              </Badge>
            </div>
            <div className="rounded-md border">
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tahun</TableHead>
                      <TableHead>Dokumen</TableHead>
                      <TableHead className="text-right">Ukuran</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.year}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {doc.title}
                              </p>
                              {doc.description && (
                                <p className="truncate text-sm text-muted-foreground">
                                  {doc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatBytes(doc.fileSize)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              aria-label="Unduh dokumen"
                            >
                              <a href={`/api/bos-documents/${doc.id}`}>
                                <Download className="size-4" />
                              </a>
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
                              title="Hapus dokumen?"
                              description={`"${doc.title}" (${doc.year}) dan file PDF-nya akan dihapus permanen.`}
                              confirmText="Hapus"
                              onConfirm={() => handleDocDelete(doc)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <CursorPagination
              page={docCp.page}
              totalPages={docCp.totalPages}
              total={docTotal}
              canGoBack={docCp.canGoBack}
              canGoForward={docCp.canGoForward}
              onPrev={docCp.goPrev}
              onNext={docCp.goNext}
              pageSize={docPageSize}
              onPageSizeChange={(s) => {
                setDocPageSize(s);
                docCp.reset();
              }}
            />
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Belanja" : "Tambah Belanja"}
            </DialogTitle>
            <DialogDescription>
              Data akan dipublikasikan di halaman Transparansi pada website.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="b-year">Tahun Anggaran</Label>
                <Input
                  id="b-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={form.year}
                  onChange={(e) =>
                    setForm({ ...form, year: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sumber Dana</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => setForm({ ...form, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih sumber" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-category">Kategori Belanja</Label>
              <Input
                id="b-category"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                placeholder="Mis. Honorarium, Pembelajaran, Sarana Prasarana"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-item">Uraian Belanja</Label>
              <Input
                id="b-item"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                placeholder="Mis. Honorarium guru tetap yayasan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="b-amount">Nominal (Rp)</Label>
                <Input
                  id="b-amount"
                  type="number"
                  min={0}
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, amount: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Triwulan</Label>
                <Select
                  value={form.quarter ? String(form.quarter) : "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, quarter: v === "none" ? null : Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={String(q)}>
                        Triwulan {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-note">Catatan (opsional)</Label>
              <Input
                id="b-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Keterangan tambahan, mis. nomor bukti / link ARKAS"
              />
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

export default BosExpendituresManager;
