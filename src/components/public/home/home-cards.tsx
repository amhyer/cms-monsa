"use client";

import { useRouter } from "next/navigation";
import { Image } from "@/components/shared/smart-image";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  MapPin,
  Trophy,
  Users,
  Award,
  Newspaper,
} from "lucide-react";
import { CopyableId } from "@/components/shared/copyable-id";
import { CategoryBadge } from "../_shared";
import { formatDate } from "@/lib/format";
import type {
  NewsItem,
  AgendaItem,
  AchievementItem,
  EventItem,
} from "@/lib/types";

/* ----------------------------- News card ----------------------------- */
export function NewsCard({ item }: { item: NewsItem }) {
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
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
export function StatCard({
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

/* ----------------------------- Event card ----------------------------- */
export function EventCard({ item }: { item: EventItem }) {
  const d = new Date(item.startDate);
  const day = isNaN(d.getTime()) ? "-" : d.getDate();
  const month = isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d);
  const weekday = isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);

  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-gold text-gold-foreground">
        <span className="text-lg font-bold leading-none">{day}</span>
        <span className="text-[10px] uppercase tracking-wide">
          {month}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h4 className="font-semibold leading-snug text-foreground">
          {item.title}
        </h4>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" /> {weekday}
          </span>
          {item.location && (
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

/* ----------------------------- Agenda row ----------------------------- */
export function AgendaRow({ item }: { item: AgendaItem }) {
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
export function AchievementCard({ item }: { item: AchievementItem }) {
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
