"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  Play,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Images,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageBanner, SectionShell, CategoryBadge } from "./_shared";
import { ErrorState } from "@/components/shared/error-state";
import { GALLERY_CATEGORIES } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import type { GalleryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type TypeFilter = "ALL" | "PHOTO" | "VIDEO";

export function GalleryView() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [type, setType] = useState<TypeFilter>("ALL");
  const [category, setCategory] = useState<string>("");
  const [error, setError] = useState(false);

  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        if (type !== "ALL") params.set("type", type);
        const res = await fetch(`/api/gallery?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) {
          setItems([]);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, type]);

  const filtered = useMemo(() => items ?? [], [items]);

  const goPrev = () => {
    if (activeIdx === null) return;
    setActiveIdx((activeIdx - 1 + filtered.length) % filtered.length);
  };
  const goNext = () => {
    if (activeIdx === null) return;
    setActiveIdx((activeIdx + 1) % filtered.length);
  };

  const activeItem = activeIdx !== null ? filtered[activeIdx] : null;

  return (
    <>
      <PageBanner
        eyebrow="Dokumentasi"
        title="Galeri Kegiatan"
        description="Dokumentasi foto dan video kegiatan, prestasi, serta fasilitas SD Negeri Unggulan Mongisidi 1."
      />

      <SectionShell>
        {/* Filter tabs */}
        <div className="flex flex-col gap-4">
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Filter tipe media"
          >
            {(["ALL", "PHOTO", "VIDEO"] as TypeFilter[]).map((t) => (
              <FilterPill
                key={t}
                label={t === "ALL" ? "Semua" : t === "PHOTO" ? "Foto" : "Video"}
                active={type === t}
                onClick={() => setType(t)}
              />
            ))}
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Filter kategori"
          >
            <FilterPill
              label="Semua Kategori"
              active={category === ""}
              onClick={() => setCategory("")}
            />
            {GALLERY_CATEGORIES.map((c) => (
              <FilterPill
                key={c}
                label={c}
                active={category === c}
                onClick={() => setCategory(c)}
              />
            ))}
          </div>
        </div>

        {/* Grid */}
        {error ? (
          <div className="mt-8">
            <ErrorState
              title="Gagal memuat galeri"
              description="Terjadi kesalahan saat memuat media galeri. Periksa koneksi Anda lalu coba lagi."
              onRetry={() => setType((t) => t)}
            />
          </div>
        ) : items === null ? (
          <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-full"
                style={{ aspectRatio: i % 3 === 0 ? "4/3" : "1/1" }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
            <Images className="size-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">Belum ada media</p>
            <p className="text-sm text-muted-foreground">
              Tidak ada item galeri pada kategori/tipe ini.
            </p>
          </div>
        ) : (
          <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
            {filtered.map((g, idx) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className="group relative block w-full overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Lihat ${g.title}`}
              >
                <div
                  className="relative w-full overflow-hidden bg-muted"
                  style={{ aspectRatio: "4/3" }}
                >
                  {g.thumbnail || g.url ? (
                    <img
                      src={g.thumbnail ?? g.url}
                      alt={g.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                      <ImageIcon className="size-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent opacity-90" />
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-white shadow-sm",
                        g.type === "VIDEO" ? "bg-gold text-gold-foreground" : "bg-primary"
                      )}
                      aria-hidden
                    >
                      {g.type === "VIDEO" ? (
                        <Play className="size-4" />
                      ) : (
                        <ImageIcon className="size-4" />
                      )}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3 text-left text-primary-foreground">
                    <CategoryBadge
                      category={g.category}
                      className="w-fit bg-gold text-gold-foreground"
                    />
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                      {g.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary-foreground/80">
                      <CalendarDays className="size-3" />
                      {formatDate(g.createdAt)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionShell>

      {/* Lightbox */}
      <Dialog
        open={activeIdx !== null}
        onOpenChange={(o) => !o && setActiveIdx(null)}
      >
        <DialogContent className="max-w-5xl bg-background/95 p-0 sm:p-0">
          <DialogTitle className="sr-only">
            {activeItem?.title ?? "Pratinjau media"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pratinjau media galeri.
          </DialogDescription>

          {activeItem && (
            <div className="flex flex-col">
              <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black">
                {activeItem.type === "VIDEO" ? (
                  <iframe
                    src={activeItem.url}
                    title={activeItem.title}
                    className="size-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : activeItem.url || activeItem.thumbnail ? (
                  <img
                    src={activeItem.url ?? activeItem.thumbnail}
                    alt={activeItem.title}
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-black text-muted-foreground">
                    <ImageIcon className="size-16" />
                  </div>
                )}

                {/* Prev/Next */}
                {filtered.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      aria-label="Sebelumnya"
                      className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md transition-colors hover:bg-background"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      aria-label="Berikutnya"
                      className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md transition-colors hover:bg-background"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge
                    category={activeItem.category}
                    className="bg-gold text-gold-foreground"
                  />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {formatDate(activeItem.createdAt)}
                  </span>
                </div>
                <h3 className="font-sans text-lg font-bold text-foreground">
                  {activeItem.title}
                </h3>
                {activeItem.description && (
                  <p className="text-sm text-muted-foreground">
                    {activeItem.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-xs font-semibold transition-all sm:text-sm",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
