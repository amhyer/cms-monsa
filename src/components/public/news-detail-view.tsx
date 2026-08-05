"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  User,
  Share2,
  AlertCircle,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionShell, CategoryBadge } from "./_shared";
import { formatDate, readingTime, truncate } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import { copyToClipboard } from "@/lib/clipboard";
import { injectNewsArticleJsonLd } from "@/components/shared/seo-manager";
import type { NewsItem } from "@/lib/types";
import { toast } from "sonner";

interface NewsDetailViewProps {
  slug?: string;
}

export function NewsDetailView({ slug: propSlug }: NewsDetailViewProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);

  const slug = propSlug || (pathname.split("/")[2] ?? "");

  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [related, setRelated] = useState<NewsItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setItem(null);
    (async () => {
      try {
        const res = await fetch(`/api/news/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setItem(data);
        // Inject NewsArticle JSON-LD for SEO (rich results in Google).
        injectNewsArticleJsonLd(data);
        // Update page title & OG tags with the actual article title.
        document.title = `${data.title} — SD Negeri Unggulan Mongisidi 1`;
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute("content", data.title);
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.setAttribute("content", data.title);
        if (data.coverImage) {
          const ogImg = document.querySelector('meta[property="og:image"]');
          if (ogImg) ogImg.setAttribute("content", data.coverImage);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Fetch related
  useEffect(() => {
    if (!item?.category) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/news?scope=public&category=${encodeURIComponent(
            item.category
          )}&limit=4`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancelled) return;
        const list: NewsItem[] = Array.isArray(data?.items) ? data.items : [];
        setRelated(list.filter((n) => n.id !== item.id).slice(0, 3));
      } catch {
        if (!cancelled) setRelated([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.category]);

  const onShare = async () => {
    if (typeof window === "undefined" || !item) return;
    const url = `${window.location.origin}/news/${item.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url });
      } else {
        const copied = await copyToClipboard(url);
        if (copied) {
          toast.success("Tautan berita disalin ke clipboard.");
        } else {
          toast.info("Salin tautan dari kotak dialog.");
        }
      }
    } catch {
      // User cancelled share, or share failed — try clipboard as fallback.
      try {
        const copied = await copyToClipboard(url);
        if (copied) {
          toast.success("Tautan berita disalin ke clipboard.");
        }
      } catch {
        toast.error("Gagal membagikan berita.");
      }
    }
  };

  if (loading) {
    return (
      <SectionShell>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />
            <div className="mt-6 flex flex-col gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-9 w-1/2" />
              <Skeleton className="h-4 w-48" />
              <div className="mt-4 flex flex-col gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </SectionShell>
    );
  }

  if (notFound || !item) {
    return (
      <SectionShell>
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-10 text-center">
          <AlertCircle className="size-12 text-muted-foreground" />
          <h2 className="font-sans text-xl font-bold text-foreground">
            Berita tidak ditemukan
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Berita yang Anda cari mungkin telah dihapus atau tautan tidak valid.
          </p>
          <Button type="button" onClick={() => router.push("/news")}>
            <ArrowLeft className="size-4" />
            Kembali ke Berita
          </Button>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Article */}
        <article className="lg:col-span-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/news")}
            className="mb-5"
          >
            <ArrowLeft className="size-4" />
            Kembali ke Berita
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <CategoryBadge category={item.category} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {formatDate(item.publishedAt)}
            </span>
          </div>

          <h1 className="mt-4 font-sans text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {item.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-y py-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              <span>Oleh</span>
              <span className="font-medium text-foreground">
                {item.authorName ?? "Redaksi Sekolah"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {readingTime(item.content)}
            </span>
            <button
              type="button"
              onClick={onShare}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Bagikan berita"
            >
              <Share2 className="size-3.5" />
              Bagikan
            </button>
          </div>

          {item.coverImage && (
            <img
              src={item.coverImage}
              alt={item.title}
              className="mt-6 aspect-[16/9] w-full rounded-xl border object-cover"
            />
          )}

          <p className="mt-6 text-base font-medium leading-relaxed text-foreground">
            {item.excerpt}
          </p>

          <div
            className="news-content mt-4 text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content) }}
          />
        </article>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 flex flex-col gap-4">
            <h3 className="font-sans text-lg font-bold text-foreground">
              Berita Terkait
            </h3>
            {related.length === 0 ? (
              <div className="rounded-xl border bg-card p-5 text-center text-sm text-muted-foreground">
                Tidak ada berita terkait.
              </div>
            ) : (
              related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push(`/news/${r.slug}`)}
                  className="group flex gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <img
                      src={r.coverImage ?? ""}
                      alt={r.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <CategoryBadge category={r.category} />
                    <h4 className="line-clamp-3 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                      {truncate(r.title, 80)}
                    </h4>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(r.publishedAt)}
                    </span>
                  </div>
                </button>
              ))
            )}

            <div className="mt-4 rounded-xl border-2 border-gold bg-gold/5 p-5">
              <h4 className="font-sans text-base font-bold text-foreground">
                SPMB 2025/2026
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Pendaftaran peserta didik baru telah dibuka. Daftar sekarang
                sebelum kuota penuh.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3 w-full bg-gold text-gold-foreground hover:bg-gold/90"
                onClick={() => {
                  if (settings?.spmbLink) {
                    window.open(settings.spmbLink, "_blank", "noopener,noreferrer");
                  } else {
                    router.push("/contact");
                  }
                }}
              >
                Daftar SPMB
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </SectionShell>
  );
}
