"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Save, ArrowRightLeft } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StudentTypeahead } from "../../student-typeahead";
import type { UserItem } from "@/lib/types";
import type { ClassOption, FormState, StudentOption } from "./user-shared";

export function UserFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onRoleChange,
  onClearCarried,
  classes,
  students,
  carriedFrom,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: UserItem | null;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  onRoleChange: (v: string) => void;
  onClearCarried: () => void;
  classes: ClassOption[];
  students: StudentOption[];
  carriedFrom: string | null;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onValueChange={onRoleChange}
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
                  onClearCarried(); // admin ambil alih → petunjuk hilang
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
                  onClearCarried();
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
