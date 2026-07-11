"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Menu,
  Repeat,
  ExternalLink,
  LogOut,
  Lock,
  ChevronLeft,
  UserCircle2,
  ShieldAlert,
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
import { Overview } from "./modules/overview";
import { NewsManager } from "./modules/news-manager";
import { AnnouncementsManager } from "./modules/announcements-manager";
import { AgendaManager } from "./modules/agenda-manager";
import { GalleryManager } from "./modules/gallery-manager";
import { AchievementsManager } from "./modules/achievements-manager";
import { TeachersManager } from "./modules/teachers-manager";
import { MessagesManager } from "./modules/messages-manager";
import { UsersManager } from "./modules/users-manager";
import { SettingsManager } from "./modules/settings-manager";
import { LogsView } from "./modules/logs-view";

const ADMIN_PATHS = new Set<string>([
  "/dashboard/users",
  "/dashboard/settings",
  "/dashboard/logs",
]);

function renderModule(route: string) {
  switch (route) {
    case "/dashboard":
      return <Overview />;
    case "/dashboard/news":
      return <NewsManager />;
    case "/dashboard/announcements":
      return <AnnouncementsManager />;
    case "/dashboard/agenda":
      return <AgendaManager />;
    case "/dashboard/gallery":
      return <GalleryManager />;
    case "/dashboard/achievements":
      return <AchievementsManager />;
    case "/dashboard/teachers":
      return <TeachersManager />;
    case "/dashboard/messages":
      return <MessagesManager />;
    case "/dashboard/users":
      return <UsersManager />;
    case "/dashboard/settings":
      return <SettingsManager />;
    case "/dashboard/logs":
      return <LogsView />;
    default:
      return <Overview />;
  }
}

function currentTitle(route: string): string {
  const match = DASHBOARD_NAV.find(
    (n) => n.path === route || (n.path !== "/dashboard" && route.startsWith(n.path))
  );
  return match?.label ?? "Dashboard";
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);

  const isAdmin = user?.role === "SUPER_ADMIN";

  const groups = useMemo(() => {
    const items = DASHBOARD_NAV.filter(
      (n) => !n.adminOnly || isAdmin
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
  }, [isAdmin]);

  function go(path: string) {
    navigate(path);
    onNavigate?.();
  }

  function renderItem(n: NavItem) {
    const active = route === n.path || (n.path !== "/dashboard" && route.startsWith(n.path));
    const Icon = n.icon;
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

function AccessDenied() {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Lock className="size-7" />
          </div>
          <CardTitle className="text-xl">Akses Ditolak</CardTitle>
          <CardDescription>
            Halaman ini hanya tersedia untuk Super Admin. Akun Anda saat ini
            berperan sebagai Operator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/dashboard")}>
            <ChevronLeft className="size-4" /> Kembali ke Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardShell() {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const logout = useAppStore((s) => s.logout);
  const switchRole = useAppStore((s) => s.switchRole);

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user && !authLoading) navigate("/login");
  }, [user, authLoading, navigate]);

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
  const isAdminRoute = ADMIN_PATHS.has(route);
  const showAccessDenied = isAdminRoute && !isAdmin;

  async function handleSwitchRole() {
    const next = isAdmin ? "OPERATOR" : "SUPER_ADMIN";
    await switchRole(next);
    toast.success(`Berhasil beralih ke peran ${next === "SUPER_ADMIN" ? "Admin" : "Operator"}.`);
  }

  async function handleLogout() {
    await logout();
    toast.success("Anda telah keluar dari sistem.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background px-4 sm:px-6">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] border-0 bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
                <span className="flex size-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
                  <GraduationCap className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold leading-tight">SMA Negeri 1</span>
                  <span className="text-[11px] text-sidebar-foreground/70">Panel CMS</span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(100vh-88px)] overflow-y-auto custom-scroll">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex flex-col">
          <h1 className="text-base font-semibold leading-tight sm:text-lg">
            {currentTitle(route)}
          </h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Panel Manajemen Konten Sekolah
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            className={
              isAdmin
                ? "bg-gold text-gold-foreground"
                : "bg-primary text-primary-foreground"
            }
          >
            Login sebagai: {isAdmin ? "Admin" : "Operator"}
          </Badge>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwitchRole}
                className="hidden sm:inline-flex"
              >
                <Repeat className="size-4" />
                Switch Role (Mock)
              </Button>
            </TooltipTrigger>
            <TooltipContent>Beralih peran untuk uji coba hak akses</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="hidden sm:inline-flex"
              >
                <ExternalLink className="size-4" /> Lihat Situs
              </Button>
            </TooltipTrigger>
            <TooltipContent>Buka halaman publik</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu pengguna">
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
                onClick={handleSwitchRole}
              >
                <Repeat className="size-4" /> Beralih Peran
              </DropdownMenuItem>
              <DropdownMenuItem
                className="sm:hidden"
                onClick={() => navigate("/")}
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
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[260px] shrink-0 overflow-y-auto bg-sidebar text-sidebar-foreground lg:block">
          <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold leading-tight">
                SMA Negeri 1
              </span>
              <span className="text-[11px] text-sidebar-foreground/70">
                Panel CMS
              </span>
            </span>
          </div>
          <SidebarNav />
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 sm:p-6">
          {showAccessDenied ? (
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                <ShieldAlert className="size-4" />
                Anda tidak memiliki izin untuk mengakses modul ini.
              </div>
              <AccessDenied />
            </div>
          ) : (
            renderModule(route)
          )}
        </main>
      </div>

      <footer className="mt-auto border-t bg-background px-4 py-3 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} SMA Negeri 1 Nusantara — CMS v1.0
      </footer>
    </div>
  );
}

export default DashboardShell;
