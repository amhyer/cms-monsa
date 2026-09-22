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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/shared/image-upload";
import type { TeacherItem } from "@/lib/types";
import type { FormState } from "./teacher-form-state";
import { TeacherFormIdentitySection } from "./teacher-form-identity-section";

type TeacherFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TeacherItem | null;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  saving: boolean;
  onSave: () => void;
};

export function TeacherFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  saving,
  onSave,
}: TeacherFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <TeacherFormIdentitySection form={form} setForm={setForm} />
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
          <div className="h-px bg-border" />
          <p className="text-xs font-medium text-muted-foreground">
            Ketersediaan & Jam Konsultasi (opsional)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="t-officeHours">Jam Konsultasi</Label>
              <Input
                id="t-officeHours"
                value={form.officeHours}
                onChange={(e) => setForm({ ...form, officeHours: e.target.value })}
                placeholder="Mis. Senin-Kamis 08:00-15:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-languages">Bahasa</Label>
              <Input
                id="t-languages"
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
                placeholder="Mis. Indonesia, Inggris, Arab"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="t-consultationNote">Catatan Konsultasi</Label>
              <Input
                id="t-consultationNote"
                value={form.consultationNote}
                onChange={(e) => setForm({ ...form, consultationNote: e.target.value })}
                placeholder="Mis. Konsultasi via WhatsApp atau langsung ke sekolah"
              />
            </div>
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
