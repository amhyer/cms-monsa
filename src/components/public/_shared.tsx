"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<string, string> = {
  Prestasi: "bg-gold text-gold-foreground",
  Akademik: "bg-primary text-primary-foreground",
  Kegiatan: "bg-emerald-600 text-white",
  Libur: "bg-rose-600 text-white",
  Umum: "bg-muted text-foreground",
  Fasilitas: "bg-sky-700 text-white",
  Upacara: "bg-amber-600 text-white",
  "Non-Akademik": "bg-purple-700 text-white",
};

export function CategoryBadge({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const style =
    CATEGORY_STYLES[category] ?? "bg-muted text-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs",
        style,
        className
      )}
    >
      {category}
    </span>
  );
}

export function SectionShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-12 sm:py-16", className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

export function PageBanner({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex flex-col items-start gap-3">
          {eyebrow && (
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
              <span className="h-px w-6 bg-gold" />
              {eyebrow}
            </span>
          )}
          <h1 className="font-sans text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-sidebar-foreground/80 sm:text-base">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
