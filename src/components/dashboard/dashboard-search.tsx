"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store/app";
import { DASHBOARD_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * Quick global navigation palette for the dashboard. Opens with Ctrl/Cmd+K.
 * Built with a plain Dialog + input filter (no cmdk dependency).
 */
export function DashboardSearch({ open, onOpenChange }: Props) {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const isAdmin = user?.role === "SUPER_ADMIN";
  const [query, setQuery] = React.useState("");

  function go(path: string) {
    router.push(path);
    onOpenChange(false);
    setQuery("");
  }

  const allItems = [
    { label: "Ringkasan Dashboard", path: "/dashboard", icon: LayoutDashboard, group: "Navigasi" },
    { label: "Lihat Situs Publik", path: "/", icon: Eye, group: "Navigasi" },
    ...DASHBOARD_NAV.filter((n) => !n.adminOnly).map((n) => ({
      label: n.label,
      path: n.path,
      icon: n.icon,
      group: "Manajemen Konten",
    })),
    ...(isAdmin
      ? DASHBOARD_NAV.filter((n) => n.adminOnly).map((n) => ({
          label: n.label,
          path: n.path,
          icon: n.icon,
          group: "Administrasi (Admin)",
        }))
      : []),
  ];

  const filtered = query.trim()
    ? allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const groups = filtered.reduce<Record<string, typeof allItems>>(
    (acc, item) => {
      (acc[item.group] = acc[item.group] || []).push(item);
      return acc;
    },
    {}
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Cari menu</DialogTitle>
        </DialogHeader>
        <div className="flex items-center border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari menu atau lompat ke halaman…"
            className="h-11 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) {
                go(filtered[0].path);
              }
            }}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto custom-scroll p-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada hasil.
            </p>
          ) : (
            Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName} className="mb-2">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupName}
                </p>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => go(item.path)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
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
