"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Tailwind class for an activity-log action badge. */
export function actionBadgeClass(action: string): string {
  switch (action) {
    case "CREATE":
      return "bg-emerald-600 text-white";
    case "UPDATE":
      return "bg-primary text-primary-foreground";
    case "DELETE":
      return "bg-destructive text-white";
    case "LOGIN":
    case "LOGOUT":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case "CREATE":
      return "Buat";
    case "UPDATE":
      return "Ubah";
    case "DELETE":
      return "Hapus";
    case "LOGIN":
      return "Masuk";
    case "LOGOUT":
      return "Keluar";
    default:
      return action;
  }
}

export function PageLoader({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: string;
  icon?: typeof Inbox;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * Ukuran halaman per modul yang bertahan di localStorage lintas sesi
 * (kunci `monsa:pageSize:<key>`). Aman SSR: nilai tersimpan dibaca setelah
 * mount, jadi render server selalu memakai default (tanpa mismatch hidrasi).
 * `validSizes` (opsional) membatasi nilai yang diterima dari penyimpanan agar
 * tidak pernah menghasilkan ukuran di luar pilihan yang tersedia.
 */
export function usePersistedPageSize(
  key: string,
  defaultValue: number,
  validSizes?: number[]
): [number, (size: number) => void] {
  const storageKey = `monsa:pageSize:${key}`;
  const [pageSize, setPageSizeState] = useState<number>(defaultValue);

  // Baca nilai tersimpan setelah mount (SSR-safe). Bila tidak valid / tidak
  // tersedia, biarkan default.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const n = Number(raw);
        if (Number.isInteger(n) && n > 0 && (!validSizes || validSizes.includes(n))) {
          setPageSizeState(n);
        }
      }
    } catch {
      // localStorage tidak tersedia (mode privat) — pakai default.
    }
    // validSizes statis per pemanggil; join dipakai agar deps stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, validSizes?.join(",")]);

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(size);
      try {
        window.localStorage.setItem(storageKey, String(size));
      } catch {
        // abaikan — nilai hanya berlaku sesi ini.
      }
    },
    [storageKey]
  );

  return [pageSize, setPageSize];
}

/**
 * Kontrol pagination sederhana: "Halaman X dari Y" + tombol Sebelumnya/Berikutnya.
 * Otomatis null (tidak dirender) saat hanya ada satu halaman.
 *
 * Pemilih ukuran halaman (opsional, hanya dirender bila onPageSizeChange
 * diberikan) — dipakai tabel yang ingin memberi admin kendali 10/25/50.
 */
export function Pagination({
  page,
  totalPages,
  onPage,
  pageSize,
  pageSizes = [10, 25, 50],
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  pageSize?: number;
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">
          Halaman {page} dari {totalPages}
        </p>
        {onPageSizeChange && (
          <Select
            value={String(pageSize ?? pageSizes[0])}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger
              className="h-8 w-24 text-xs"
              aria-label="Baris per halaman"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / hal.
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

/** Map a JS Date or ISO string to a yyyy-mm-dd value for <input type="date">. */
export function toDateInputValue(
  date: string | null | undefined
): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert a yyyy-mm-dd value into an ISO string (preserving local day). */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
