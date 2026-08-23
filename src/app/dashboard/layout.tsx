"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  Menu,
  ExternalLink,
  LogOut,
  Lock,
  ChevronLeft,
  UserCircle2,
  ShieldAlert,
  Search,
} from "lucide-react";

import { toast } from "sonner";
import { useAppStore } from "@/store/app";
import { DASHBOARD_NAV, type NavItem } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isGuruDeniedPath } from "@/lib/access";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import {
  DashboardSearch,
  useDashboardSearchHotkey,
} from "@/components/dashboard/dashboard-search";

const ADMIN_PATHS = new Set<string>([
  "/dashboard/users",
  "/dashboard/settings",
  "/dashboard/logs",
  "/dashboard/org-structure",
]);

/** Topbar title from the active App Router pathname (replaces currentTitle). */
function currentTitle(pathname: string): string {
  const match = DASHBOARD_NAV.find(
    (n) =>
      n.path === pathname || (n.path !== "/dashboard" && pathname.startsWith(n.path))
  );
  return match?.label ?? "Dashboard";
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);

  const isAdmin = user?.role === "SUPER_ADMIN";
  // GURU hanya melihat Ringkasan + Kehadiran (kelas wali-nya).
  const isGuru = user?.role === "GURU";

  // Unread message count badge for "Pesan Masuk" nav item + total akun untuk
  // badge "Manajemen Operator" (konsisten dengan tab users page).
  const [unread, setUnread] = useState(0);
  const [accountTotal, setAccountTotal] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        if (typeof data?.counts?.unreadMessages === "number") {
          setUnread(data.counts.unreadMessages);
        }
        const rc = data?.counts?.userRoleCounts;
        if (rc && typeof rc.all === "number") {
          setAccountTotal(rc.all);
        }
      } catch {
        // ignore — badge is non-critical
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pathname]);

  const groups = useMemo(() => {
    const items = DASHBOARD_NAV.filter(
      (n) =>
        (!n.adminOnly || isAdmin) &&
        (!isGuru ||
          n.path === "/dashboard" ||
          n.path === "/dashboard/attendance" ||
          n.path === "/dashboard/profile")
    );
    const management: NavItem[] = [];
    const admin: NavItem[] = [];
    const ringkasan: NavItem[] = [];
    items.forEach((n) => {
      if (n.path === "/dashboard") ringkasan.push(n);
      else if (n.adminOnly) admin.push(n);
      else management.push(n);
    });
    return { ringkasan, management, admin };
  }, [isAdmin, isGuru]);

  function go(path: string) {
    router.push(path);
    onNavigate?.();
  }

  function renderItem(n: NavItem) {
    const active =
      pathname === n.path || (n.path !== "/dashboard" && pathname.startsWith(n.path));
    const Icon = n.icon;
    const showBadge = n.path === "/dashboard/messages" && unread > 0;
    // Badge total akun pada item "Manajemen Operator" — nilainya sama dengan
    // jumlah di tab "Semua" halaman users (dari userRoleCounts /api/stats).
    const showAccountBadge =
      n.path === "/dashboard/users" && accountTotal !== null;
    return (
      <button
        key={n.path}
        type="button"
        onClick={() => go(n.path)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r bg-gold w-1"
          />
        )}
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{n.label}</span>
        {showBadge && (
          <span
            aria-label={`${unread} pesan belum dibaca`}
            className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-gold-foreground"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        {showAccountBadge && (
          <span
            aria-label={`${accountTotal} akun`}
            className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[11px] font-bold text-sidebar-accent-foreground"
          >
            {accountTotal! > 99 ? "99+" : accountTotal}
          </span>
        )}
      </button>
    );
  }

  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Navigasi Dashboard">
      <div className="space-y-1">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Ringkasan
        </p>
        {groups.ringkasan.map(renderItem)}
      </div>
      <div className="space-y-1">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Manajemen Konten
        </p>
        {groups.management.map(renderItem)}
      </div>
      {groups.admin.length > 0 && (
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            Administrasi
          </p>
          {groups.admin.map(renderItem)}
        </div>
      )}
    </nav>
  );
}

function AccessDenied({ description }: { description?: string }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Lock className="size-7" />
          </div>
          <CardTitle className="text-xl">Akses Ditolak</CardTitle>
          <CardDescription>
            {description ??
              "Halaman ini hanya tersedia untuk Super Admin. Akun Anda saat ini berperan sebagai Operator."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/dashboard")}>
            <ChevronLeft className="size-4" /> Kembali ke Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const logout = useAppStore((s) => s.logout);
  const settings = useAppStore((s) => s.settings);
  const fetchMe = useAppStore((s) => s.fetchMe);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const search = useDashboardSearchHotkey();

  const brandShort = settings?.schoolName
    ? settings.schoolName.replace(/UPT SPF /, "").replace(/Negeri Unggulan /, "")
    : "SDN Mongisidi 1";

  const [mobileOpen, setMobileOpen] = useState(false);

  // Load session + site settings once, in the layout (not 17× per page).
  useEffect(() => {
    fetchMe();
    fetchSettings();
  }, [fetchMe, fetchSettings]);

  // Legacy hash redirect (refactor 1A): /dashboard#/dashboard/news →
  // /dashboard/news so old bookmarks/links keep working during transition.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    // Only migrate legacy dashboard hash sub-routes (`#/dashboard/...`),
    // never a bare `#/dashboardx` which would 404 after the strip.
    if (hash === "#/dashboard" || hash.startsWith("#/dashboard/")) {
      router.replace(hash.slice(1));
    }
  }, [router]);

  // Unauth guard — one guard protects all dashboard routes.
  useEffect(() => {
    if (!user && !authLoading) router.replace("/login");
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Memuat dashboard…</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "SUPER_ADMIN";
  const isGuru = user.role === "GURU";
  const isAdminRoute = ADMIN_PATHS.has(pathname);
  const showAccessDenied =
    (isAdminRoute && !isAdmin) || (isGuru && isGuruDeniedPath(pathname));

  async function handleLogout() {
    await logout();
    toast.success("Anda telah keluar dari sistem.");
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gold/25 bg-sidebar px-4 text-sidebar-foreground shadow-md sm:px-6 print:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Buka menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[260px] border-0 bg-sidebar p-0 text-sidebar-foreground"
          >
            <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
                <span className="flex size-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
                  <GraduationCap className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold leading-tight">{brandShort}</span>
                  <span className="text-[11px] text-sidebar-foreground/70">
                    Panel CMS
                  </span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(100vh-88px)] overflow-y-auto custom-scroll">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex flex-col">
          <h1 className="text-base font-semibold leading-tight text-sidebar-foreground sm:text-lg">
            {currentTitle(pathname)}
          </h1>
          <p className="hidden text-xs text-sidebar-foreground/70 sm:block">
            Panel Manajemen Konten Sekolah
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => search.setOpen(true)}
            className="hidden border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground md:inline-flex"
            aria-label="Cari menu (Ctrl+K)"
          >
            <Search className="size-4" />
            <span className="hidden lg:inline">Cari…</span>
            <kbd className="ml-1 hidden rounded border border-sidebar-border bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/70 lg:inline">
              Ctrl K
            </kbd>
          </Button>
          <Badge
            className={
              isAdmin
                ? "bg-gold text-gold-foreground"
                : isGuru
                  ? "bg-violet-600 text-white"
                  : "border-sidebar-border bg-sidebar-accent text-sidebar-foreground"
            }
          >
            Login sebagai: {isAdmin ? "Admin" : isGuru ? "Guru" : "Operator"}
          </Badge>

          <ThemeToggle className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground sm:inline-flex" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open("/", "_blank")}
                className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground sm:inline-flex"
              >
                <ExternalLink className="size-4" /> Lihat Situs
              </Button>
            </TooltipTrigger>
            <TooltipContent>Buka halaman publik di tab baru</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menu pengguna"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <UserCircle2 className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="font-semibold">{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="sm:hidden"
                onClick={() => window.open("/", "_blank")}
              >
                <ExternalLink className="size-4" /> Lihat Situs
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[260px] shrink-0 overflow-y-auto bg-sidebar text-sidebar-foreground lg:block print:hidden">
          <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold leading-tight">{brandShort}</span>
              <span className="text-[11px] text-sidebar-foreground/70">Panel CMS</span>
            </span>
          </div>
          <SidebarNav />
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {showAccessDenied ? (
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                <ShieldAlert className="size-4" />
                Anda tidak memiliki izin untuk mengakses modul ini.
              </div>
              <AccessDenied
                description={
                  isGuru
                    ? "Akun Guru hanya dapat mengakses Ringkasan, Kehadiran (kelas wali Anda), dan Profil Saya."
                    : undefined
                }
              />
            </div>
          ) : (
            <ErrorBoundary onReset={() => window.location.reload()}>
              {children}
            </ErrorBoundary>
          )}
        </main>
      </div>

      <footer className="mt-auto border-t border-gold/25 bg-sidebar px-4 py-3 text-center text-xs text-sidebar-foreground/70 sm:px-6 print:hidden">
        © {new Date().getFullYear()}{" "}
        {settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1"} — CMS v1.0
      </footer>

      <DashboardSearch open={search.open} onOpenChange={search.setOpen} />
    </div>
  );
}

export default DashboardLayout;
