"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import type { StudentItem, ClassItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";
import { PageLoader, EmptyState, CursorPagination, fromDateInputValue, usePersistedPageSize, useCursorPagination } from "../../_shared";
import { EMPTY, formStateFromStudent, type FormState } from "./types";
import { StudentsPageHeader } from "./students-page-header";
import { StudentsToolbar } from "./students-toolbar";
import { StudentCardGrid } from "./student-card-grid";
import { StudentFormDialog } from "./student-form-dialog";
import { StudentImportDialog } from "./student-import-dialog";

export function StudentsManager() {
  const [items, setItems] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageSize, setPageSize] = usePersistedPageSize("students", 10, [10, 20, 50, 100]);
  const cp = useCursorPagination({ limit: pageSize, total, nextCursor });
  // reset stabil (useCallback [] di _shared.tsx) — didestructure agar bisa masuk
  // deps useEffect tanpa memicu re-run tiap render (objek cp dibuat ulang).
  const { reset: resetCp } = cp;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudentItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const [importOpen, setImportOpen] = useState(false);

  // debounce pencarian server-side (sama seperti users-manager): pencarian &
  // filter kelas dikirim ke API, bukan difilter di sisi klien atas halaman aktif.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
      });
      if (cp.currentCursor) params.set("cursor", cp.currentCursor);
      if (classFilter !== "all") params.set("classId", classFilter);
      if (debounced.trim()) params.set("search", debounced.trim());
      const res = await fetch(`/api/students?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      toast.error("Gagal memuat data siswa.");
    } finally {
      setLoading(false);
    }
  }, [cp.currentCursor, pageSize, classFilter, debounced]);

  // Kembali ke halaman 1 saat pencarian/filter/ukuran halaman berubah.
  useEffect(() => {
    resetCp();
  }, [resetCp, debounced, classFilter, pageSize]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes?scope=admin", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setClasses(data.items || []);
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchClasses();
  }, [fetchList, fetchClasses]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, classId: classes[0]?.id ?? "" });
    setOpen(true);
  }

  function openEdit(s: StudentItem) {
    setEditing(s);
    setForm(formStateFromStudent(s));
    setOpen(true);
  }

  async function handleSave() {
    if (!form.nis.trim() || !form.name.trim() || !form.classId) {
      toast.error("NIS, nama, dan kelas wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        nis: form.nis.trim(),
        nisn: form.nisn.trim() || null,
        name: form.name.trim(),
        dateOfBirth: fromDateInputValue(form.dateOfBirth),
        gender: form.gender || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        parentName: form.parentName.trim() || null,
        parentPhone: form.parentPhone.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        classId: form.classId,
        isActive: form.isActive,
      };
      const res = editing
        ? await fetch(`/api/students/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Data siswa diperbarui." : "Data siswa ditambahkan.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: StudentItem) {
    try {
      const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Data siswa dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  async function handleExport() {
    // Ekspor SELURUH data (bukan hanya halaman aktif) — ambil daftar
    // penuh sekali lagi dengan limit besar.
    let all = items;
    try {
      const res = await fetch("/api/students?limit=1000", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) all = data.items;
      }
    } catch {
    }
    exportToCsv(
      `data-siswa-${new Date().toISOString().slice(0, 10)}`,
      all,
      [
        { key: "nis", label: "NIS" },
        { key: "nisn", label: "NISN" },
        { key: "name", label: "Nama" },
        { key: "className", label: "Kelas" },
        { key: "gender", label: "Jenis Kelamin" },
        { key: "parentName", label: "Nama Orang Tua" },
        { key: "parentPhone", label: "Telepon Ortu" },
        { key: "isActive", label: "Status" },
      ]
    );
    toast.success("Data siswa diekspor ke CSV.");
  }

  return (
    <div className="space-y-4">
      <StudentsPageHeader
        exportDisabled={total === 0}
        onExport={handleExport}
        onImport={() => setImportOpen(true)}
        onCreate={openCreate}
      />

      {loading ? (
        <PageLoader />
      ) : total === 0 && !debounced.trim() && classFilter === "all" ? (
        <EmptyState
          icon={Users}
          title="Belum ada data siswa"
          description="Tambahkan data siswa pertama Anda. Tanpa data siswa, modul kehadiran dan pembayaran tidak bisa digunakan."
        />
      ) : (
        <>
          <StudentsToolbar
            search={search}
            onSearchChange={setSearch}
            classFilter={classFilter}
            onClassFilterChange={setClassFilter}
            classes={classes}
            shownCount={items.length}
            totalCount={total}
          />
          {items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ditemukan"
              description="Tidak ada data yang cocok dengan pencarian Anda."
            />
          ) : (
            <StudentCardGrid
              items={items}
              classes={classes}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <CursorPagination
        page={cp.page}
        totalPages={cp.totalPages}
        total={total}
        canGoBack={cp.canGoBack}
        canGoForward={cp.canGoForward}
        onPrev={cp.goPrev}
        onNext={cp.goNext}
        pageSize={pageSize}
        onPageSizeChange={(s) => {
          setPageSize(s);
          cp.reset();
        }}
        pageSizes={[10, 20, 50, 100]}
      />

      <StudentFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        form={form}
        onFormChange={setForm}
        classes={classes}
        saving={saving}
        onSave={handleSave}
      />

      <StudentImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        classes={classes}
        onImported={fetchList}
      />
    </div>
  );
}

export default StudentsManager;
