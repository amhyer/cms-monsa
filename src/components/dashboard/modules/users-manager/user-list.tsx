"use client";

import { useState } from "react";
import {
  Pencil,
  Trash2,
  ShieldAlert,
  Trash,
  Power,
  PowerOff,
  Users,
} from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Highlighted } from "@/components/shared/highlighted";
import { formatDate } from "@/lib/format";
import type { UserItem } from "@/lib/types";
import { roleBadgeClass, roleLabel } from "./user-shared";

export function UserList({
  items,
  search,
  meId,
  onEdit,
  onRefresh,
}: {
  items: UserItem[];
  search: string;
  meId: string | undefined;
  onEdit: (u: UserItem) => void;
  onRefresh: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const hasSelection = selectedIds.size > 0;

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
      onRefresh();
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
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  // --- Bulk actions ---

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((u) => u.id)));
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "users", ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success(`${data.deleted} akun dihapus.`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkToggleActive(activate: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      let success = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await fetch(`/api/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: activate }),
        });
        if (res.ok) success++; else failed++;
      }
      toast.success(`${success} akun ${activate ? "diaktifkan" : "dinonaktifkan"}${failed > 0 ? `, ${failed} gagal` : ""}.`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkRoleChange(newRole: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !newRole) return;
    setBulkLoading(true);
    try {
      let success = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await fetch(`/api/users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });
        if (res.ok) success++; else failed++;
      }
      toast.success(`${success} akun diubah ke ${roleLabel(newRole)}${failed > 0 ? `, ${failed} gagal` : ""}.`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <>
      {/* Bulk action toolbar */}
      {hasSelection && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <span className="text-sm font-medium">
            <Users className="mr-1 inline size-4" />
            {selectedIds.size} dipilih
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkLoading}
              onClick={() => handleBulkToggleActive(true)}
            >
              <Power className="size-3.5" /> Aktifkan
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkLoading}
              onClick={() => handleBulkToggleActive(false)}
            >
              <PowerOff className="size-3.5" /> Nonaktifkan
            </Button>
            <Select onValueChange={handleBulkRoleChange} disabled={bulkLoading}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Ubah Peran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">Admin</SelectItem>
                <SelectItem value="OPERATOR">Operator</SelectItem>
                <SelectItem value="GURU">Guru</SelectItem>
                <SelectItem value="ORANG_TUA">Orang Tua</SelectItem>
                <SelectItem value="SISWA">Siswa</SelectItem>
              </SelectContent>
            </Select>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm" disabled={bulkLoading}>
                  <Trash className="size-3.5" /> Hapus
                </Button>
              }
              title="Hapus Akun Terpilih"
              description={`Hapus ${selectedIds.size} akun yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
              confirmText="Hapus Semua"
              onConfirm={handleBulkDelete}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
      <div className="rounded-md border">
      <div className="table-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                  className="size-4 rounded border-gray-300"
                  aria-label="Pilih semua"
                />
              </TableHead>
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
              const isSelf = meId === u.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelect(u.id)}
                      disabled={isSelf}
                      className="size-4 rounded border-gray-300"
                      aria-label={`Pilih ${u.name}`}
                    />
                  </TableCell>
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
                        onClick={() => onEdit(u)}
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
    </>
  );
}
