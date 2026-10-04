"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Image } from "@/components/shared/smart-image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, truncate } from "@/lib/format";
import type { NewsItem } from "@/lib/types";

/* ----------------------------- Hero carousel ----------------------------- */
export function HeroCarousel({ items }: { items: NewsItem[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Berita terkini"
      className="relative w-full overflow-hidden bg-sidebar"
    >
      <div className="relative h-[60vh] min-h-[420px] w-full sm:h-[70vh]">
        <AnimatePresence mode="wait">
          {items.map((n, i) =>
            i === index ? (
              <motion.div
                key={n.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {n.coverImage ? (
                  <Image
                    src={n.coverImage}
                    alt={n.title}
                    fill
                    className="object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                    sizes="100vw"
                    priority={i === 0}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                    <Newspaper className="size-16" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-sidebar/95 via-sidebar/80 to-sidebar/40" />
              </motion.div>
            ) : null
          )}
        </AnimatePresence>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl items-end px-4 pb-10 sm:px-6 sm:pb-16">
          <div className="max-w-2xl text-sidebar-foreground">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
              <span className="h-px w-6 bg-gold" />
              Berita Terkini
            </span>
            <AnimatePresence mode="wait">
              <motion.h2
                key={items[index].id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="mt-3 font-sans text-2xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl"
              >
                {items[index].title}
              </motion.h2>
            </AnimatePresence>
            <p className="mt-4 hidden max-w-xl text-sm text-sidebar-foreground/85 sm:block sm:text-base">
              {truncate(items[index].excerpt, 160)}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="bg-gold text-gold-foreground hover:bg-gold/90"
                onClick={() => router.push(`/news/${items[index].slug}`)}
              >
                Baca Selengkapnya
                <ArrowRight className="size-4" />
              </Button>
              <span className="text-xs text-sidebar-foreground/70">
                {formatDate(items[index].publishedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Dots */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 sm:bottom-8 sm:right-8">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={
                i === index
                  ? "size-2.5 rounded-full bg-gold transition-all"
                  : "size-2.5 rounded-full bg-sidebar-foreground/40 transition-all hover:bg-sidebar-foreground/70"
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
