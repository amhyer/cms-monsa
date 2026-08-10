"use client";

import { useRouter } from "next/navigation";
import {
  Facebook,
  Instagram,
  Youtube,
  Music2,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { PUBLIC_NAV } from "@/lib/nav";

export function SiteFooter() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);

  const year = new Date().getFullYear();
  const schoolName = settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1";
  const address = settings?.address ?? "-";
  const phone = settings?.phone ?? "-";
  const email = settings?.email ?? "-";

  const socials = [
    { icon: Facebook, label: "Facebook", url: settings?.facebook },
    { icon: Instagram, label: "Instagram", url: settings?.instagram },
    { icon: Youtube, label: "YouTube", url: settings?.youtube },
    { icon: Music2, label: "TikTok", url: settings?.tiktok },
  ].filter((s) => s.url);

  return (
    <footer
      className="mt-auto w-full border-t border-gold/25 bg-sidebar text-sidebar-foreground"
      aria-label="Footer situs"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Identity */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-sidebar-accent ring-1 ring-gold/40">
                {settings?.logo ? (
                  <img src={settings.logo} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <GraduationCap className="size-6 text-gold" />
                )}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-bold">{schoolName}</span>
                {settings?.npsn && (
                  <span className="text-xs text-sidebar-foreground/70">
                    NPSN {settings.npsn}
                  </span>
                )}
              </div>
            </div>
            <ul className="flex flex-col gap-3 text-sm text-sidebar-foreground/80">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                <span>{address}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-gold" />
                <span>{phone}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-gold" />
                <a
                  href={`mailto:${email}`}
                  className="transition-colors hover:text-gold"
                >
                  {email}
                </a>
              </li>
            </ul>
          </div>

          {/* Quick links */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold">
              Tautan Cepat
            </h3>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {PUBLIC_NAV.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => router.push(item.path)}
                    className="text-left text-sidebar-foreground/80 transition-colors hover:text-gold"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold">
              Sosial Media
            </h3>
            <p className="text-sm text-sidebar-foreground/80">
              Ikuti kami di media sosial untuk informasi terbaru seputar
              kegiatan dan prestasi sekolah.
            </p>
            <div className="flex flex-wrap gap-2">
              {socials.length === 0 && (
                <span className="text-sm text-sidebar-foreground/60">
                  Belum ada tautan sosial media.
                </span>
              )}
              {socials.map(({ icon: Icon, label, url }) => (
                <a
                  key={label}
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-10 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground ring-1 ring-sidebar-border transition-colors hover:bg-gold hover:text-gold-foreground"
                >
                  <Icon className="size-5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-gold/25 pt-6 sm:flex-row sm:justify-between">
          <p className="text-center text-xs text-sidebar-foreground/70 sm:text-sm">
            &copy; {year} SD Negeri Unggulan Mongisidi 1. Hak cipta dilindungi.
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin-login")}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-gold"
            title="Portal login khusus Super Admin"
          >
            <ShieldCheck className="size-3.5" />
            Portal Admin
          </button>
        </div>
      </div>
    </footer>
  );
}
