"use client";

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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/shared/image-upload";
import type { ClassItem, StudentItem } from "@/lib/types";
import type { FormState } from "./types";

type StudentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StudentItem | null;
  form: FormState;
  onFormChange: (form: FormState) => void;
  classes: ClassItem[];
  saving: boolean;
  onSave: () => void;
};

export function StudentFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  classes,
  saving,
  onSave,
}: StudentFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onChange={(e) => onFormChange({ ...form, nis: e.target.value })}
                placeholder="Nomor Induk Siswa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-nisn">NISN</Label>
              <Input
                id="s-nisn"
                value={form.nisn}
                onChange={(e) => onFormChange({ ...form, nisn: e.target.value })}
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
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Nama lengkap siswa"
              />
            </div>
            <ImageUpload
              label="Foto"
              aspect="square"
              value={form.photoUrl}
              onChange={(url) => onFormChange({ ...form, photoUrl: url })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-dob">Tanggal Lahir</Label>
              <Input
                id="s-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => onFormChange({ ...form, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <Select
                value={form.gender || "none"}
                onValueChange={(v) => onFormChange({ ...form, gender: v === "none" ? "" : v })}
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
            <Select value={form.classId} onValueChange={(v) => onFormChange({ ...form, classId: v })}>
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
              onChange={(e) => onFormChange({ ...form, address: e.target.value })}
              placeholder="Alamat tempat tinggal"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-phone">Telepon Siswa</Label>
              <Input
                id="s-phone"
                value={form.phone}
                onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
                placeholder="No. telepon siswa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email Siswa</Label>
              <Input
                id="s-email"
                type="email"
                value={form.email}
                onChange={(e) => onFormChange({ ...form, email: e.target.value })}
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
                onChange={(e) => onFormChange({ ...form, parentName: e.target.value })}
                placeholder="Nama ayah/ibu/wali"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-parent-phone">Telepon Orang Tua</Label>
              <Input
                id="s-parent-phone"
                value={form.parentPhone}
                onChange={(e) => onFormChange({ ...form, parentPhone: e.target.value })}
                placeholder="No. telepon ortu/wali"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="s-active"
              checked={form.isActive}
              onCheckedChange={(v) => onFormChange({ ...form, isActive: v })}
            />
            <Label htmlFor="s-active">Siswa aktif</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={onSave} disabled={saving}>
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
  );
}
