"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Crown,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Github,
  Globe,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  UserCircle2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBanner } from "./_shared";
import { SectionRenderer } from "./section-renderer";
import { TeacherContactCard } from "@/components/shared/teacher-contact-card";
import { TeacherRating } from "./teacher-rating";
import type { TeacherItem } from "@/lib/types";

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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function TeacherPortfolioView({ guruId }: { guruId?: string }) {
  const [t, setT] = useState<TeacherItem | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "notfound">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!guruId) {
        if (!cancelled) setStatus("notfound");
        return;
      }
      try {
        const res = await fetch(`/api/teachers/${guruId}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setT(data.item || null);
        setStatus(data.item ? "found" : "notfound");
      } catch {
        if (!cancelled) setStatus("notfound");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guruId]);

  return (
    <>
      <PageBanner
        eyebrow="Portofolio"
        title="Profil Guru & Staf"
        description="Berkenalan lebih dekat dengan pendidik dan tenaga kependidikan kami."
      />

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {status === "loading" && (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </div>
          </div>
        )}

        {status === "notfound" && (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-center">
            <Users className="size-10 text-muted-foreground" />
            <h2 className="font-sans text-lg font-bold">
              Profil tidak ditemukan
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Guru atau staf yang Anda cari tidak tersedia (tidak aktif atau
              tautan salah).
            </p>
            <Link href="/academic">
              <Button variant="outline">
                <ArrowLeft className="size-4" /> Kembali ke Direktori
              </Button>
            </Link>
          </div>
        )}

        {status === "found" && t && (
          <>
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-primary to-primary/90 p-6 text-primary-foreground shadow-sm sm:p-8">
              <div className="absolute -right-10 -top-10 size-52 rounded-full bg-gold/20 blur-2xl" />
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <div className="shrink-0">
                  {t.photo ? (
                    <img
                      src={t.photo}
                      alt={t.name}
                      className="size-28 rounded-full border-4 border-gold object-cover shadow-lg"
                    />
                  ) : (
                    <span className="flex size-28 items-center justify-center rounded-full border-4 border-gold bg-background/20 text-4xl font-bold">
                      {t.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase() || "G"}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <h1 className="font-sans text-2xl font-bold sm:text-3xl">
                      {t.name}
                    </h1>
                    {isKepalaSekolah(t) && (
                      <Badge className="gap-1 bg-gold text-gold-foreground">
                        <Crown className="size-3" /> Kepala Sekolah
                      </Badge>
                    )}
                  </div>
                  <p className="text-base font-medium text-gold">
                    {t.position}
                  </p>
                  {t.motto && (
                    <p className="max-w-xl text-center text-sm italic text-primary-foreground/85 sm:text-left">
                      “{t.motto}”
                    </p>
                  )}
                  {t.badges && (
                    <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                      {t.badges
                        .split(",")
                        .map((b) => b.trim())
                        .filter(Boolean)
                        .map((b) => (
                          <Badge key={b} variant="secondary" className="text-xs">
                            {b}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              {/* Kolom utama */}
              <div className="space-y-4">
                {t.riwayat && (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="mb-2 flex items-center gap-2 font-sans text-base font-bold">
                      <Briefcase className="size-4 text-primary" /> Tentang Saya
                    </h2>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {t.riwayat}
                    </p>
                  </section>
                )}

                {t.prestasi && (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="mb-2 flex items-center gap-2 font-sans text-base font-bold">
                      <Award className="size-4 text-primary" /> Prestasi &
                      Penghargaan
                    </h2>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {t.prestasi}
                    </p>
                  </section>
                )}

                {t.homeroomClasses && t.homeroomClasses.length > 0 && (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-sans text-base font-bold">
                      <Users className="size-4 text-primary" /> Wali Kelas
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {t.homeroomClasses.map((c) => (
                        <Badge key={c.id} variant="outline">
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* Custom sections added by teacher */}
                <SectionRenderer teacherId={t.id} />
              </div>

              {/* Kolom kanan */}
              <div className="space-y-4">
                <section className="rounded-xl border bg-card p-5">
                  <h2 className="mb-2 flex items-center gap-2 font-sans text-base font-bold">
                    <UserCircle2 className="size-4 text-primary" /> Data Diri
                  </h2>
                  <dl>
                    {/* NUPTK/NIP/NIK sengaja TIDAK dirender di publik — API
                        sudah strip (no-leak contract, lihat identity-no-leak.spec). */}
                    <InfoRow
                      label="Tempat & Tgl Lahir"
                      value={[t.tempatLahir, formatDate(t.tanggalLahir)]
                        .filter(Boolean)
                        .join(", ")}
                    />
                    <InfoRow
                      label="Jenis Kelamin"
                      value={
                        t.gender === "LAKI_LAKI"
                          ? "Laki-laki"
                          : t.gender === "PEREMPUAN"
                            ? "Perempuan"
                            : t.gender
                      }
                    />
                    <InfoRow label="Agama" value={t.agama} />
                  </dl>
                </section>

                <section className="rounded-xl border bg-card p-5">
                  <h2 className="mb-2 flex items-center gap-2 font-sans text-base font-bold">
                    <Briefcase className="size-4 text-primary" /> Kepegawaian
                  </h2>
                  <dl>
                    <InfoRow label="Status" value={t.statusKepegawaian} />
                    <InfoRow label="Jenis PTK" value={t.jenisPtk} />
                    <InfoRow label="Pangkat / Golongan" value={t.pangkatGolongan} />
                  </dl>
                </section>

                <section className="rounded-xl border bg-card p-5">
                  <h2 className="mb-2 flex items-center gap-2 font-sans text-base font-bold">
                    <BookOpen className="size-4 text-primary" /> Mengajar
                  </h2>
                  <dl>
                    <InfoRow label="Mata Pelajaran" value={t.subject} />
                    <InfoRow label="Bidang Studi" value={t.bidangStudi} />
                  </dl>
                </section>

                <section className="rounded-xl border bg-card p-5">
                  <h2 className="mb-2 flex items-center gap-2 font-sans text-base font-bold">
                    <GraduationCap className="size-4 text-primary" /> Pendidikan
                  </h2>
                  <dl>
                    <InfoRow label="Terakhir" value={t.education} />
                    <InfoRow label="Sertifikasi / Diklat" value={t.sertifikasi} />
                  </dl>
                </section>

                {(t.phone || t.email) && (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-sans text-base font-bold">
                      <Phone className="size-4 text-primary" /> Kontak
                    </h2>
                    <div className="flex flex-col gap-2">
                      {t.phone && (
                        <a
                          href={`https://wa.me/62${
                            t.phone.startsWith("0") ? t.phone.slice(1) : t.phone
                          }`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full"
                        >
                          <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                            <MessageCircle className="size-4" /> WhatsApp
                          </Button>
                        </a>
                      )}
                      {t.phone && (
                        <a href={`tel:${t.phone}`} className="w-full">
                          <Button variant="outline" className="w-full gap-2">
                            <Phone className="size-4" /> {t.phone}
                          </Button>
                        </a>
                      )}
                      {t.email && (
                        <a href={`mailto:${t.email}`} className="w-full">
                          <Button variant="outline" className="w-full gap-2">
                            <Mail className="size-4" /> {t.email}
                          </Button>
                        </a>
                      )}
                    </div>
                  </section>
                )}

                {/* Portofolio & Media Sosial */}
                {(t.cvUrl || t.linkedinUrl || t.githubUrl || t.websiteUrl) && (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-sans text-base font-bold">
                      <Globe className="size-4 text-primary" /> Portofolio & Media Sosial
                    </h2>
                    <div className="flex flex-col gap-2">
                      {t.cvUrl && (
                        <a href={t.cvUrl} target="_blank" rel="noreferrer" className="w-full">
                          <Button variant="outline" className="w-full gap-2">
                            <Download className="size-4" /> Download CV/Resume
                          </Button>
                        </a>
                      )}
                      {t.linkedinUrl && (
                        <a href={t.linkedinUrl} target="_blank" rel="noreferrer" className="w-full">
                          <Button variant="outline" className="w-full gap-2">
                            <Linkedin className="size-4" /> LinkedIn
                          </Button>
                        </a>
                      )}
                      {t.githubUrl && (
                        <a href={t.githubUrl} target="_blank" rel="noreferrer" className="w-full">
                          <Button variant="outline" className="w-full gap-2">
                            <Github className="size-4" /> GitHub
                          </Button>
                        </a>
                      )}
                      {t.websiteUrl && (
                        <a href={t.websiteUrl} target="_blank" rel="noreferrer" className="w-full">
                          <Button variant="outline" className="w-full gap-2">
                            <ExternalLink className="size-4" /> Website Personal
                          </Button>
                        </a>
                      )}
                    </div>
                  </section>
                )}

                {/* Ketersediaan & Jam Konsultasi */}
                {(t.officeHours || t.languages) && (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-sans text-base font-bold">
                      <Globe className="size-4 text-primary" /> Ketersediaan
                    </h2>
                    <dl className="space-y-2">
                      {t.officeHours && (
                        <InfoRow label="Jam Konsultasi" value={t.officeHours} />
                      )}
                      {t.languages && (
                        <InfoRow label="Bahasa" value={t.languages} />
                      )}
                    </dl>
                  </section>
                )}

                {/* Rating & Review */}
                <TeacherRating teacherId={t.id} />
              </div>
            </div>

            {/* Contact Card Actions */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 font-sans text-base font-bold">
                Hubungi & Bagikan
              </h2>
              <TeacherContactCard teacher={t} />
            </div>

            <div className="flex justify-center">
              <Link href="/academic">
                <Button variant="ghost" className="gap-2">
                  <ArrowLeft className="size-4" />
                  Kembali ke Direktori Guru
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}