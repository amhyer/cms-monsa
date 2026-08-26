"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Users,
  UserCircle2,
  Download,
  Upload,
  Search,
  UserPlus,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ImageUpload } from "@/components/shared/image-upload";
import { CopyableId } from "@/components/shared/copyable-id";
import type { StudentItem, ClassItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";
import { PageLoader, EmptyState, CursorPagination, toDateInputValue, fromDateInputValue, usePersistedPageSize, useCursorPagination } from "../_shared";

type FormState = {
  nis: string;
  nisn: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  phone: string;
  email: string;
  parentName: string;
  parentPhone: string;
  photoUrl: string;
  classId: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  nis: "",
  nisn: "",
  name: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  phone: "",
  email: "",
  parentName: "",
  parentPhone: "",
  photoUrl: "",
  classId: "",
  isActive: true,
};

export function StudentsManager() {
  const router = useRouter();
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
  const [importRows, setImportRows] = useState<
    { nis: string; name: string; classId: string; nisn?: string; gender?: string; parentName?: string }[]
  >([]);
  const [importBusy, setImportBusy] = useState(false);

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
      // non-critical — kelas hanya untuk filter/dropdown
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
    setForm({
      nis: s.nis,
      nisn: s.nisn ?? "",
      name: s.name,
      dateOfBirth: toDateInputValue(s.dateOfBirth),
      gender: s.gender ?? "",
      address: s.address ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      parentName: s.parentName ?? "",
      parentPhone: s.parentPhone ?? "",
      photoUrl: s.photoUrl ?? "",
      classId: s.classId,
      isActive: s.isActive,
    });
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

  const classNameOf = (classId: string) =>
    classes.find((c) => c.id === classId)?.name ?? "—";

  function downloadImportTemplate() {
    exportToCsv("template-import-siswa", [
      { NIS: "12345", Nama: "Contoh Siswa", Kelas: "1A", NISN: "0091234567", "Jenis Kelamin": "LAKI_LAKI", "Nama Orang Tua": "Bapak Contoh" },
    ], [
      { key: "NIS", label: "NIS" },
      { key: "Nama", label: "Nama" },
      { key: "Kelas", label: "Kelas" },
      { key: "NISN", label: "NISN" },
      { key: "Jenis Kelamin", label: "Jenis Kelamin" },
      { key: "Nama Orang Tua", label: "Nama Orang Tua" },
    ]);
  }

  function parseImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) {
        toast.error("File kosong.");
        return;
      }
      // Header baris pertama: NIS,Nama,Kelas,NISN,Jenis Kelamin,Nama Orang Tua
      const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const col = (h: string) => header.indexOf(h);
      const iNis = col("NIS"), iName = col("Nama"), iClass = col("Kelas");
      if (iNis < 0 || iName < 0 || iClass < 0) {
        toast.error("Format header tidak dikenali. Gunakan template.");
        return;
      }
      const byName = new Map(classes.map((c) => [c.name, c.id]));
      const rows = lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        const get = (i: number) => (i >= 0 ? cells[i]?.trim() ?? "" : "");
        const className = get(iClass);
        const classId = byName.get(className) ?? (classes.some((c) => c.id === className) ? className : "");
        const row: { nis: string; name: string; classId: string; nisn?: string; gender?: string; parentName?: string } = {
          nis: get(iNis),
          name: get(iName),
          classId,
        };
        const iNisn = col("NISN"), iGender = col("Jenis Kelamin"), iParent = col("Nama Orang Tua");
        if (iNisn >= 0) row.nisn = get(iNisn);
        if (iGender >= 0) row.gender = get(iGender);
        if (iParent >= 0) row.parentName = get(iParent);
        return row;
      }).filter((r) => r.nis && r.name);
      setImportRows(rows);
      toast.success(`${rows.length} baris dibaca dari file.`);
    };
    reader.onerror = () => toast.error("Gagal membaca file.");
    reader.readAsText(file, "utf-8");
  }

  async function handleImportSubmit() {
    if (importRows.length === 0) return;
    setImportBusy(true);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: importRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal import");
      const failCount = (data.errors ?? []).length;
      toast.success(
        `${data.created} siswa baru, ${data.updated} diperbarui${failCount > 0 ? `, ${failCount} gagal` : ""}.`
      );
      setImportOpen(false);
      setImportRows([]);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal import.");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Data Siswa</h2>
          <p className="text-sm text-muted-foreground">
            Kelola data siswa dan rombongan belajar (kelas).
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
                const res = await fetch("/api/students?limit=1000", {
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
            }}
            disabled={total === 0}
          >
            <Download className="size-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button
            onClick={openCreate}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="size-4" /> Tambah Siswa
          </Button>
        </div>
      </div>

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, NIS, NISN, ortu…"
                className="w-full sm:max-w-xs"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Semua kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {items.length} dari {total} siswa
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
              {items.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-start gap-3 py-4">
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                      {s.photoUrl ? (
                        <img
                          src={s.photoUrl}
                          alt={s.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <UserCircle2 className="size-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="line-clamp-1 font-semibold">{s.name}</h3>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(s)}
                            aria-label="Edit siswa"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                aria-label="Hapus siswa"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                            title="Hapus Data Siswa"
                            description={`Hapus data "${s.name}" (NIS ${s.nis})? Data kehadiran dan pembayaran siswa ini juga akan terhapus.`}
                            confirmText="Hapus"
                            onConfirm={() => handleDelete(s)}
                          />
                        </div>
                      </div>
                      <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                        <CopyableId label="NIS" value={s.nis} />
                        {s.nisn && <CopyableId label="NISN" value={s.nisn} />}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        <Badge variant="outline">{classNameOf(s.classId)}</Badge>
                        {s.gender && <Badge variant="outline">{s.gender === "LAKI_LAKI" ? "Laki-laki" : s.gender === "PEREMPUAN" ? "Perempuan" : s.gender}</Badge>}
                        {s.isActive ? (
                          <Badge className="bg-emerald-600 text-white">Aktif</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">Nonaktif</Badge>
                        )}
                      </div>
                      {(s.parentName || s.parentPhone) && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                          {s.parentName ? `Ortu: ${s.parentName}` : ""}
                          {s.parentPhone ? ` • ${s.parentPhone}` : ""}
                        </p>
                      )}
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() =>
                            router.push(
                              `/dashboard/users?createSiswa=${encodeURIComponent(
                                s.id
                              )}&studentName=${encodeURIComponent(s.name)}`
                            )
                          }
                          aria-label={`Buat akun SISWA untuk ${s.name}`}
                        >
                          <UserPlus className="size-3.5" />
                          Buat akun SISWA
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Data Siswa" : "Tambah Data Siswa"}
            </DialogTitle>
            <DialogDescription>
              Data ini menjadi master data untuk modul kehadiran dan pembayaran.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-nis">NIS *</Label>
                <Input
                  id="s-nis"
                  value={form.nis}
                  onChange={(e) => setForm({ ...form, nis: e.target.value })}
                  placeholder="Nomor Induk Siswa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-nisn">NISN</Label>
                <Input
                  id="s-nisn"
                  value={form.nisn}
                  onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                  placeholder="Nomor Induk Siswa Nasional"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="s-name">Nama Lengkap *</Label>
                <Input
                  id="s-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama lengkap siswa"
                />
              </div>
              <ImageUpload
                label="Foto"
                aspect="square"
                value={form.photoUrl}
                onChange={(url) => setForm({ ...form, photoUrl: url })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-dob">Tanggal Lahir</Label>
                <Input
                  id="s-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Select
                  value={form.gender || "none"}
                  onValueChange={(v) => setForm({ ...form, gender: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="LAKI_LAKI">Laki-laki</SelectItem>
                    <SelectItem value="PEREMPUAN">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kelas (Rombel) *</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.academicYear})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-address">Alamat</Label>
              <Input
                id="s-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Alamat tempat tinggal"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-phone">Telepon Siswa</Label>
                <Input
                  id="s-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="No. telepon siswa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email Siswa</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@contoh.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-parent">Nama Orang Tua/Wali</Label>
                <Input
                  id="s-parent"
                  value={form.parentName}
                  onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                  placeholder="Nama ayah/ibu/wali"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-parent-phone">Telepon Orang Tua</Label>
                <Input
                  id="s-parent-phone"
                  value={form.parentPhone}
                  onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                  placeholder="No. telepon ortu/wali"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="s-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="s-active">Siswa aktif</Label>
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Siswa dari CSV</DialogTitle>
            <DialogDescription>
              Unggah file CSV dengan kolom: NIS, Nama, Kelas, NISN, Jenis
              Kelamin, Nama Orang Tua. Siswa dengan NIS yang sama akan
              diperbarui (bukan duplikat).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadImportTemplate}>
                <Download className="size-4" /> Unduh Template
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted">
                <Upload className="size-4" />
                Pilih File CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) parseImportFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              {importRows.length > 0
                ? `${importRows.length} baris siap diimport (kelas yang tidak cocok dengan data kelas akan dilewati).`
                : "Belum ada file yang dibaca."}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={importBusy}
            >
              Batal
            </Button>
            <Button onClick={handleImportSubmit} disabled={importBusy || importRows.length === 0}>
              {importBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Mengimpor…
                </>
              ) : (
                <>
                  <Save className="size-4" /> Import {importRows.length || ""} Siswa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Simple RFC-4180-ish CSV line parser (supports quoted fields). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

export default StudentsManager;
