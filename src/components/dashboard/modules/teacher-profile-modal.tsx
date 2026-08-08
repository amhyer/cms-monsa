"use client";

import type { TeacherItem } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  MessageCircle,
  GraduationCap,
  Briefcase,
  Crown,
  BookOpen,
  Award,
  UserCircle2,
} from "lucide-react";

function isKepalaSekolah(t: TeacherItem): boolean {
  return t.position.toLowerCase().includes("kepala sekolah");
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function TeacherProfileModal({
  teacher,
  open,
  onOpenChange,
}: {
  teacher: TeacherItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!teacher) return null;
  const t = teacher;
  const badges = t.badges
    ?.split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  const waNumber = t.phone?.replace(/[^\d+]/g, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Profil {t.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Profil pendidik dan tenaga kependidikan
          </DialogDescription>
        </DialogHeader>

        {/* Blok 1 — Identitas */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            {t.photo ? (
              <img
                src={t.photo}
                alt={t.name}
                className="size-28 rounded-full border-4 border-gold object-cover"
              />
            ) : (
              <div className="flex size-28 items-center justify-center rounded-full border-4 border-gold bg-muted text-foreground/40">
                <UserCircle2 className="size-14" />
              </div>
            )}
            {isKepalaSekolah(t) && (
              <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-gold-foreground shadow">
                <Crown className="size-3" /> Kepala Sekolah
              </span>
            )}
          </div>
          <div>
            <h3 className="font-sans text-xl font-bold text-foreground">{t.name}</h3>
            {t.motto && (
              <p className="mt-0.5 text-sm italic text-muted-foreground">
                “{t.motto}”
              </p>
            )}
            <p className="mt-1 text-sm font-medium text-primary">{t.position}</p>
            {badges && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {badges.map((b) => (
                  <Badge key={b} variant="secondary" className="text-xs">
                    {b}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Blok 1b — Data identitas */}
          <div className="rounded-xl border bg-card p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <UserCircle2 className="size-4 text-primary" /> Data Diri
            </h4>
            <dl className="space-y-1.5 text-sm">
              {t.nuptk && <Row label="NUPTK" value={t.nuptk} />}
              {t.nip && <Row label="NIP" value={t.nip} />}
              {t.nik && <Row label="NIK" value={t.nik} />}
              {(t.tempatLahir || t.tanggalLahir) && (
                <Row
                  label="Tempat, Tgl Lahir"
                  value={[t.tempatLahir, formatDate(t.tanggalLahir)]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
              {t.gender && (
                <Row
                  label="Jenis Kelamin"
                  value={t.gender === "LAKI_LAKI" ? "Laki-laki" : t.gender === "PEREMPUAN" ? "Perempuan" : t.gender}
                />
              )}
              {t.agama && <Row label="Agama" value={t.agama} />}
              {t.statusKepegawaian && <Row label="Status Kepegawaian" value={t.statusKepegawaian} />}
              {t.pangkatGolongan && <Row label="Pangkat / Golongan" value={t.pangkatGolongan} />}
            </dl>
          </div>

          {/* Blok 2 — Mengajar */}
          <div className="rounded-xl border bg-card p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="size-4 text-primary" /> Mengajar
            </h4>
            <dl className="space-y-1.5 text-sm">
              <Row label="Jenis PTK" value={t.jenisPtk || t.position} />
              {t.homeroomClasses && t.homeroomClasses.length > 0 && (
                <>
                  {t.homeroomClasses.map((c) => (
                    <Row key={c.id} label="Wali Kelas" value={c.name} className="text-primary" />
                  ))}
                </>
              )}
              {t.subject && t.subject !== "-" && <Row label="Mata Pelajaran" value={t.subject} />}
              {t.bidangStudi && <Row label="Bidang Studi" value={t.bidangStudi} />}
            </dl>
          </div>

          {/* Pendidikan */}
          <div className="rounded-xl border bg-card p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <GraduationCap className="size-4 text-primary" /> Pendidikan
            </h4>
            <dl className="space-y-1.5 text-sm">
              <Row label="Pendidikan Terakhir" value={t.education} />
              {t.sertifikasi && <Row label="Sertifikasi/Diklat" value={t.sertifikasi} />}
            </dl>
          </div>

          {/* Blok 3 — Kontak */}
          <div className="rounded-xl border bg-card p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="size-4 text-primary" /> Kontak & Aksi
            </h4>
            <dl className="space-y-1.5 text-sm">
              {t.phone && <Row label="No. HP" value={t.phone} />}
              {t.email && <Row label="E-Mail" value={t.email} />}
            </dl>
            {(t.phone || t.email) && (
              <div className="mt-3 flex flex-col gap-2">
                {waNumber && (
                  <a
                    href={`https://wa.me/62${waNumber.startsWith("0") ? waNumber.slice(1) : waNumber}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                      <MessageCircle className="size-4" /> Chat WhatsApp
                    </Button>
                  </a>
                )}
                {t.phone && (
                  <a href={`tel:${t.phone}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Phone className="size-4" /> Telepon
                    </Button>
                  </a>
                )}
                {t.email && (
                  <a href={`mailto:${t.email}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full">
                      <Mail className="size-4" /> Kirim E-Mail
                    </Button>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Blok 4 — Riwayat & prestasi */}
        {(t.riwayat || t.prestasi) && (
          <div className="space-y-3">
            {t.riwayat && (
              <div className="rounded-xl border bg-card p-4">
                <h4 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="size-4 text-primary" /> Riwayat Singkat
                </h4>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{t.riwayat}</p>
              </div>
            )}
            {t.prestasi && (
              <div className="rounded-xl border bg-card p-4">
                <h4 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <Award className="size-4 text-primary" /> Prestasi
                </h4>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{t.prestasi}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | string[] | null | undefined;
  className?: string;
}) {
  if (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }
  const v = Array.isArray(value) ? value.join(", ") : value;
  if (!v) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-right text-sm font-medium ${className}`}>{v}</dd>
    </div>
  );
}