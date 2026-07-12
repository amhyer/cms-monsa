"use client";

import * as React from "react";
import {
  Search,
  Home,
  Newspaper,
  Megaphone,
  CalendarDays,
  Image as ImageIcon,
  Trophy,
  Users,
  Mail,
  UserCog,
  Settings,
  ScrollText,
  LayoutDashboard,
  Eye,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppStore } from "@/store/app";
import { DASHBOARD_NAV } from "@/lib/nav";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * Quick global navigation palette for the dashboard. Opens with Ctrl/Cmd+K.
 * Lets the operator/admin jump to any module quickly.
 */
export function DashboardSearch({ open, onOpenChange }: Props) {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === "SUPER_ADMIN";

  function go(path: string) {
    navigate(path);
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Cari menu atau lompat ke halaman…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Tidak ada hasil.</CommandEmpty>
        <CommandGroup heading="Navigasi">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="size-4" />
            <span>Ringkasan Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/")}>
            <Eye className="size-4" />
            <span>Lihat Situs Publik</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Manajemen Konten">
          {DASHBOARD_NAV.filter((n) => !n.adminOnly).map((n) => {
            const Icon = n.icon;
            return (
              <CommandItem key={n.path} onSelect={() => go(n.path)}>
                <Icon className="size-4" />
                <span>{n.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Administrasi (Admin)">
              {DASHBOARD_NAV.filter((n) => n.adminOnly).map((n) => {
                const Icon = n.icon;
                return (
                  <CommandItem key={n.path} onSelect={() => go(n.path)}>
                    <Icon className="size-4" />
                    <span>{n.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Hook that wires up Ctrl/Cmd+K to toggle the palette. */
export function useDashboardSearchHotkey() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return { open, setOpen };
}
