"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  UserCog,
  ShieldAlert,
  Search,
  ArrowRightLeft,
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Highlighted } from "@/components/shared/highlighted";
import { StudentTypeahead } from "../student-typeahead";
import { useAppStore } from "@/store/app";
import { formatDate } from "@/lib/format";
import type { UserItem } from "@/lib/types";
import { accountCounter, carryStudentLink, type RoleFilter } from "@/lib/user-roles";
import { PageLoader, EmptyState, Pagination, usePersistedPageSize } from "../_shared";

type Role = "OPERATOR" | "SUPER_ADMIN" | "GURU" | "ORANG_TUA" | "SISWA";

type FormState = {
  name: string;
  email: string;
  password: string;
  role: Role;
  guardianClassId: string;
  guardianStudentId: string;
  guardianStudentName: string;
  studentId: string;
  studentName: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  password: "",
  role: "OPERATOR",
  guardianClassId: "",
  guardianStudentId: "",
  guardianStudentName: "",
  studentId: "",
  studentName: "",
  isActive: true,
};


const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "STAFF", label: "Admin & Operator" },
  { value: "GURU", label: "Guru" },
  { value: "ORANG_TUA", label: "Orang Tua" },
  { value: "SISWA", label: "Siswa" },
];

function roleLabel(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Admin";
    case "OPERATOR":
      return "Operator";
    case "GURU":
      return "Guru";
    case "ORANG_TUA":
      return "Orang Tua";
    case "SISWA":
      return "Siswa";
    default:
      return role;
  }
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-gold text-gold-foreground";
    case "OPERATOR":
      return "bg-primary text-primary-foreground";
    case "GURU":
      return "bg-violet-600 text-white";
    case "ORANG_TUA":
      return "bg-teal-600 text-white";
    case "SISWA":
      return "bg-amber-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function UsersManager({
  initialCreateSiswa,
}: {
  // Quick action "Buat akun SISWA" dari kartu Data Siswa
  // (/dashboard/users?createSiswa=<id>&studentName=<nama>) — dialog
  // Tambah Akun terbuka otomatis ter-link ke siswa tersebut.
  initialCreateSiswa?: { studentId: string; studentName: string } | null;
}) {
  const me = useAppStore((s) => s.user);
  const [items, setItems] = useState<UserItem[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<
    { id: string; name: string; className: string; nis: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedPageSize("users", 10, [10, 25, 50]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({
    all: 0,
    STAFF: 0,
    GURU: 0,
    ORANG_TUA: 0,
    SISWA: 0,
  });
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  // Role asal saat tautan siswa DIBWA otomatis (ORANG_TUA ↔ SISWA) — dipakai
  // untuk menampilkan petunjuk agar admin sadar auto-fill itu disengaja.
  const [carriedFrom, setCarriedFrom] = useState<string | null>(null);

  // debounce pencarian (sama seperti news-manager): fetch server hanya
  // setelah pengguna berhenti mengetik 350ms.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (debounced.trim()) params.set("q", debounced.trim());
      const res = await fetch(`/api/users?${params}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Anda tidak memiliki akses ke modul ini.");
        }
        throw new Error();
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setCounts(
        data.counts ?? { all: 0, STAFF: 0, GURU: 0, ORANG_TUA: 0, SISWA: 0 }
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, roleFilter, debounced]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes?scope=admin", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setClasses((data.items || []).map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      })));
    } catch {
      // non-critical
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/students?limit=1000", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStudents(
        (data.items || []).map(
          (s: { id: string; name: string; className?: string; nis: string }) => ({
            id: s.id,
            name: s.name,
            className: s.className || "—",
            nis: s.nis,
          })
        )
      );
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (open && form.role === "GURU" && classes.length === 0) fetchClasses();
    if (
      open &&
      (form.role === "ORANG_TUA" || form.role === "SISWA") &&
      students.length === 0
    )
      fetchStudents();
  }, [open, form.role, classes.length, students.length, fetchClasses, fetchStudents]);

  // Auto-open dari quick action "Buat akun SISWA": role SISWA + tautan siswa
  // terisi dari query param. Dipicu sekali (useRef) agar refresh/navigasi
  // ulang tidak membuka dialog lagi.
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!initialCreateSiswa || openedInitial.current) return;
    openedInitial.current = true;
    setForm({
      ...EMPTY,
      role: "SISWA",
      name: initialCreateSiswa.studentName,
      studentId: initialCreateSiswa.studentId,
      studentName: initialCreateSiswa.studentName,
    });
    setEditing(null);
    setCarriedFrom(null);
    setOpen(true);
  }, [initialCreateSiswa]);

  // Fallback: URL hanya membawa id (tanpa nama) → resolusi nama dari daftar
  // siswa begitu termuat, agar typeahead menampilkan nama siswa.
  useEffect(() => {
    if (!form.studentId || form.studentName || students.length === 0) return;
    const s = students.find((x) => x.id === form.studentId);
    if (s) setForm((prev) => ({ ...prev, studentName: s.name }));
  }, [form.studentId, form.studentName, students]);

  // Kembali ke halaman 1 saat filter/pencarian/ukuran halaman berubah.
  useEffect(() => {
    setPage(1);
  }, [debounced, roleFilter, pageSize]);

  // Jaga agar page tidak melewati totalPages (mis. setelah menghapus baris).
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setCarriedFrom(null);
    setOpen(true);
  }

  // Ganti role di dialog edit — migrasi tautan meniru PUT /api/users/[id]
  // (guardianClassId hanya untuk GURU, studentId hanya untuk SISWA,
  // guardianStudentId hanya untuk ORANG_TUA; tautan lain dikosongkan).
  // ORANG_TUA ↔ SISWA membawa tautan siswa yang sudah ada agar tidak hilang
  // diam-diam (id DAN nama agar typeahead terisi, bukan hanya field id).
  function handleRoleChange(v: string) {
    const role = v as Role;
    const migrated = carryStudentLink(role, form);
    const next = { ...form, role, ...(migrated ?? {}) };
    // Deteksi tautan siswa yang DIBWA (ORANG_TUA ↔ SISWA) untuk resolusi nama
    // dan petunjuk; migrasi lain (mis. guardianClassId dikosongkan saat keluar
    // dari GURU) tidak memicu petunjuk.
    const carriedStudent =
      (role === "SISWA" && !form.studentId && !!migrated?.studentId) ||
      (role === "ORANG_TUA" &&
        !form.guardianStudentId &&
        !!migrated?.guardianStudentId);
    if (carriedStudent) {
      const id = role === "SISWA" ? next.studentId : next.guardianStudentId;
      const s = students.find((x) => x.id === id);
      if (role === "SISWA") next.studentName = s?.name ?? "";
      else next.guardianStudentName = s?.name ?? "";
      // Beri tahu admin bahwa field terisi otomatis dari role sebelumnya.
      setCarriedFrom(role === "SISWA" ? "Orang Tua" : "Siswa");
    } else {
      setCarriedFrom(null);
    }
    setForm(next);
  }

  function openEdit(u: UserItem) {
    setEditing(u);
    setCarriedFrom(null);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role:
        u.role === "SUPER_ADMIN" ||
        u.role === "GURU" ||
        u.role === "ORANG_TUA" ||
        u.role === "SISWA"
          ? (u.role as Role)
          : "OPERATOR",
      guardianClassId: u.guardianClassId ?? "",
      guardianStudentId: u.guardianStudentId ?? "",
      guardianStudentName: u.guardianStudentName ?? "",
      studentId: u.studentId ?? "",
      studentName: u.studentName ?? "",
      isActive: u.isActive,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nama dan email wajib diisi.");
      return;
    }
    if (!editing && form.password.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }
    if (form.role === "GURU" && !form.guardianClassId) {
      toast.error("Pilih wali kelas untuk akun guru.");
      return;
    }
    if (form.role === "ORANG_TUA" && !form.guardianStudentId) {
      toast.error("Pilih siswa yang dipantau (anak/wali).");
      return;
    }
    if (form.role === "SISWA" && !form.studentId) {
      toast.error("Pilih siswa pemilik akun.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        isActive: form.isActive,
      };
      if (form.role === "GURU") {
        body.guardianClassId = form.guardianClassId || null;
      }
      if (form.role === "ORANG_TUA") {
        body.guardianStudentId = form.guardianStudentId || null;
      }
      if (form.role === "SISWA") {
        body.studentId = form.studentId || null;
      }
      if (editing) {
        if (form.password) body.password = form.password;
      } else {
        body.password = form.password;
      }
      const res = editing
        ? await fetch(`/api/users/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Akun diperbarui." : "Akun dibuat.");
      setOpen(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(u: UserItem) {
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status");
      toast.success(u.isActive ? "Akun dinonaktifkan." : "Akun diaktifkan.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah status.");
    }
  }

  async function handleDelete(u: UserItem) {
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success("Akun dihapus.");
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Manajemen Akun
          </h2>
          <p className="text-sm text-muted-foreground">
            Kelola akun admin, operator, guru, orang tua, dan siswa.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-gold text-gold-foreground hover:bg-gold/90"
        >
          <Plus className="size-4" /> Tambah Akun
        </Button>
      </div>

      <Tabs
        value={roleFilter}
        onValueChange={(v) => setRoleFilter(v as RoleFilter)}
      >
        <TabsList className="flex-wrap h-auto">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label} ({counts[f.value]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="Belum ada akun"
              description="Tambahkan akun operator atau admin pertama Anda."
            />
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, email, atau siswa…"
                  className="max-w-xs"
                />
                <span className="ml-auto text-xs text-muted-foreground">
                  {accountCounter(total, counts[roleFilter], search.trim() !== "")}
                </span>
              </div>
              {items.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Tidak ditemukan"
                  description="Tidak ada akun yang cocok dengan filter atau pencarian Anda."
                />
              ) : (
                <>
                  <div className="rounded-md border">
                  <div className="table-scroll">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-10 min-w-[180px] bg-background">Nama</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Peran</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Dibuat</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((u) => {
                          const isSelf = me?.id === u.id;
                          return (
                            <TableRow key={u.id}>
                              <TableCell className="sticky left-0 z-10 bg-background font-medium">
                                <Highlighted text={u.name} query={search} />
                                {isSelf && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-[10px]"
                                  >
                                    Anda
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <Highlighted text={u.email} query={search} />
                              </TableCell>
                              <TableCell>
                                <Badge className={roleBadgeClass(u.role)}>
                                  {roleLabel(u.role)}
                                </Badge>
                                {u.role === "GURU" && u.guardianClassName && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Wali:{" "}
                                    <Highlighted
                                      text={u.guardianClassName}
                                      query={search}
                                    />
                                  </p>
                                )}
                                {u.role === "ORANG_TUA" &&
                                  u.guardianStudentName && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Anak:{" "}
                                      <Highlighted
                                        text={u.guardianStudentName}
                                        query={search}
                                      />
                                      {u.guardianStudentClassName
                                        ? ` (${u.guardianStudentClassName})`
                                        : ""}
                                    </p>
                                  )}
                                {u.role === "SISWA" && u.studentName && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {u.studentClassName ? (
                                      <>
                                        Kelas:{" "}
                                        <Highlighted
                                          text={u.studentClassName}
                                          query={search}
                                        />
                                      </>
                                    ) : (
                                      "Akun siswa"
                                    )}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                {u.isActive ? (
                                  <Badge className="bg-emerald-600 text-white">
                                    Aktif
                                  </Badge>
                                ) : (
                                  <Badge className="bg-muted text-muted-foreground">
                                    Nonaktif
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(u.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEdit(u)}
                                    aria-label="Edit akun"
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleActive(u)}
                                    disabled={isSelf}
                                  >
                                    {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                                  </Button>
                                  {isSelf ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled
                                            className="text-destructive hover:text-destructive"
                                            aria-label="Tidak dapat menghapus akun sendiri"
                                          >
                                            <Trash2 className="size-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <span className="inline-flex items-center gap-1">
                                          <ShieldAlert className="size-3" />
                                          Anda tidak dapat menghapus akun sendiri.
                                        </span>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <ConfirmDialog
                                      trigger={
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-destructive hover:text-destructive"
                                          aria-label="Hapus akun"
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      }
                                      title="Hapus Akun"
                                      description={`Hapus akun "${u.name}" (${u.email})?`}
                                      confirmText="Hapus"
                                      onConfirm={() => handleDelete(u)}
                                    />
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  </div>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPage={setPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Akun" : "Tambah Akun"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Perbarui detail akun. Kosongkan password jika tidak ingin mengubah."
                : "Isi data akun admin, operator, guru, orang tua, atau siswa baru."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u-name">Nama</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nama@mongisidi1.sch.id"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="u-password">
                  Password
                  {editing && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (kosongkan jika tidak diubah)
                    </span>
                  )}
                </Label>
                <Input
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder={editing ? "••••••••" : "Minimal 6 karakter"}
                />
              </div>
              <div className="space-y-2">
                <Label>Peran</Label>
                <Select
                  value={form.role}
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATOR">Operator</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="GURU">Guru</SelectItem>
                    <SelectItem value="ORANG_TUA">Orang Tua</SelectItem>
                    <SelectItem value="SISWA">Siswa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.role === "GURU" && (
              <div className="space-y-2">
                <Label>Wali Kelas</Label>
                <Select
                  value={form.guardianClassId}
                  onValueChange={(v) =>
                    setForm({ ...form, guardianClassId: v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih kelas wali" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Guru hanya dapat mengisi absensi di kelas wali-nya.
                </p>
              </div>
            )}
            {(form.role === "ORANG_TUA" || form.role === "SISWA") && (
              <div className="space-y-2">
                <Label htmlFor="u-student">
                  {form.role === "ORANG_TUA"
                    ? "Anak / Siswa yang Dipantau"
                    : "Siswa Pemilik Akun"}
                </Label>
                {/* Typeahead bersama (sama dengan form Data Prestasi) — ketik
                    nama/kelas/NIS lalu pilih dari daftar; mengetik manual
                    memutus tautan. */}
                <StudentTypeahead
                  id="u-student"
                  students={students}
                  query={
                    form.role === "ORANG_TUA"
                      ? form.guardianStudentName
                      : form.studentName
                  }
                  onQueryChange={(v) => {
                    setCarriedFrom(null); // admin ambil alih → petunjuk hilang
                    if (form.role === "ORANG_TUA") {
                      setForm({
                        ...form,
                        guardianStudentName: v,
                        guardianStudentId: "",
                      });
                    } else {
                      setForm({ ...form, studentName: v, studentId: "" });
                    }
                  }}
                  onPick={(s) => {
                    setCarriedFrom(null);
                    if (form.role === "ORANG_TUA") {
                      setForm({
                        ...form,
                        guardianStudentId: s.id,
                        guardianStudentName: s.name,
                      });
                    } else {
                      setForm({ ...form, studentId: s.id, studentName: s.name });
                    }
                  }}
                />
                {carriedFrom && (
                  <p className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <ArrowRightLeft className="size-3" />
                    Tautan dibawa dari {carriedFrom} — periksa sebelum menyimpan.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {form.role === "ORANG_TUA"
                    ? "Orang tua dapat melihat absensi anak melalui portal orang tua."
                    : "Siswa ini akan memiliki akun portal tersendiri."}
                </p>
              </div>
            )}
            {editing && (
              <div className="flex items-center gap-2">
                <Switch
                  id="u-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label htmlFor="u-active">Akun aktif</Label>
              </div>
            )}
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

export default UsersManager;

