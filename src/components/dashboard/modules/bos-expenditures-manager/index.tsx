"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, FileText } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { BosExpenditureItem, BosDocumentItem } from "@/lib/types";
import { PageLoader, EmptyState, usePersistedPageSize, useCursorPagination } from "../../_shared";
import { EMPTY, EMPTY_DOC, type FormState, type YearStat } from "./form-state";
import { ExpenditureFilters } from "./expenditure-filters";
import { ExpenditureTable } from "./expenditure-table";
import { DocUploadForm } from "./doc-upload-form";
import { DocTable } from "./doc-table";
import { ExpenditureFormDialog } from "./expenditure-form-dialog";

const EXP_LIMIT = 10;
const DOC_LIMIT = 10;

export function BosExpendituresManager() {
  const [items, setItems] = useState<BosExpenditureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [yearFilter, setYearFilter] = useState<string>("all");
  const [years, setYears] = useState<number[]>([]);
  const [yearStats, setYearStats] = useState<YearStat[]>([]);
  const [expPageSize, setExpPageSize] = usePersistedPageSize("bos-expenditures", EXP_LIMIT, [10, 25, 50]);
  const [expTotal, setExpTotal] = useState(0);
  const [expNextCursor, setExpNextCursor] = useState<string | null>(null);
  const expCp = useCursorPagination({ limit: expPageSize, total: expTotal, nextCursor: expNextCursor, loading });
  // reset stabil (useCallback [] di _shared.tsx) — didestructure agar bisa masuk
  // deps useEffect tanpa memicu re-run tiap render (objek hook dibuat ulang).
  const { reset: resetExpCp } = expCp;
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
  const docCp = useCursorPagination({ limit: docPageSize, total: docTotal, nextCursor: docNextCursor, loading: docsLoading });
  const { reset: resetDocCp } = docCp;
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
    resetExpCp();
  }, [resetExpCp, yearFilter, expPageSize]);

  useEffect(() => {
    resetDocCp();
  }, [resetDocCp, docPageSize]);

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
          <ExpenditureFilters
            yearFilter={yearFilter}
            onYearFilterChange={setYearFilter}
            yearStats={yearStats} years={years}
            total={expTotal} totalAmount={expTotalAmount}
            onCreate={openCreate}
          />

          {items.length === 0 ? (
            <EmptyState
              title="Belum ada data anggaran"
              description="Tambahkan belanja dana BOS (mis. honorarium, sarana prasarana) agar transparansi anggaran tampil di website."
              icon={Landmark}
            />
          ) : (
            <ExpenditureTable
              items={items}
              loading={loading}
              total={expTotal}
              page={expCp.page} totalPages={expCp.totalPages}
              canGoBack={expCp.canGoBack} canGoForward={expCp.canGoForward}
              onPrev={expCp.goPrev} onNext={expCp.goNext}
              pageSize={expPageSize}
              onPageSizeChange={(s) => { setExpPageSize(s); resetExpCp(); }}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

        <TabsContent value="dokumen" className="space-y-4">
          <DocUploadForm
            form={docForm} setForm={setDocForm}
            file={docFile} onFileChange={setDocFile}
            uploading={uploading} onSubmit={handleDocUpload}
          />

          {docsLoading ? (
            <PageLoader label="Memuat dokumen…" />
          ) : docs.length === 0 ? (
            <EmptyState
              title="Belum ada dokumen"
              description="Unggah output ARKAS atau bukti belanja BOS dalam PDF agar publik dapat mengunduhnya dari halaman Transparansi."
              icon={FileText}
            />
          ) : (
            <DocTable
              docs={docs}
              loading={docsLoading}
              total={docTotal}
              page={docCp.page} totalPages={docCp.totalPages}
              canGoBack={docCp.canGoBack} canGoForward={docCp.canGoForward}
              onPrev={docCp.goPrev} onNext={docCp.goNext}
              pageSize={docPageSize}
              onPageSizeChange={(s) => { setDocPageSize(s); resetDocCp(); }}
              onDelete={handleDocDelete}
            />
          )}
        </TabsContent>
      </Tabs>

      <ExpenditureFormDialog
        open={open} onOpenChange={setOpen}
        editing={editing} form={form} setForm={setForm}
        saving={saving} onSave={handleSave}
      />
    </div>
  );
}

export default BosExpendituresManager;
