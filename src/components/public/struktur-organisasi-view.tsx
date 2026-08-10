"use client";

import { useEffect, useState } from "react";
import { Network, UserCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBanner, SectionShell } from "./_shared";
import { ErrorState } from "@/components/shared/error-state";
import type { OrgStructureItem } from "@/lib/types";

export function StrukturOrganisasiView() {
  const [items, setItems] = useState<OrgStructureItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    let cancelled = false;
    setError(false);
    (async () => {
      try {
        const res = await fetch("/api/org-structure", { cache: "no-store" });
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
  };

  useEffect(() => load(), []);

  return (
    <>
      <PageBanner
        eyebrow="Organisasi"
        title="Struktur Organisasi"
        description="Susunan organisasi UPT SPF SD Negeri Unggulan Mongisidi 1 dalam menjalankan layanan pendidikan."
      />

      <SectionShell>
        {error ? (
          <ErrorState
            title="Gagal memuat struktur organisasi"
            description="Terjadi kesalahan saat memuat data. Periksa koneksi Anda lalu coba lagi."
            onRetry={load}
          />
        ) : items === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm"
              >
                <Skeleton className="size-16 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-center">
            <Network className="size-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">
              Struktur organisasi belum tersedia
            </p>
            <p className="text-sm text-muted-foreground">
              Susunan organisasi sekolah akan segera ditampilkan di halaman ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {m.photo ? (
                  <img
                    src={m.photo}
                    alt={m.name}
                    loading="lazy"
                    className="size-16 shrink-0 rounded-full border object-cover"
                  />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground ring-2 ring-gold/40">
                    <UserCircle2 className="size-8 text-gold" />
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="truncate font-sans font-bold text-foreground">
                    {m.name}
                  </h3>
                  <p className="truncate text-sm font-medium text-primary">
                    {m.position}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionShell>
    </>
  );
}