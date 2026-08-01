"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Newspaper,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBanner, SectionShell, CategoryBadge } from "./_shared";
import { ErrorState } from "@/components/shared/error-state";
import { NEWS_CATEGORIES } from "@/lib/nav";
import { formatDate, truncate } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 9;

export function NewsView() {
  const navigate = useAppStore((s) => s.navigate);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  // Reset to page 1 when category changes
  useEffect(() => {
    setPage(1);
  }, [category]);

  // Fetch on filter/page change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const params = new URLSearchParams({
          scope: "public",
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (category) params.set("category", category);
        if (debounced) params.set("search", debounced);
        const res = await fetch(`/api/news?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(data?.total ?? 0);
        setTotalPages(data?.totalPages ?? 1);
      } catch {
        if (!cancelled) {
          setItems([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, category, debounced]);

  const pageNumbers = useMemo(() => {
    const arr: number[] = [];
    const max = totalPages;
    const start = Math.max(1, page - 2);
    const end = Math.min(max, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  return (
    <>
      <PageBanner
        eyebrow="Informasi Sekolah"
        title="Berita & Pengumuman"
        description="Berita terkini, kegiatan, prestasi, dan pengumuman resmi dari SD Negeri Unggulan Mongisidi 1."
      />

      <SectionShell>
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari berita…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Cari berita"
            />
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Filter kategori"
          >
            <CategoryPill
              label="Semua"
              active={category === ""}
              onClick={() => setCategory("")}
            />
            {NEWS_CATEGORIES.map((c) => (
              <CategoryPill
                key={c}
                label={c}
                active={category === c}
                onClick={() => setCategory(c)}
              />
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {error ? (
            <div className="col-span-full">
              <ErrorState
                title="Gagal memuat berita"
                description="Terjadi kesalahan saat memuat daftar berita. Periksa koneksi Anda lalu coba lagi."
                onRetry={() => setDebounced((d) => d + " ")}
              />
            </div>
          ) : loading || items === null
            ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
            : items.length === 0
              ? (
                <div className="col-span-full flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
                  <Newspaper className="size-10 text-muted-foreground" />
                  <p className="font-semibold text-foreground">
                    Tidak ada berita
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Coba ubah kata kunci atau kategori pencarian Anda.
                  </p>
                </div>
              )
              : items.map((n) => (
                  <article
                    key={n.id}
                    onClick={() => navigate(`/news/${n.slug}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/news/${n.slug}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Baca berita: ${n.title}`}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                      <img
                        src={n.coverImage ?? ""}
                        alt={n.title}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3">
                        <CategoryBadge category={n.category} />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {formatDate(n.publishedAt)}
                      </div>
                      <h3 className="line-clamp-2 font-sans text-base font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {n.title}
                      </h3>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {truncate(n.excerpt, 140)}
                      </p>
                    </div>
                  </article>
                ))}
        </div>

        {/* Pagination */}
        {!loading && items !== null && items.length > 0 && totalPages > 1 && (
          <nav
            aria-label="Navigasi halaman"
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {pageNumbers.map((p) => (
              <Button
                key={p}
                type="button"
                variant={p === page ? "default" : "outline"}
                size="icon"
                onClick={() => setPage(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Halaman ${p}`}
                className={cn(p === page && "bg-primary text-primary-foreground")}
              >
                {p}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        )}

        {!loading && items !== null && items.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Menampilkan {items.length} dari {total} berita · Halaman {page} dari{" "}
            {totalPages}
          </p>
        )}
      </SectionShell>
    </>
  );
}

function CategoryPill({
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
