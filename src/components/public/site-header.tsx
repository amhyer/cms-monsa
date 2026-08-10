"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, Menu, LogIn, PencilLine, ExternalLink } from "lucide-react";
import { useAppStore } from "@/store/app";
import { PUBLIC_NAV } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Shrink the header (and collapse the NPSN line) once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const schoolName = settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1";
  const spmbLink = settings?.spmbLink;

  /** Open SPMB portal in a new tab if configured, else go to contact page. */
  const openSpmb = () => {
    if (spmbLink) {
      window.open(spmbLink, "_blank", "noopener,noreferrer");
    } else {
      router.push("/contact");
    }
    setOpen(false);
  };
  const npsn = settings?.npsn ?? "";

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/" || pathname === "";
    if (path === "/news") {
      // news list active only when not in detail
      return pathname === "/news";
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  const go = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-gold/25 bg-sidebar text-sidebar-foreground transition-all duration-300",
        scrolled ? "shadow-lg" : "shadow-md"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 transition-all duration-300 sm:px-6",
          scrolled ? "h-14" : "h-16"
        )}
      >
        {/* Brand — kiri */}
        <button
          type="button"
          onClick={() => go("/")}
          className="group flex min-w-0 items-center gap-2 text-left"
          aria-label={`${schoolName} — Beranda`}
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-gold/40 transition-all group-hover:scale-105 group-hover:ring-gold/80",
              scrolled ? "size-8" : "size-10"
            )}
          >
            {settings?.logo ? (
              <img
                src={settings.logo}
                alt={`Logo ${schoolName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <GraduationCap className="size-5 text-gold" />
            )}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-[40vw] truncate text-sm font-bold tracking-tight text-sidebar-foreground 2xl:text-base">
              {schoolName}
            </span>
            <span
              className={cn(
                "overflow-hidden text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/70 transition-all duration-300 sm:text-xs",
                scrolled ? "max-h-0 opacity-0" : "max-h-6 opacity-100"
              )}
            >
              NPSN {npsn || "—"}
            </span>
          </span>
        </button>

        {/* Desktop nav — tengah */}
        <nav
          aria-label="Navigasi utama"
          className="hidden items-center xl:flex"
        >
          {PUBLIC_NAV.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative rounded-md px-2 text-sm font-medium transition-all",
                  scrolled ? "py-1.5" : "py-2",
                  active
                    ? "bg-sidebar-accent text-gold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-gold"
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold transition-opacity",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                />
              </button>
            );
          })}
        </nav>

        {/* Actions — kanan */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          <ThemeToggle className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground sm:inline-flex" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground sm:inline-flex"
            onClick={() => go("/login")}
          >
            <LogIn className="size-4" />
            Login
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={openSpmb}
            title={spmbLink ? `Buka portal SPMB: ${spmbLink}` : "Info SPMB"}
          >
            <PencilLine className="size-4" />
            <span className="hidden sm:inline">SPMB</span>
            {spmbLink && <ExternalLink className="size-3 opacity-70" />}
          </Button>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="xl:hidden border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                aria-label="Buka menu navigasi"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-3/4 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
                    {settings?.logo ? (
                      <img src={settings.logo} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <GraduationCap className="size-5 text-gold" />
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-bold">{schoolName}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      NPSN {npsn || "—"}
                    </span>
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav
                aria-label="Navigasi mobile"
                className="flex flex-col gap-1 px-4"
              >
                {PUBLIC_NAV.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <SheetClose asChild key={item.path}>
                      <button
                        type="button"
                        onClick={() => go(item.path)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-gold/15 text-gold-foreground"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            active ? "text-gold" : "text-muted-foreground"
                          )}
                        />
                        {item.label}
                      </button>
                    </SheetClose>
                  );
                })}
              </nav>
              <div className="mt-auto flex flex-col gap-2 p-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => go("/login")}
                >
                  <LogIn className="size-4" />
                  Login
                </Button>
                <Button
                  type="button"
                  className="bg-gold text-gold-foreground hover:bg-gold/90"
                  onClick={openSpmb}
                >
                  <PencilLine className="size-4" />
                  Daftar SPMB
                  {spmbLink && <ExternalLink className="size-3 opacity-70" />}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
