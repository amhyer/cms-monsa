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
  Eye,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/image-upload";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyableId } from "@/components/shared/copyable-id";
import { TeacherProfileModal } from "./teacher-profile-modal";
import type { TeacherItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";
import { PageLoader, EmptyState, Pagination, usePersistedPageSize } from "../_shared";

type FormState = {
  name: string;
  position: string;
  subject: string;
  education: string;
  photo: string;
  isActive: boolean;
  nuptk: string;
  nip: string;
  nik: string;
  tempatLahir: string;
  tanggalLahir: string;
  gender: string;
  agama: string;
  statusKepegawaian: string;
  jenisPtk: string;
  pangkatGolongan: string;
  bidangStudi: string;
  phone: string;
  email: string;
  motto: string;
  riwayat: string;
  sertifikasi: string;
  prestasi: string;
  badges: string;
  cvUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
};

const EMPTY: FormState = {
  name: "",
  position: "",
  subject: "",
  education: "",
  photo: "",
  isActive: true,
  nuptk: "",
  nip: "",
  nik: "",
  tempatLahir: "",
  tanggalLahir: "",
  gender: "",
  agama: "",
  statusKepegawaian: "",
  jenisPtk: "",
  pangkatGolongan: "",
  bidangStudi: "",
  phone: "",
  email: "",
  motto: "",
  riwayat: "",
  sertifikasi: "",
  prestasi: "",
  badges: "",
  cvUrl: "",
  linkedinUrl: "",
  githubUrl: "",
  websiteUrl: "",
};

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
                // fallback ke halaman aktif bila fetch penuh gagal
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start gap-3 py-4">
                <button
                  type="button"
                  onClick={() => setPreviewTeacher(t)}
                  aria-label={`Lihat profil ${t.name}`}
                  className="size-14 shrink-0 cursor-pointer overflow-hidden rounded-full bg-muted transition hover:ring-2 hover:ring-gold"
                >
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
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewTeacher(t)}
                      className="line-clamp-1 cursor-pointer text-left font-semibold transition hover:text-gold"
                    >
                      {t.name}
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setPreviewTeacher(t)}
                        aria-label="Lihat profil"
                        title="Lihat profil"
                      >
                        <Eye className="size-3.5" />
                      </Button>
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
                  {(t.nuptk || t.nip || t.nik) && (
                    <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                      {t.nuptk && <CopyableId label="NUPTK" value={t.nuptk} />}
                      {t.nip && <CopyableId label="NIP" value={t.nip} />}
                      {t.nik && <CopyableId label="NIK" value={t.nik} />}
                    </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Data Guru" : "Tambah Data Guru"}
            </DialogTitle>
            <DialogDescription>
              Profil ini akan tampil di halaman publik jika berstatus aktif.
              Field yang diisi lewat sinkronisasi Dapodik bisa dikoreksi manual.
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
            <div className="h-px bg-border" />
            <p className="text-xs font-medium text-muted-foreground">
              Identitas & Kepegawaian (diisi otomatis dari Dapodik)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="t-nuptk">NUPTK</Label>
                <Input
                  id="t-nuptk"
                  value={form.nuptk}
                  onChange={(e) => setForm({ ...form, nuptk: e.target.value })}
                  placeholder="NUPTK"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-nip">NIP</Label>
                <Input
                  id="t-nip"
                  value={form.nip}
                  onChange={(e) => setForm({ ...form, nip: e.target.value })}
                  placeholder="NIP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-nik">NIK</Label>
                <Input
                  id="t-nik"
                  value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  placeholder="NIK"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-ttl">Tempat Lahir</Label>
                <Input
                  id="t-ttl"
                  value={form.tempatLahir}
                  onChange={(e) =>
                    setForm({ ...form, tempatLahir: e.target.value })
                  }
                  placeholder="Tempat lahir"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-tgl">Tanggal Lahir</Label>
                <Input
                  id="t-tgl"
                  type="date"
                  value={form.tanggalLahir}
                  onChange={(e) =>
                    setForm({ ...form, tanggalLahir: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-gender">Jenis Kelamin</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) =>
                    setForm({ ...form, gender: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger id="t-gender">
                    <SelectValue placeholder="Pilih…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="LAKI_LAKI">Laki-laki</SelectItem>
                    <SelectItem value="PEREMPUAN">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-agama">Agama</Label>
                <Input
                  id="t-agama"
                  value={form.agama}
                  onChange={(e) => setForm({ ...form, agama: e.target.value })}
                  placeholder="Mis. Islam"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-status">Status Kepegawaian</Label>
                <Input
                  id="t-status"
                  value={form.statusKepegawaian}
                  onChange={(e) =>
                    setForm({ ...form, statusKepegawaian: e.target.value })
                  }
                  placeholder="Mis. GTK/PTK"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-jenptk">Jenis PTK</Label>
                <Input
                  id="t-jenptk"
                  value={form.jenisPtk}
                  onChange={(e) =>
                    setForm({ ...form, jenisPtk: e.target.value })
                  }
                  placeholder="Mis. Guru Kelas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-pangkat">Pangkat / Golongan</Label>
                <Input
                  id="t-pangkat"
                  value={form.pangkatGolongan}
                  onChange={(e) =>
                    setForm({ ...form, pangkatGolongan: e.target.value })
                  }
                  placeholder="Mis. Pembina, IV/a"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-bidang">Bidang Studi</Label>
                <Input
                  id="t-bidang"
                  value={form.bidangStudi}
                  onChange={(e) =>
                    setForm({ ...form, bidangStudi: e.target.value })
                  }
                  placeholder="Bidang studi"
                />
              </div>
            </div>
            <div className="h-px bg-border" />
            <p className="text-xs font-medium text-muted-foreground">
              Kontak & Personal (diisi manual, tidak ditimpa sinkron)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-phone">No. HP / WhatsApp</Label>
                <Input
                  id="t-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Mis. 0812xxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-email">E-Mail</Label>
                <Input
                  id="t-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nama@email.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t-motto">Motto / Kutipan</Label>
                <Input
                  id="t-motto"
                  value={form.motto}
                  onChange={(e) => setForm({ ...form, motto: e.target.value })}
                  placeholder="Kutipan singkat yang tampil di profil"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t-riwayat">Riwayat Singkat / Bio</Label>
                <Textarea
                  id="t-riwayat"
                  rows={3}
                  value={form.riwayat}
                  onChange={(e) =>
                    setForm({ ...form, riwayat: e.target.value })
                  }
                  placeholder="Riwayat pendidikan & pengalaman singkat"
                />
              </div>
              <div className="max-w-2xl space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-sertif">Sertifikasi / Diklat</Label>
                  <Textarea
                    id="t-sertif"
                    rows={2}
                    value={form.sertifikasi}
                    onChange={(e) =>
                      setForm({ ...form, sertifikasi: e.target.value })
                    }
                    placeholder="Sertifikasi atau pelatihan yang pernah diikuti"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-prestasi">Prestasi / Penghargaan</Label>
                  <Textarea
                    id="t-prestasi"
                    rows={2}
                    value={form.prestasi}
                    onChange={(e) =>
                      setForm({ ...form, prestasi: e.target.value })
                    }
                    placeholder="Prestasi atau penghargaan yang pernah diraih"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-badges">Badge (pisahkan dengan koma)</Label>
                  <Input
                    id="t-badges"
                    value={form.badges}
                    onChange={(e) =>
                      setForm({ ...form, badges: e.target.value })
                    }
                    placeholder="Mis. Sertifikasi Guru, Pengawas, Pembina Inklusi"
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-border" />
            <p className="text-xs font-medium text-muted-foreground">
              Portofolio & Media Sosial (opsional)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-cvUrl">URL CV/Resume (PDF)</Label>
                <Input
                  id="t-cvUrl"
                  value={form.cvUrl}
                  onChange={(e) => setForm({ ...form, cvUrl: e.target.value })}
                  placeholder="https://drive.google.com/file/d/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-linkedin">URL LinkedIn</Label>
                <Input
                  id="t-linkedin"
                  value={form.linkedinUrl}
                  onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-github">URL GitHub</Label>
                <Input
                  id="t-github"
                  value={form.githubUrl}
                  onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-website">URL Website Personal</Label>
                <Input
                  id="t-website"
                  value={form.websiteUrl}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://..."
                />
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
