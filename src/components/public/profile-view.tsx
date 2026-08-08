"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Computer,
  Library,
  Trophy,
  Building,
  Church,
  UtensilsCrossed,
  HeartPulse,
  Sprout,
  HeartHandshake,
  Music,
  Quote,
  Target,
  Eye,
  History,
  GraduationCap,
  Award,
  UserCircle2,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { SectionHeading } from "@/components/shared/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBanner, SectionShell } from "./_shared";
import type { TeacherItem } from "@/lib/types";

const FACILITIES = [
  { icon: Computer, label: "Lab Komputer" },
  { icon: Library, label: "Perpustakaan" },
  { icon: Trophy, label: "Lapangan Olahraga" },
  { icon: Building, label: "Aula Serbaguna" },
  { icon: Church, label: "Musholla" },
  { icon: UtensilsCrossed, label: "Kantin Sehat" },
  { icon: HeartPulse, label: "UKS" },
  { icon: Sprout, label: "Green House" },
  { icon: HeartHandshake, label: "Ruang Inklusi" },
  { icon: Music, label: "Ruang Drumband" },
];

function LeaderCard({ t }: { t: TeacherItem }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {t.photo ? (
        <img
          src={t.photo}
          alt={t.name}
          loading="lazy"
          className="size-24 rounded-full border-2 border-gold object-cover"
        />
      ) : (
        <span className="flex size-24 items-center justify-center rounded-full border-2 border-gold bg-muted text-muted-foreground">
          <UserCircle2 className="size-12" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <h4 className="font-sans text-base font-bold leading-tight text-foreground">
          {t.name}
        </h4>
        <p className="text-xs font-medium text-gold-foreground">{t.position}</p>
        {t.subject && t.subject !== "-" && (
          <p className="text-xs text-muted-foreground">Bidang: {t.subject}</p>
        )}
      </div>
    </div>
  );
}

export function ProfileView() {
  const settings = useAppStore((s) => s.settings);
  const [leaders, setLeaders] = useState<TeacherItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const _t = Date.now(); // cache-buster
        const res = await fetch(`/api/teachers?scope=public&_=${_t}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        const all: TeacherItem[] = Array.isArray(data?.items) ? data.items : [];
        const filtered = all.filter(
          (t) =>
            t.position.toLowerCase().includes("kepala") ||
            t.position.toLowerCase().includes("wakil")
        );
        setLeaders(filtered);
      } catch {
        if (!cancelled) setLeaders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const missions = (settings?.mission ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <PageBanner
        eyebrow="Tentang Kami"
        title="Profil Sekolah"
        description="Mengenal lebih dekat sejarah, visi-misi, dan struktur SD Negeri Unggulan Mongisidi 1."
      />

      {/* Sejarah */}
      <SectionShell>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <SectionHeading
              eyebrow="Awal Mula"
              title="Sejarah Singkat"
            />
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8 lg:col-span-2">
            <div className="flex items-start gap-3">
              <History className="mt-1 size-6 shrink-0 text-gold" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground sm:text-base">
              {settings?.history}
            </p>
          </div>
        </div>
      </SectionShell>

      {/* Visi & Misi */}
      <SectionShell className="bg-muted/40">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border-2 border-gold bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Eye className="size-5 text-gold" />
              </span>
              <h3 className="font-sans text-xl font-bold text-foreground">
                Visi
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground sm:text-base">
              {settings?.vision}
            </p>
          </div>
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Target className="size-5 text-gold" />
              </span>
              <h3 className="font-sans text-xl font-bold text-foreground">
                Misi
              </h3>
            </div>
            <ol className="flex flex-col gap-3">
              {missions.map((m, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-gold-foreground">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed text-foreground">{m}</span>
                </li>
              ))}
              {missions.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Misi sekolah belum tersedia.
                </li>
              )}
            </ol>
          </div>
        </div>
      </SectionShell>

      {/* Struktur Organisasi */}
      <SectionShell>
        <SectionHeading
          eyebrow="Kepemimpinan"
          title="Struktur Organisasi"
          description="Para pemimpin yang menggerakkan roda pendidikan di SD Negeri Unggulan Mongisidi 1."
          center
        />
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {leaders === null
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center"
                >
                  <Skeleton className="size-24 rounded-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            : leaders.length === 0
              ? (
                <div className="col-span-full rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  Data pimpinan sekolah belum tersedia.
                </div>
              )
              : leaders.map((t) => <LeaderCard key={t.id} t={t} />)}
        </div>
      </SectionShell>

      {/* Fasilitas */}
      <SectionShell className="bg-muted/40">
        <SectionHeading
          eyebrow="Sarana & Prasarana"
          title="Fasilitas Sekolah"
          description="Fasilitas lengkap untuk menunjang kegiatan belajar mengajar dan pengembangan minat bakat siswa."
          center
        />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {FACILITIES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                className="group flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-gold/40 transition-transform group-hover:scale-105">
                  <Icon className="size-7 text-gold" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {f.label}
                </span>
              </div>
            );
          })}
        </div>
      </SectionShell>

      {/* Quote band */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-6 sm:py-20">
          <Quote className="size-10 text-gold" />
          <p className="max-w-3xl font-sans text-xl font-medium leading-relaxed sm:text-2xl md:text-3xl">
            &ldquo;Pendidikan adalah senjata paling ampuh untuk mengubah dunia.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gold" />
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="size-4 text-gold" />
              <span className="font-semibold">{settings?.principalName}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mini stats footer band */}
      <SectionShell>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Award, label: "Akreditasi", value: "A (Unggul)" },
            { icon: Building2, label: "Berdiri Sejak", value: "1965" },
            { icon: GraduationCap, label: "Tenaga Pendidik", value: `${settings?.teacherCount ?? 0} Guru` },
            { icon: Trophy, label: "Total Prestasi", value: `${settings?.achievementCount ?? 0}` },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center shadow-sm"
              >
                <Icon className="size-6 text-gold" />
                <span className="font-sans text-lg font-bold text-foreground">
                  {s.value}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </SectionShell>
    </>
  );
}
