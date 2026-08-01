"use client";

import { useEffect } from "react";
import { Home, ArrowLeft, Search } from "lucide-react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";

export function NotFoundView() {
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    document.title = "404 — Halaman Tidak Ditemukan";
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <div className="mx-auto max-w-md animate-fade-in-up">
        <p className="font-sans text-7xl font-black tracking-tighter text-primary sm:text-9xl">
          404
        </p>
        <h1 className="mt-4 font-sans text-2xl font-bold tracking-tight sm:text-3xl">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.
          Silakan kembali ke beranda atau periksa kembali tautan Anda.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate("/")} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Home className="size-4" /> Ke Beranda
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="size-4" /> Kembali
          </Button>
        </div>
        <div className="mt-10 rounded-lg border bg-muted/30 p-4 text-left">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Search className="size-3.5" /> Tautan Populer
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Beranda", path: "/" },
              { label: "Profil", path: "/profile" },
              { label: "Berita", path: "/news" },
              { label: "Galeri", path: "/gallery" },
              { label: "Kontak", path: "/contact" },
            ].map((l) => (
              <button
                key={l.path}
                type="button"
                onClick={() => navigate(l.path)}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFoundView;
