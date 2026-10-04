"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Save } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BosExpenditureItem } from "@/lib/types";
import { SOURCES, type FormState } from "./form-state";

type ExpenditureFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: BosExpenditureItem | null;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  saving: boolean;
  onSave: () => void;
};

export function ExpenditureFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  saving,
  onSave,
}: ExpenditureFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={onSave} disabled={saving}>
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
  );
}
