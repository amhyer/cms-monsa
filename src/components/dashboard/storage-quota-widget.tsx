"use client";

/**
 * Widget kuota storage mini untuk sidebar dashboard (SUPER_ADMIN) —
 * versi ringkas dari StorageStatusPanel yang terlihat di semua halaman
 * admin. Sumber data sama (/api/storage-usage via useStorageUsage):
 *
 *   - bar pemakaian kuota berwarna sesuai tingkat (>=80% merah),
 *   - kandidat cleanup (file yang akan dihapus cron cleanup-uploads),
 *   - link ke beranda (section Storage Upload) untuk rincian + aksi.
 *
 * Bukan pengganti panel beranda: tidak ada aksi (uji alert) dan tidak ada
 * rincian referensi di sini — cukup memantau, lalu menuju beranda untuk
 * bertindak. Gagal memuat → null (tidak ada kotak error di sidebar).
 */

import { HardDrive } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { useStorageUsage } from "@/hooks/use-storage-usage";
import { useRouter } from "next/navigation";

/** Bar berwarna sesuai tingkat pemakaian. */
function tone(percent: number): string {
  if (percent >= 80) return "[&_[data-slot=progress-indicator]]:bg-destructive";
  if (percent >= 60) return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
}

export function StorageQuotaWidget() {
  const { data, error } = useStorageUsage(120_000);
  const router = useRouter();

  if (error) return null; // sidebar tidak berisik saat fetch gagal

  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard")}
      aria-label="Lihat rincian storage di beranda"
      className="w-full rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 p-2.5 text-left transition hover:bg-sidebar-accent/60"
    >
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-sidebar-foreground/80">
        <span className="flex items-center gap-1.5">
          <HardDrive className="size-3.5" /> Storage
        </span>
        {data && data.usagePercent !== null ? (
          <span
            className={cn(
              data.usagePercent >= 80 && "text-destructive",
              data.usagePercent >= 60 &&
                data.usagePercent < 80 &&
                "text-amber-600 dark:text-amber-400"
            )}
          >
            {data.usagePercent.toFixed(0)}%
          </span>
        ) : (
          <span className="text-sidebar-foreground/60">…</span>
        )}
      </div>
      <Progress
        value={data?.usagePercent != null ? Math.min(data.usagePercent, 100) : 0}
        className={cn("h-1.5 bg-sidebar-accent", tone(data?.usagePercent ?? 0))}
        aria-label={
          data?.usagePercent != null
            ? `Pemakaian storage ${data.usagePercent.toFixed(0)}%`
            : "Memuat pemakaian storage"
        }
      />
      <p className="mt-1 text-[10px] leading-tight text-sidebar-foreground/60">
        {data
          ? `${formatBytes(data.totalBytes)} · ${data.fileCount} file${
              data.cleanupCandidates != null && data.cleanupCandidates > 0
                ? ` · ${data.cleanupCandidates} kandidat cleanup`
                : ""
            }`
          : "Memuat…"}
      </p>
    </button>
  );
}
