"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, UserCog, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/store/app";
import type { UserItem } from "@/lib/types";
import { carryStudentLink, type RoleFilter } from "@/lib/user-roles";
import { PageLoader, EmptyState, CursorPagination, usePersistedPageSize, useCursorPagination } from "../../_shared";
import { EMPTY, type FormState, type Role, type UserCounts } from "./user-shared";
import { RoleFilterTabs, UserSearchBar } from "./user-filters";
import { UserList } from "./user-list";
import { UserFormDialog } from "./user-form-dialog";

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
  const [pageSize, setPageSize] = usePersistedPageSize("users", 10, [10, 25, 50]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const cp = useCursorPagination({ limit: pageSize, total, nextCursor });
  // reset stabil (useCallback [] di _shared.tsx) — didestructure agar bisa masuk
  // deps useEffect tanpa memicu re-run tiap render (objek cp dibuat ulang).
  const { reset: resetCp } = cp;
  const [counts, setCounts] = useState<UserCounts>({
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
        limit: String(pageSize),
      });
      if (cp.currentCursor) params.set("cursor", cp.currentCursor);
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
      setNextCursor(data.nextCursor ?? null);
      setCounts(
        data.counts ?? { all: 0, STAFF: 0, GURU: 0, ORANG_TUA: 0, SISWA: 0 }
      );
    } catch {
    } finally {
      setLoading(false);
    }
  }, [cp.currentCursor, pageSize, roleFilter, debounced]);

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
    resetCp();
  }, [resetCp, debounced, roleFilter, pageSize]);

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

      <RoleFilterTabs value={roleFilter} onValueChange={setRoleFilter} counts={counts} />

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
              <UserSearchBar
                search={search}
                onSearchChange={setSearch}
                total={total}
                roleFilter={roleFilter}
                counts={counts}
              />
              {items.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Tidak ditemukan"
                  description="Tidak ada akun yang cocok dengan filter atau pencarian Anda."
                />
              ) : (
                <>
                  <UserList
                    items={items}
                    search={search}
                    meId={me?.id}
                    onEdit={openEdit}
                    onRefresh={fetchList}
                  />
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
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <UserFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        onRoleChange={handleRoleChange}
        onClearCarried={() => setCarriedFrom(null)}
        classes={classes}
        students={students}
        carriedFrom={carriedFrom}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}

export default UsersManager;
