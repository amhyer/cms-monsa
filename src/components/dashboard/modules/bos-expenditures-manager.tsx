"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Landmark,
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { BosExpenditureItem } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { PageLoader, EmptyState } from "../_shared";

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

export function BosExpendituresManager() {
  const [items, setItems] = useState<BosExpenditureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [yearFilter, setYearFilter] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BosExpenditureItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bos-expenditures", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error("Gagal memuat data anggaran.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const years = useMemo(
    () => Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a),
    [items]
  );

  const visible = useMemo(
    () =>
      yearFilter === "all"
        ? items
        : items.filter((i) => i.year === Number(yearFilter)),
    [items, yearFilter]
  );

  const totalAmount = useMemo(
    () => visible.reduce((acc, i) => acc + i.amount, 0),
    [visible]
  );

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
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  if (loading) return <PageLoader label="Memuat data anggaran…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Transparansi Anggaran (ARKAS / Dana BOS)
          </h2>
          <p className="text-sm text-muted-foreground">
            Publikasi belanja dana BOS yang tampil untuk semua pengunjung situs
            (khusus Super Admin).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Tambah Belanja
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Semua Tahun" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tahun</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-sm">
          {visible.length} item · Total {formatCurrency(totalAmount)}
        </Badge>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Belum ada data anggaran"
          description="Tambahkan belanja dana BOS (mis. honorarium, sarana prasarana) agar transparansi anggaran tampil di website."
          icon={Landmark}
        />
      ) : (
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
                {visible.map((item) => (
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
      )}

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
