"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  UserCog,
  ShieldAlert,
  Search,
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppStore } from "@/store/app";
import { formatDate } from "@/lib/format";
import type { UserItem } from "@/lib/types";
import { PageLoader, EmptyState } from "../_shared";
import { useSearch } from "../use-search";

type FormState = {
  name: string;
  email: string;
  password: string;
  role: "OPERATOR" | "SUPER_ADMIN" | "GURU";
  guardianClassId: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  password: "",
  role: "OPERATOR",
  guardianClassId: "",
  isActive: true,
};

export function UsersManager() {
  const me = useAppStore((s) => s.user);
  const [items, setItems] = useState<UserItem[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { search, setSearch, filtered } = useSearch(items, (u) =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase()
  );
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Anda tidak memiliki akses ke modul ini.");
        }
        throw new Error();
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (open && form.role === "GURU" && classes.length === 0) fetchClasses();
  }, [open, form.role, classes.length, fetchClasses]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(u: UserItem) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : u.role === "GURU" ? "GURU" : "OPERATOR",
      guardianClassId: u.guardianClassId ?? "",
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
            Kelola akun admin, operator, dan guru.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-gold text-gold-foreground hover:bg-gold/90"
        >
          <Plus className="size-4" /> Tambah Akun
        </Button>
      </div>

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
                  placeholder="Cari nama atau email…"
                  className="max-w-xs"
                />
                <span className="ml-auto text-xs text-muted-foreground">
                  {filtered.length} dari {items.length} akun
                </span>
              </div>
              {filtered.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Tidak ditemukan"
                  description="Tidak ada akun yang cocok dengan pencarian Anda."
                />
              ) : (
            <div className="rounded-md border">
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const isSelf = me?.id === u.id;
                    const isAdmin = u.role === "SUPER_ADMIN";
                    const isGuru = u.role === "GURU";
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.name}
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
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              isAdmin
                                ? "bg-gold text-gold-foreground"
                                : isGuru
                                  ? "bg-violet-600 text-white"
                                  : "bg-primary text-primary-foreground"
                            }
                          >
                            {isAdmin ? "Admin" : isGuru ? "Guru" : "Operator"}
                          </Badge>
                          {isGuru && u.guardianClassName && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              Wali: {u.guardianClassName}
                            </span>
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
                : "Isi data akun admin, operator, atau guru baru."}
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
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      role: v as "OPERATOR" | "SUPER_ADMIN" | "GURU",
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATOR">Operator</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="GURU">Guru</SelectItem>
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
