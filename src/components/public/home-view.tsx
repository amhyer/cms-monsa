"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Quote,
  Trophy,
  Users,
  Building2,
  Award,
  PencilLine,
  BookOpen,
  ExternalLink,
  Newspaper,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeading } from "@/components/shared/section-heading";
import { CopyableId } from "@/components/shared/copyable-id";
import { RunningAnnouncements } from "./running-announcements";
import { CategoryBadge, SectionShell } from "./_shared";
import { StudentsShowcase } from "./students-showcase";
import { ErrorState } from "@/components/shared/error-state";
import { formatDate, truncate } from "@/lib/format";
import type {
  NewsItem,
  AgendaItem,
  AchievementItem,
} from "@/lib/types";

/* ----------------------------- Hero carousel ----------------------------- */
function HeroCarousel({ items }: { items: NewsItem[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Berita terkini"
      className="relative w-full overflow-hidden bg-sidebar"
    >
      <div className="relative h-[60vh] min-h-[420px] w-full sm:h-[70vh]">
        <AnimatePresence mode="wait">
          {items.map((n, i) =>
            i === index ? (
              <motion.div
                key={n.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {n.coverImage ? (
                  <img
                    src={n.coverImage}
                    alt={n.title}
                    className="size-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                    <Newspaper className="size-16" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-sidebar/95 via-sidebar/80 to-sidebar/40" />
              </motion.div>
            ) : null
          )}
        </AnimatePresence>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl items-end px-4 pb-10 sm:px-6 sm:pb-16">
          <div className="max-w-2xl text-sidebar-foreground">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
              <span className="h-px w-6 bg-gold" />
              Berita Terkini
            </span>
            <AnimatePresence mode="wait">
              <motion.h2
                key={items[index].id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="mt-3 font-sans text-2xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl"
              >
                {items[index].title}
              </motion.h2>
            </AnimatePresence>
            <p className="mt-4 hidden max-w-xl text-sm text-sidebar-foreground/85 sm:block sm:text-base">
              {truncate(items[index].excerpt, 160)}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="bg-gold text-gold-foreground hover:bg-gold/90"
                onClick={() => router.push(`/news/${items[index].slug}`)}
              >
                Baca Selengkapnya
                <ArrowRight className="size-4" />
              </Button>
              <span className="text-xs text-sidebar-foreground/70">
                {formatDate(items[index].publishedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Dots */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 sm:bottom-8 sm:right-8">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={
                i === index
                  ? "size-2.5 rounded-full bg-gold transition-all"
                  : "size-2.5 rounded-full bg-sidebar-foreground/40 transition-all hover:bg-sidebar-foreground/70"
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- News card ----------------------------- */
function NewsCard({ item }: { item: NewsItem }) {
  const router = useRouter();
  return (
    <article
      onClick={() => router.push(`/news/${item.slug}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/news/${item.slug}`);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Baca berita: ${item.title}`}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {item.coverImage ? (
          <img
            src={item.coverImage}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <Newspaper className="size-10" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <CategoryBadge category={item.category} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {formatDate(item.publishedAt)}
        </div>
        <h3 className="line-clamp-2 font-sans text-base font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
          {item.title}
        </h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {item.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary transition-colors group-hover:text-gold-foreground">
          Baca selengkapnya
          <ChevronRight className="size-3.5" />
        </div>
      </div>
    </article>
  );
}

/* ----------------------------- Stat card ----------------------------- */
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground ring-2 ring-gold/40">
        <Icon className="size-6 text-gold" />
      </span>
      <div className="flex flex-col">
        <span className="font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {value.toLocaleString("id-ID")}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- Agenda row ----------------------------- */
function AgendaRow({ item }: { item: AgendaItem }) {
  const d = new Date(item.date);
  const day = isNaN(d.getTime()) ? "-" : d.getDate();
  const month = isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d);

  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
        <span className="text-lg font-bold leading-none">{day}</span>
        <span className="text-[10px] uppercase tracking-wide text-gold">
          {month}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h4 className="font-semibold leading-snug text-foreground">
          {item.title}
        </h4>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {item.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {item.time}
            </span>
          )}
          {item.location && item.location !== "-" && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {item.location}
            </span>
          )}
        </div>
        <div className="mt-1">
          <CategoryBadge category={item.category} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Achievement card ----------------------------- */
function AchievementCard({ item }: { item: AchievementItem }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-3 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-full bg-gold/15 text-gold-foreground sm:size-10">
          <Trophy className="size-4 text-gold sm:size-5" />
        </span>
        <span className="inline-flex items-center rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground sm:px-2.5">
          {item.level}
        </span>
      </div>
      <h4 className="font-sans text-sm font-bold leading-snug text-foreground sm:text-base">
        {item.title}
      </h4>
      <p className="text-xs text-muted-foreground sm:text-sm">
        {item.studentName ?? "Tim Sekolah"}
      </p>
      {/* Identitas siswa tertaut (NIS/NISN) — sama seperti kartu dashboard,
          bisa disalin sekali klik untuk pengecekan silang Dapodik. */}
      {(item.studentNis || item.studentNisn) && (
        <div className="space-y-0.5 pt-1">
          {item.studentNis && <CopyableId label="NIS" value={item.studentNis} />}
          {item.studentNisn && <CopyableId label="NISN" value={item.studentNisn} />}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Award className="size-3.5" /> {item.category}
        </span>
        <span>{formatDate(item.date)}</span>
      </div>
    </div>
  );
}

/* ----------------------------- HomeView ----------------------------- */
export function HomeView() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);

  const [hero, setHero] = useState<NewsItem[] | null>(null);
  const [latestNews, setLatestNews] = useState<NewsItem[] | null>(null);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loadError, setLoadError] = useState(false);

  const loadHome = () => {
    let cancelled = false;
    setLoadError(false);
    (async () => {
      try {
        // Browser respects Cache-Control headers from API routes (s-maxage for
        // CDN, max-age for browser). No cache-busting needed — the API sets
        // appropriate staleness windows per route.
        const [newsRes, agendaRes, achRes] = await Promise.all([
          fetch("/api/news?scope=public&limit=3"),
          fetch("/api/agenda?upcoming=true"),
          fetch("/api/achievements?limit=3"),
        ]);
        if (!newsRes.ok || !agendaRes.ok || !achRes.ok) throw new Error("fetch failed");
        const newsData = await newsRes.json();
        const agendaData = await agendaRes.json();
        const achData = await achRes.json();
        if (cancelled) return;
        const newsItems: NewsItem[] = Array.isArray(newsData?.items)
          ? newsData.items
          : [];
        setHero(newsItems);
        setLatestNews(newsItems);
        setAgenda(
          Array.isArray(agendaData?.items) ? agendaData.items.slice(0, 4) : []
        );
        setAchievements(Array.isArray(achData?.items) ? achData.items : []);
      } catch {
        if (cancelled) return;
        setHero([]);
        setLatestNews([]);
        setAgenda([]);
        setAchievements([]);
        setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    const cleanup = loadHome();
    return cleanup;
  }, []);

  const isLoading = hero === null && !loadError;

  return (
    <>
      {/* sr-only H1 for SEO & screen readers */}
      <h1 className="sr-only">
        {settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1"}
      </h1>

      {/* Hero */}
      {hero === null ? (
        <div className="h-[60vh] min-h-[420px] w-full bg-sidebar sm:h-[70vh]" />
      ) : hero.length > 0 ? (
        <HeroCarousel items={hero} />
      ) : (
        <section className="bg-sidebar py-20 text-center text-sidebar-foreground">
          <p className="text-sm">Selamat datang di SD Negeri Unggulan Mongisidi 1</p>
        </section>
      )}

      <RunningAnnouncements />

      {loadError && (
        <SectionShell>
          <ErrorState
            title="Gagal memuat beranda"
            description="Terjadi kesalahan saat memuat konten beranda. Periksa koneksi Anda lalu coba lagi."
            onRetry={loadHome}
          />
        </SectionShell>
      )}

      {/* Sambutan Kepala Sekolah */}
      <SectionShell>
        <div className="grid grid-cols-1 items-center gap-8 rounded-2xl border bg-card p-6 shadow-sm sm:p-10 md:grid-cols-3">
          <div className="flex flex-col items-center md:col-span-1">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gold/30 blur-sm" />
              {settings?.principalPhoto ? (
                <img
                  src={settings.principalPhoto}
                  alt={settings.principalName ?? "Kepala Sekolah"}
                  className="relative size-72 rounded-full border-4 border-gold object-cover shadow-lg sm:size-96 md:w-[384px] md:h-[384px]"
                />
              ) : (
                <div className="relative flex size-72 items-center justify-center rounded-full border-4 border-gold bg-muted shadow-lg sm:size-96 md:w-[384px] md:h-[384px]">
                  <GraduationCap className="size-24 text-muted-foreground" />
                </div>
              )}
            </div>
            <Quote className="mt-4 size-6 text-gold" />
          </div>
          <div className="md:col-span-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-foreground">
              <span className="h-px w-6 bg-gold" />
              Sambutan Kepala Sekolah
            </span>
            <p className="mt-4 text-base leading-relaxed text-foreground sm:text-lg">
              &ldquo;{settings?.principalWelcome}&rdquo;
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span className="h-px w-8 bg-gold" />
              <div>
                <p className="font-sans font-bold text-foreground">
                  {settings?.principalName}
                </p>
                <p className="text-xs text-muted-foreground">Kepala Sekolah</p>
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* Statistik Cepat */}
      <SectionShell className="bg-muted/40">
        <SectionHeading
          eyebrow="Sekolah Dalam Angka"
          title="Statistik Cepat"
          description="Data terkini kapasitas dan capaian SD Negeri Unggulan Mongisidi 1."
          center
        />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Siswa"
            value={settings?.studentCount ?? 0}
          />
          <StatCard
            icon={GraduationCap}
            label="Guru"
            value={settings?.teacherCount ?? 0}
          />
          <StatCard
            icon={Building2}
            label="Fasilitas"
            value={settings?.facilityCount ?? 0}
          />
          <StatCard
            icon={Trophy}
            label="Prestasi"
            value={settings?.achievementCount ?? 0}
          />
        </div>
      </SectionShell>

      {/* Galeri Siswa (berputar + pencarian oleh orang tua) */}
      <StudentsShowcase />

      {/* Berita Terbaru */}
      <SectionShell>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Kabar Terbaru"
            title="Berita & Kegiatan"
            description="Informasi terkini seputar kegiatan dan capaian sekolah."
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/news")}
          >
            Lihat semua
            <ArrowRight className="size-4" />
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {latestNews === null
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 overflow-hidden rounded-xl border bg-card"
                >
                  <Skeleton className="aspect-[16/10] w-full rounded-none" />
                  <div className="flex flex-col gap-3 p-5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                </div>
              ))
            : latestNews.map((n) => <NewsCard key={n.id} item={n} />)}
        </div>
      </SectionShell>

      {/* Agenda + Prestasi (two column) */}
      <SectionShell className="bg-muted/40">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Agenda */}
          <div className="flex flex-col gap-5">
            <div className="flex items-end justify-between">
              <SectionHeading
                eyebrow="Yang Akan Datang"
                title="Agenda Mendatang"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push("/academic")}
                className="hidden sm:inline-flex"
              >
                Lihat semua
                <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <Skeleton className="size-14 shrink-0 rounded-lg" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : agenda.length === 0 ? (
                <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  Belum ada agenda mendatang.
                </div>
              ) : (
                agenda.map((a) => <AgendaRow key={a.id} item={a} />)
              )}
            </div>
          </div>

          {/* Prestasi */}
          <div className="flex flex-col gap-5">
            <div className="flex items-end justify-between">
              <SectionHeading
                eyebrow="Bangga Sekolah"
                title="Prestasi Terbaru"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push("/news")}
                className="hidden sm:inline-flex"
              >
                Lihat semua
                <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm sm:p-5"
                  >
                    <Skeleton className="size-8 shrink-0 rounded-full sm:size-10" />
                    <div className="flex flex-1 flex-col gap-2 pt-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))
              ) : achievements.length === 0 ? (
                <div className="col-span-full rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  Belum ada prestasi terbaru.
                </div>
              ) : (
                achievements.map((a) => (
                  <AchievementCard key={a.id} item={a} />
                ))
              )}
            </div>
          </div>
        </div>
      </SectionShell>

      {/* CTA SPMB */}
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-12 sm:px-6 sm:py-16 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
              <BookOpen className="size-4" />
              SPMB 2025/2026
            </span>
            <h2 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Sistem Penerimaan Murid Baru (SPMB) 2025/2026 Dibuka!
            </h2>
            <p className="max-w-2xl text-sm text-sidebar-foreground/80 sm:text-base">
              Bergabunglah bersama kami membangun generasi unggul yang beriman,
              berakhlak mulia, dan berdaya saing global. Pendaftaran dilakukan
              melalui portal SPMB resmi Kota Makassar.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={() => {
              if (settings?.spmbLink) {
                window.open(settings.spmbLink, "_blank", "noopener,noreferrer");
              } else {
                router.push("/contact");
              }
            }}
          >
            <PencilLine className="size-4" />
            Daftar SPMB
            <ExternalLink className="size-4 opacity-80" />
          </Button>
        </div>
      </section>
    </>
  );
}
