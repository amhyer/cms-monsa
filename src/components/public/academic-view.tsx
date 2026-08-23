"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  BookMarked,
  BookOpen,
  Compass,
  Globe,
  Music,
  Dumbbell,
  PartyPopper,
  Mic,
  Cpu,
  Palette,
  HeartHandshake,
  Sparkles,
  CalendarDays,
  Clock,
  MapPin,
  Mail,
  Phone,
  UserCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { SectionHeading } from "@/components/shared/section-heading";
import { PageBanner, SectionShell, CategoryBadge } from "./_shared";
import type { TeacherItem, AgendaItem } from "@/lib/types";

const EKSKUL = [
  { icon: Compass, name: "Pramuka", desc: "Membentuk karakter, kemandirian, dan jiwa kepemimpinan siswa sejak dini." },
  { icon: Music, name: "Drumband", desc: "Tim Drumband Monsa Jaya yang telah meraih banyak prestasi tingkat kota." },
  { icon: PartyPopper, name: "Seni Tari", desc: "Pelestarian seni tari tradisional Nusantara dan tarian modern." },
  { icon: BookMarked, name: "Tahfidz", desc: "Pembinaan menghafal Al-Qur'an (juz 30) bagi siswa muslim." },
  { icon: Globe, name: "English Club", desc: "Meningkatkan kemampuan berbahasa Inggris melalui permainan dan lagu." },
  { icon: Cpu, name: "Robotic", desc: "Pengenalan robotika dan dasar pemrograman untuk siswa SD." },
  { icon: Mic, name: "Paduan Suara", desc: "Vokal grup anak yang tampil di berbagai acara sekolah dan kota." },
  { icon: Dumbbell, name: "Futsal", desc: "Pengembangan bakat sepak bola dan kompetisi antar SD." },
  { icon: Palette, name: "Seni Rupa", desc: "Lomba mewarnai, menggambar, dan kerajinan tangan kreatif." },
  { icon: BookOpen, name: "Klub Literasi", desc: "Membudayakan kebiasaan membaca dan menulis siswa." },
  { icon: HeartHandshake, name: "Pembinaan Inklusi", desc: "Pendampingan kegiatan khusus bagi anak berkebutuhan khusus." },
  { icon: Sparkles, name: "Qasidah", desc: "Pembinaan seni religi dan rebana bagi siswa." },
];

function TeacherAvatar({ t }: { t: TeacherItem }) {
  const initials = t.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (t.photo) {
    return (
      <img
        src={t.photo}
        alt={t.name}
        loading="lazy"
        className="size-16 rounded-full border-2 border-gold object-cover"
      />
    );
  }
  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-sidebar-accent text-sm font-bold text-sidebar-foreground">
      {initials || "G"}
    </span>
  );
}

function TeacherCard({
  t,
  onOpen,
}: {
  t: TeacherItem;
  onOpen: (t: TeacherItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(t)}
      aria-label={`Lihat profil ${t.name}`}
      className="flex w-full flex-col gap-4 rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <TeacherAvatar t={t} />
        <div className="flex flex-1 flex-col gap-1">
          <h4 className="font-sans text-base font-bold leading-tight text-foreground">
            {t.name}
          </h4>
          <p className="text-xs font-medium text-gold-foreground">{t.position}</p>
          {t.education && (
            <p className="text-xs text-muted-foreground">{t.education}</p>
          )}
        </div>
      </div>
      {t.subject && t.subject !== "-" && (
        <div>
          <CategoryBadge category={t.subject} className="bg-primary text-primary-foreground" />
        </div>
      )}
      <span className="text-[11px] font-medium text-muted-foreground">
        Lihat profil & kontak
      </span>
    </button>
  );
}

export function AcademicView() {
  const [teachers, setTeachers] = useState<TeacherItem[] | null>(null);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [query, setQuery] = useState("");
  const [filterPosition, setFilterPosition] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  // Guru yang sedang dibuka di modal detail (bio/kontak — tanpa NUPTK/NIP/NIK).
  const [selected, setSelected] = useState<TeacherItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const _t = Date.now(); // cache-buster
        const [tRes, aRes] = await Promise.all([
          fetch(`/api/teachers?scope=public&_=${_t}`, { cache: "no-store" }),
          fetch(`/api/agenda?_=${_t}`, { cache: "no-store" }),
        ]);
        const tData = await tRes.json();
        const aData = await aRes.json();
        if (cancelled) return;
        setTeachers(Array.isArray(tData?.items) ? tData.items : []);
        setAgenda(Array.isArray(aData?.items) ? aData.items : []);
      } catch {
        if (!cancelled) {
          setTeachers([]);
          setAgenda([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Get unique positions and subjects for filters
  const uniquePositions = useMemo(() => {
    if (!teachers) return [];
    const positions = new Set<string>();
    teachers.forEach((t) => positions.add(t.position));
    return Array.from(positions).sort();
  }, [teachers]);

  const uniqueSubjects = useMemo(() => {
    if (!teachers) return [];
    const subjects = new Set<string>();
    teachers.forEach((t) => {
      if (t.subject && t.subject !== "-") subjects.add(t.subject);
    });
    return Array.from(subjects).sort();
  }, [teachers]);

  // Teacher statistics
  const teacherStats = useMemo(() => {
    if (!teachers) return null;
    return {
      total: teachers.length,
      active: teachers.filter((t) => t.isActive).length,
      teachers: teachers.filter((t) => t.position.toLowerCase().includes("guru")).length,
      staff: teachers.filter((t) => !t.position.toLowerCase().includes("guru")).length,
    };
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    if (!teachers) return null;
    const q = query.trim().toLowerCase();
    return teachers.filter((t) => {
      // Text search
      const matchesQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.position.toLowerCase().includes(q) ||
        (t.subject ?? "").toLowerCase().includes(q);
      // Position filter
      const matchesPosition =
        filterPosition === "all" || t.position === filterPosition;
      // Subject filter
      const matchesSubject =
        filterSubject === "all" || t.subject === filterSubject;
      return matchesQuery && matchesPosition && matchesSubject;
    });
  }, [teachers, query, filterPosition, filterSubject]);

  // Group agenda by month
  const groupedAgenda = useMemo(() => {
    const groups: Record<string, AgendaItem[]> = {};
    agenda.forEach((a) => {
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return;
      const key = new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(d);
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    // sort items within each month by date asc
    Object.values(groups).forEach((arr) =>
      arr.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );
    return Object.entries(groups);
  }, [agenda]);

  return (
    <>
      <PageBanner
        eyebrow="Direktori & Kalender"
        title="Akademik & Direktori"
        description="Direktori guru dan staf, kalender akademik, serta kegiatan ekstrakurikuler."
      />

      {/* Direktori Guru */}
      <SectionShell>
        <div className="flex flex-col gap-6">
          {/* Teacher Statistics */}
          {teacherStats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-primary">{teacherStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Guru & Staf</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{teacherStats.active}</p>
                <p className="text-xs text-muted-foreground">Aktif</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{teacherStats.teachers}</p>
                <p className="text-xs text-muted-foreground">Guru</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{teacherStats.staff}</p>
                <p className="text-xs text-muted-foreground">Tenaga Kependidikan</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Tenaga Pendidik"
              title="Direktori Guru & Staf"
            />
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari nama…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Cari guru atau staf"
                />
              </div>
              {/* Position Filter */}
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="all">Semua Jabatan</option>
                {uniquePositions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {/* Subject Filter */}
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="all">Semua Mapel</option>
                {uniqueSubjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredTeachers === null ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-4 rounded-xl border bg-card p-5"
                >
                  <Skeleton className="size-16 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Tidak ditemukan guru/staf yang sesuai pencarian.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeachers.map((t) => (
                <TeacherCard key={t.id} t={t} onOpen={setSelected} />
              ))}
            </div>
          )}
        </div>
      </SectionShell>

      {/* Kalender Akademik */}
      <SectionShell className="bg-muted/40">
        <SectionHeading
          eyebrow="Jadwal Sekolah"
          title="Kalender Akademik"
          description="Agenda dan kegiatan penting sekolah sepanjang tahun ajaran."
        />
        <div className="mt-8 flex flex-col gap-8">
          {groupedAgenda.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Belum ada agenda yang terjadwalkan.
            </div>
          ) : (
            groupedAgenda.map(([month, items]) => (
              <div key={month} className="flex flex-col gap-3">
                <h3 className="font-sans text-lg font-bold text-foreground">
                  {month}
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {items.map((a) => {
                    const d = new Date(a.date);
                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
                          <span className="text-lg font-bold leading-none">
                            {isNaN(d.getTime()) ? "-" : d.getDate()}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-gold">
                            {isNaN(d.getTime())
                              ? "-"
                              : new Intl.DateTimeFormat("id-ID", {
                                  month: "short",
                                }).format(d)}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-foreground">
                              {a.title}
                            </h4>
                            <CategoryBadge category={a.category} />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {a.time && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3.5" /> {a.time}
                              </span>
                            )}
                            {a.location && a.location !== "-" && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3.5" /> {a.location}
                              </span>
                            )}
                          </div>
                          {a.description && (
                            <p className="text-xs text-muted-foreground">
                              {a.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </SectionShell>

      {/* Ekstrakurikuler */}
      <SectionShell>
        <SectionHeading
          eyebrow="Pengembangan Diri"
          title="Ekstrakurikuler"
          description="Beragam kegiatan ekstrakurikuler untuk mengembangkan minat, bakat, dan karakter siswa."
          center
        />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EKSKUL.map((e) => {
            const Icon = e.icon;
            return (
              <div
                key={e.name}
                className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground ring-2 ring-gold/30">
                  <Icon className="size-5 text-gold" />
                </span>
                <div className="flex flex-col gap-1">
                  <h4 className="font-sans text-base font-bold text-foreground">
                    {e.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">{e.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionShell>

      {/* Mini banner */}
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-3 px-4 py-10 sm:px-6 sm:py-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="size-8 text-gold" />
            <div>
              <h3 className="font-sans text-lg font-bold sm:text-xl">
                Kalender Akademik 2025/2026
              </h3>
              <p className="text-sm text-sidebar-foreground/80">
                Jadwal lengkap dapat diunduh pada halaman pengumuman.
              </p>
            </div>
          </div>
          <Music className="size-7 text-gold" />
        </div>
      </section>

      {/* Modal detail profil guru — bio/kontak, TANPA NUPTK/NIP/NIK (kunci
          identitas sudah di-strip oleh GET publik /api/teachers). */}
      <Dialog
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>{selected?.position}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {selected?.photo ? (
              <img
                src={selected.photo}
                alt={selected.name}
                className="size-28 shrink-0 rounded-full border object-cover"
              />
            ) : (
              <span className="flex size-28 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground ring-2 ring-gold/40">
                <UserCircle2 className="size-14 text-gold" />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-3">
              {selected?.subject && selected.subject !== "-" && (
                <div>
                  <CategoryBadge
                    category={selected.subject}
                    className="bg-primary text-primary-foreground"
                  />
                </div>
              )}
              {selected?.riwayat && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {selected.riwayat}
                </p>
              )}
              {(selected?.email || selected?.phone) && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {selected.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="size-4 text-gold" />
                      <a
                        href={`mailto:${selected.email}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {selected.email}
                      </a>
                    </p>
                  )}
                  {selected.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-4 text-gold" />
                      <a
                        href={`tel:${selected.phone}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {selected.phone}
                      </a>
                    </p>
                  )}
                </div>
              )}
              {!selected?.riwayat && !selected?.email && !selected?.phone && (
                <p className="text-sm text-muted-foreground">
                  Profil singkat guru belum tersedia.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-wrap">
            {selected && (
              <Button variant="ghost" asChild>
                <Link
                  href={`/academic/guru/${selected.id}`}
                  onClick={() => setSelected(null)}
                >
                  Lihat profil lengkap
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelected(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
