"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * Empty/error state shown when a data fetch fails on public pages.
 * Provides a clear message and an optional retry button.
 */
export function ErrorState({
  title = "Gagal memuat data",
  description = "Terjadi kesalahan saat memuat informasi. Periksa koneksi internet Anda lalu coba lagi.",
  onRetry,
  className,
}: Props) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center " +
        (className ?? "")
      }
      role="alert"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-1"
        >
          <RefreshCw className="size-4" /> Coba lagi
        </Button>
      )}
    </div>
  );
}
