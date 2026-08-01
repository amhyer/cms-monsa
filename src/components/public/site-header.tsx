"use client";

import { useState } from "react";
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
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const settings = useAppStore((s) => s.settings);
  const [open, setOpen] = useState(false);

  const schoolName = settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1";
  const spmbLink = settings?.spmbLink;

  /** Open SPMB portal in a new tab if configured, else go to contact page. */
  const openSpmb = () => {
    if (spmbLink) {
      window.open(spmbLink, "_blank", "noopener,noreferrer");
    } else {
      navigate("/contact");
    }
    setOpen(false);
  };
  const npsn = settings?.npsn ?? "";

  const isActive = (path: string) => {
    if (path === "/") return route === "/" || route === "";
    if (path === "/news") {
      // news list active only when not in detail
      return route === "/news";
    }
    return route === path || route.startsWith(path + "/");
  };

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={() => go("/")}
          className="group flex items-center gap-3 text-left"
          aria-label={`${schoolName} — Beranda`}
        >
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-gold/40 transition-transform group-hover:scale-105">
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
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-foreground sm:text-base">
              {schoolName}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
              NPSN {npsn || "—"}
            </span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav
          aria-label="Navigasi utama"
          className="hidden items-center gap-1 lg:flex"
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
                  "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold transition-opacity",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
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
            SPMB
            {spmbLink && <ExternalLink className="size-3 opacity-70" />}
          </Button>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Buka menu navigasi"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-3/4 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
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
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            active ? "text-gold-foreground" : "text-muted-foreground"
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
