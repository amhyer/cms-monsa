"use client";

import { useEffect, useState } from "react";
import { Mail, Network, Phone, UserCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PageBanner, SectionShell } from "./_shared";
import { ErrorState } from "@/components/shared/error-state";
import type { OrgStructureItem } from "@/lib/types";

export function StrukturOrganisasiView() {
  const [items, setItems] = useState<OrgStructureItem[] | null>(null);
  const [error, setError] = useState(false);
  // Anggota yang sedang dibuka di modal detail (bio/kontak — tanpa NUPTK/NIP/NIK).
  const [selected, setSelected] = useState<OrgStructureItem | null>(null);

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
                role="button"
                tabIndex={0}
                aria-label={`Lihat profil ${m.name}`}
                onClick={() => setSelected(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(m);
                  }
                }}
                className="flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
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
                  {(m.bio || m.contact) && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Lihat profil & kontak
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionShell>

      {/* Modal detail profil anggota — hanya bio/kontak, TANPA NUPTK/NIP/NIK
          (kunci identitas sudah di-strip oleh GET publik /api/org-structure). */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
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
              {selected?.bio && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {selected.bio}
                </p>
              )}
              {selected?.contact && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {selected.contact.includes("@") ? (
                    <p className="flex items-center gap-2">
                      <Mail className="size-4 text-gold" />
                      <a
                        href={`mailto:${selected.contact}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {selected.contact}
                      </a>
                    </p>
                  ) : (
                    <p className="flex items-center gap-2">
                      <Phone className="size-4 text-gold" />
                      {selected.contact}
                    </p>
                  )}
                </div>
              )}
              {!selected?.bio && !selected?.contact && (
                <p className="text-sm text-muted-foreground">
                  Profil singkat anggota belum tersedia.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}