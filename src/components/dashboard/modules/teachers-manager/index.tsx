"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Download, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeacherProfileModal } from "../teacher-profile-modal";
import type { TeacherItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";
import {
  PageLoader,
  EmptyState,
  Pagination,
  usePersistedPageSize,
} from "../../_shared";
import { EMPTY } from "./teacher-form-state";
import type { FormState } from "./teacher-form-state";
import { TeacherCardGrid } from "./teacher-card-grid";
import { TeacherFormDialog } from "./teacher-form-dialog";

export function TeachersManager() {
  const [items, setItems] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedPageSize("teachers", 10, [10, 25, 50]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [previewTeacher, setPreviewTeacher] = useState<TeacherItem | null>(null);

  // debounce pencarian server-side (sama seperti users-manager): fetch hanya
  // setelah pengguna berhenti mengetik 350ms.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        scope: "admin",
        page: String(page),
        limit: String(pageSize),
      });
      if (debounced.trim()) params.set("q", debounced.trim());
      const res = await fetch(`/api/teachers?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      toast.error("Gagal memuat data guru.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debounced]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Kembali ke halaman 1 saat pencarian/ukuran halaman berubah.
  useEffect(() => {
    setPage(1);
  }, [debounced, pageSize]);

  // Jaga agar page tidak melewati totalPages (mis. setelah menghapus baris).
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

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
      nuptk: t.nuptk ?? "",
      nip: t.nip ?? "",
      nik: t.nik ?? "",
      tempatLahir: t.tempatLahir ?? "",
      tanggalLahir: t.tanggalLahir
        ? new Date(t.tanggalLahir).toISOString().slice(0, 10)
        : "",
      gender: t.gender ?? "",
      agama: t.agama ?? "",
      statusKepegawaian: t.statusKepegawaian ?? "",
      jenisPtk: t.jenisPtk ?? "",
      pangkatGolongan: t.pangkatGolongan ?? "",
      bidangStudi: t.bidangStudi ?? "",
      phone: t.phone ?? "",
      email: t.email ?? "",
      motto: t.motto ?? "",
      riwayat: t.riwayat ?? "",
      sertifikasi: t.sertifikasi ?? "",
      prestasi: t.prestasi ?? "",
      badges: t.badges ?? "",
      cvUrl: t.cvUrl ?? "",
      linkedinUrl: t.linkedinUrl ?? "",
      githubUrl: t.githubUrl ?? "",
      websiteUrl: t.websiteUrl ?? "",
      officeHours: t.officeHours ?? "",
      consultationNote: t.consultationNote ?? "",
      languages: t.languages ?? "",
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
        nuptk: form.nuptk,
        nip: form.nip,
        nik: form.nik,
        tempatLahir: form.tempatLahir,
        tanggalLahir: form.tanggalLahir
          ? new Date(form.tanggalLahir).toISOString()
          : null,
        gender: form.gender,
        agama: form.agama,
        statusKepegawaian: form.statusKepegawaian,
        jenisPtk: form.jenisPtk,
        pangkatGolongan: form.pangkatGolongan,
        bidangStudi: form.bidangStudi,
        phone: form.phone,
        email: form.email,
        motto: form.motto,
        riwayat: form.riwayat,
        sertifikasi: form.sertifikasi,
        prestasi: form.prestasi,
        badges: form.badges,
        cvUrl: form.cvUrl || null,
        linkedinUrl: form.linkedinUrl || null,
        githubUrl: form.githubUrl || null,
        websiteUrl: form.websiteUrl || null,
        officeHours: form.officeHours || null,
        consultationNote: form.consultationNote || null,
        languages: form.languages || null,
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
            onClick={async () => {
              // Ekspor SELURUH data (bukan hanya halaman aktif) — ambil daftar
              // penuh sekali lagi dengan limit besar.
              let all = items;
              try {
                const res = await fetch("/api/teachers?scope=admin&limit=500", {
                  cache: "no-store",
                });
                if (res.ok) {
                  const data = await res.json();
                  if (Array.isArray(data.items)) all = data.items;
                }
              } catch {
              }
              exportToCsv(
                `data-guru-staf-${new Date().toISOString().slice(0, 10)}`,
                all,
                [
                  { key: "name", label: "Nama" },
                  { key: "nuptk", label: "NUPTK" },
                  { key: "nip", label: "NIP" },
                  { key: "nik", label: "NIK" },
                  { key: "position", label: "Jabatan" },
                  { key: "subject", label: "Mata Pelajaran" },
                  { key: "education", label: "Pendidikan" },
                  { key: "isActive", label: "Status" },
                ]
              );
              toast.success("Data guru diekspor ke CSV.");
            }}
            disabled={total === 0}
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
              {items.length} dari {total} data
            </span>
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ditemukan"
              description="Tidak ada data yang cocok dengan pencarian Anda."
            />
          ) : (
            <TeacherCardGrid
              items={items}
              onPreview={setPreviewTeacher}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </>
      )}

      <TeacherFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={handleSave}
      />

      <TeacherProfileModal
        teacher={previewTeacher}
        open={previewTeacher !== null}
        onOpenChange={(v) => {
          if (!v) setPreviewTeacher(null);
        }}
      />
    </div>
  );
}

export default TeachersManager;
