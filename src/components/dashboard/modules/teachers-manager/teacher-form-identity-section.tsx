"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormState } from "./teacher-form-state";

type TeacherFormIdentitySectionProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
};

export function TeacherFormIdentitySection({
  form,
  setForm,
}: TeacherFormIdentitySectionProps) {
  return (
    <>
      <div className="h-px bg-border" />
      <p className="text-xs font-medium text-muted-foreground">
        Identitas & Kepegawaian (diisi otomatis dari Dapodik)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="t-nuptk">NUPTK</Label>
          <Input
            id="t-nuptk"
            value={form.nuptk}
            onChange={(e) => setForm({ ...form, nuptk: e.target.value })}
            placeholder="NUPTK"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-nip">NIP</Label>
          <Input
            id="t-nip"
            value={form.nip}
            onChange={(e) => setForm({ ...form, nip: e.target.value })}
            placeholder="NIP"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-nik">NIK</Label>
          <Input
            id="t-nik"
            value={form.nik}
            onChange={(e) => setForm({ ...form, nik: e.target.value })}
            placeholder="NIK"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-ttl">Tempat Lahir</Label>
          <Input
            id="t-ttl"
            value={form.tempatLahir}
            onChange={(e) =>
              setForm({ ...form, tempatLahir: e.target.value })
            }
            placeholder="Tempat lahir"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-tgl">Tanggal Lahir</Label>
          <Input
            id="t-tgl"
            type="date"
            value={form.tanggalLahir}
            onChange={(e) =>
              setForm({ ...form, tanggalLahir: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-gender">Jenis Kelamin</Label>
          <Select
            value={form.gender}
            onValueChange={(v) =>
              setForm({ ...form, gender: v === "none" ? "" : v })
            }
          >
            <SelectTrigger id="t-gender">
              <SelectValue placeholder="Pilih…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="LAKI_LAKI">Laki-laki</SelectItem>
              <SelectItem value="PEREMPUAN">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-agama">Agama</Label>
          <Input
            id="t-agama"
            value={form.agama}
            onChange={(e) => setForm({ ...form, agama: e.target.value })}
            placeholder="Mis. Islam"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-status">Status Kepegawaian</Label>
          <Input
            id="t-status"
            value={form.statusKepegawaian}
            onChange={(e) =>
              setForm({ ...form, statusKepegawaian: e.target.value })
            }
            placeholder="Mis. GTK/PTK"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-jenptk">Jenis PTK</Label>
          <Input
            id="t-jenptk"
            value={form.jenisPtk}
            onChange={(e) =>
              setForm({ ...form, jenisPtk: e.target.value })
            }
            placeholder="Mis. Guru Kelas"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-pangkat">Pangkat / Golongan</Label>
          <Input
            id="t-pangkat"
            value={form.pangkatGolongan}
            onChange={(e) =>
              setForm({ ...form, pangkatGolongan: e.target.value })
            }
            placeholder="Mis. Pembina, IV/a"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-bidang">Bidang Studi</Label>
          <Input
            id="t-bidang"
            value={form.bidangStudi}
            onChange={(e) =>
              setForm({ ...form, bidangStudi: e.target.value })
            }
            placeholder="Bidang studi"
          />
        </div>
      </div>
    </>
  );
}
