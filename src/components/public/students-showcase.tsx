"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  Camera,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeading } from "@/components/shared/section-heading";
import { CopyableId } from "@/components/shared/copyable-id";
import { SectionShell } from "./_shared";
import type { ClassItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type ShowcaseItem = {
  id: string;
  name: string;
  photoUrl: string | null;
  className: string;
  nis: string | null;
  nisn: string | null;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function StudentCard({
  s,
  compact,
}: {
  s: ShowcaseItem;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "w-28 shrink-0" : "w-full"
      )}
    >
      {s.photoUrl ? (
        <img
          src={s.photoUrl}
          alt={s.name}
          loading="lazy"
          className={cn(
            "aspect-square rounded-2xl border object-cover shadow-sm",
            compact ? "w-28" : "w-full max-w-40"
          )}
        />
      ) : (
        <div
          className={cn(
            "flex aspect-square items-center justify-center rounded-2xl border bg-muted font-sans font-bold text-muted-foreground",
            compact ? "w-28 text-lg" : "w-full max-w-40 text-2xl"
          )}
        >
          {initials(s.name)}
        </div>
      )}
      <p className="mt-2 w-full truncate text-xs font-semibold text-foreground">
        {s.name}
      </p>
      <p className="w-full truncate text-[10px] text-muted-foreground">
        {s.className}
      </p>
      {/* Identitas siswa (NIS/NISN) — bisa disalin sekali klik untuk
          pengecekan silang Dapodik; varian ringkas di kartu marquee. */}
      {(s.nis || s.nisn) && (
        <div className="mt-1 w-full space-y-0.5">
          {s.nis && (
            <CopyableId label="NIS" value={s.nis} compact={compact} />
          )}
          {s.nisn && (
            <CopyableId label="NISN" value={s.nisn} compact={compact} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Galeri siswa di beranda: foto siswa tampil bergantian (marquee) agar orang
 * tua mudah menemukan anaknya; pencarian nama & filter kelas tersedia.
 */
export function StudentsShowcase() {
  const [marqueeItems, setMarqueeItems] = useState<ShowcaseItem[] | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [q, setQ] = useState("");
  const [classId, setClassId] = useState("");
  // Pause marquee (WCAG 2.2.2 — konten bergerak otomatis perlu kontrol jeda).
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState<ShowcaseItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(false);

  const searching = q.trim() !== "" || classId !== "";

  // Marquee content: siswa berfoto didahulukan, maksimal 60 untuk performa.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/students/showcase?limit=60", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (cancelled) return;
        const items: ShowcaseItem[] = Array.isArray(data?.items)
          ? data.items
          : [];
        items.sort(
          (a, b) =>
            Number(b.photoUrl !== null) - Number(a.photoUrl !== null) ||
            a.name.localeCompare(b.name, "id")
        );
        setMarqueeItems(items);
      } catch {
        if (!cancelled) {
          setMarqueeItems([]);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Daftar kelas untuk filter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/classes", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setClasses(Array.isArray(data?.items) ? data.items : []);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pencarian (debounce 300ms) & filter kelas.
  useEffect(() => {
    if (!searching) {
      setResults(null);
      setPage(1);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const params = new URLSearchParams();
          if (q.trim()) params.set("q", q.trim());
          if (classId) params.set("classId", classId);
          params.set("page", String(page));
          params.set("limit", "24");
          const res = await fetch(`/api/students/showcase?${params.toString()}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error("fetch failed");
          const data = await res.json();
          if (cancelled) return;
          setResults(Array.isArray(data?.items) ? data.items : []);
          setTotalPages(data?.totalPages ?? 1);
        } catch {
          if (!cancelled) setResults([]);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, classId, page, searching]);

  const withPhotos = useMemo(
    () => (marqueeItems ?? []).filter((s) => s.photoUrl).slice(0, 60),
    [marqueeItems]
  );
  const strip = withPhotos.length > 0 ? withPhotos : (marqueeItems ?? []).slice(0, 60);

  const resetFilter = () => {
    setQ("");
    setClassId("");
    setPage(1);
  };

  return (
    <SectionShell className="bg-muted/40">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Wajah Sekolah"
          title="Galeri Siswa"
          description="Seluruh siswa tampil bergantian di sini — cari nama atau pilih kelas untuk menemukan putra/putri Anda."
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama siswa…"
              className="h-10 w-full pl-9 sm:w-64"
              aria-label="Cari nama siswa"
            />
          </div>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
            aria-label="Filter kelas"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear})
              </option>
            ))}
          </select>
        </div>
      </div>

      {searching ? (
        /* ---------- Mode pencarian: grid hasil ---------- */
        <div className="mt-8">
          {results === null ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {Array.from({ length: 16 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
              <Users className="size-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">
                Siswa tidak ditemukan
              </p>
              <p className="text-sm text-muted-foreground">
                Tidak ada hasil untuk kata kunci/kelas tersebut.
              </p>
              <Button variant="outline" size="sm" onClick={resetFilter}>
                Reset pencarian
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {results.slice(0, 24).map((s) => (
                  <StudentCard key={s.id} s={s} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="size-4" /> Sebelumnya
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Halaman {page} dari {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Selanjutnya <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ) : marqueeItems === null ? (
        /* ---------- Loading marquee ---------- */
        <div className="mt-10 flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-28 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : error && strip.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
          <Camera className="size-10 text-muted-foreground" />
          <p className="font-semibold text-foreground">Galeri belum tersedia</p>
          <p className="text-sm text-muted-foreground">
            Terjadi kesalahan saat memuat galeri siswa.
          </p>
        </div>
      ) : (
        /* ---------- Mode default: marquee berputar ---------- */
        <div className="mt-10 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div
            className="flex w-max animate-marquee items-start gap-5 pb-1"
            // Inline style: mengalahkan shorthand `animation:` dari
            // .animate-marquee (urutan CSS tak bisa dijamin untuk kelas).
            style={paused ? { animationPlayState: "paused" } : undefined}
          >
            {strip.map((s, i) => (
              <StudentCard key={`${s.id}-${i}`} s={s} compact />
            ))}
            {/* Salinan kedua hanya untuk loop animasi yang mulus —
                disembunyikan dari screen reader (display:contents menjaga layout). */}
            <div aria-hidden className="contents">
              {strip.map((s, i) => (
                <StudentCard key={`${s.id}-dup-${i}`} s={s} compact />
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
            {strip.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                aria-label={paused ? "Putar animasi" : "Jeda animasi"}
                // Sembunyikan saat prefers-reduced-motion — animasi sudah mati.
                className="motion-reduce:hidden"
              >
                {paused ? (
                  <Play className="size-3.5" />
                ) : (
                  <Pause className="size-3.5" />
                )}
                {paused ? "Putar" : "Jeda"}
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {strip.length > 0
                ? `Menampilkan ${strip.length} siswa terbaru — gunakan pencarian di atas untuk melihat siswa lain.`
                : "Galeri foto siswa akan segera dilengkapi."}
            </p>
          </div>
        </div>
      )}
    </SectionShell>
  );
}