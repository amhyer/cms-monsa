"use client";

/**
 * Panel status storage upload (khusus SUPER_ADMIN) untuk beranda dashboard.
 *
 * Menampilkan laporan dari /api/storage-usage (getUploadStorageStats):
 *   - pemakaian kuota (bar + persen, dari NEON_STORAGE_QUOTA_MB),
 *   - kandidat cleanup (file yang akan dihapus cron cleanup-uploads),
 *   - dampak referensi (kandidat yang masih dipakai konten → berisiko 404),
 *   - status alert terakhir (dari tabel StorageAlertState, ditulis cron
 *     /api/cron/storage-alert).
 *
 * Gagal memuat → kartu error ringkas dengan tombol coba lagi; panel tidak
 * pernah menggagalkan beranda (data dimuat terpisah dari /api/stats).
 */

import { useCallback, useEffect, useState } from "react";
import {
  HardDrive,
  BellRing,
  Trash2,
  LinkIcon,
  CircleCheck,
  CircleX,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/app";
import { formatBytes, formatDateTime } from "@/lib/format";

type MimeStat = { mimeType: string; count: number; bytes: number };

type StorageUsageData = {
  fileCount: number;
  totalBytes: number;
  byMimeType: MimeStat[];
  quotaBytes: number | null;
  usagePercent: number | null;
  cleanupCandidates: number | null;
  impact: {
    referencedCandidates: number;
    safeCandidates: number;
    byEntity: Record<string, number>;
  } | null;
  alertState: {
    aboveThreshold: boolean;
    lastAlertedAt: string | null;
    lastUsagePercent: number | null;
  } | null;
  timestamp: string;
};

/**
 * Warna bar sesuai tingkat pemakaian. Literal penuh (bukan gabungan dinamis)
 * agar Tailwind menemukan kandidat kelas di file ini.
 */
function usageToneClass(percent: number): string {
  if (percent >= 80) return "[&_[data-slot=progress-indicator]]:bg-destructive";
  if (percent >= 60)
    return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
}

function StatLine({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "danger" | "warning" | "muted";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-medium ${toneClass}`}>{value}</p>
      </div>
    </div>
  );
}

export function StorageStatusPanel() {
  const isAdmin = useAppStore((s) => s.user?.role === "SUPER_ADMIN");
  const [data, setData] = useState<StorageUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/storage-usage", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as StorageUsageData;
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4 text-gold-foreground" />
            Storage Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-3 text-sm text-muted-foreground">Memuat…</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4 text-gold-foreground" />
            Storage Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Gagal memuat laporan storage.
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1 size-3" /> Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pct = data.usagePercent;
  const impact = data.impact;
  const alert = data.alertState;
  const riskyCandidates = impact?.referencedCandidates ?? null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4 text-gold-foreground" />
          Storage Upload
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Kuota — bar pemakaian (tanpa kuota: hanya total) */}
        {pct !== null && data.quotaBytes !== null ? (
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-semibold">
                {pct.toFixed(1)}%
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  dari kuota
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {formatBytes(data.totalBytes)} / {formatBytes(data.quotaBytes)}
              </span>
            </div>
            <Progress
              value={Math.min(pct, 100)}
              className={`h-2 ${usageToneClass(pct)}`}
            />
            {pct >= 80 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3" /> Melewati ambang alert
                default (80%).
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm">
            <span className="font-semibold">{formatBytes(data.totalBytes)}</span>
            <span className="text-muted-foreground"> · {data.fileCount} file</span>
            <span className="block text-xs text-muted-foreground">
              Set NEON_STORAGE_QUOTA_MB untuk melihat persentase kuota.
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Kandidat cleanup */}
          <StatLine
            icon={Trash2}
            label="Kandidat cleanup"
            value={
              data.cleanupCandidates === null
                ? "Cleanup nonaktif"
                : `${data.cleanupCandidates} file`
            }
            tone={
              data.cleanupCandidates !== null && data.cleanupCandidates > 0
                ? "warning"
                : undefined
            }
          />
          {/* Dampak referensi */}
          <StatLine
            icon={LinkIcon}
            label="Kandidat masih dipakai konten"
            value={
              impact === null
                ? "Tidak diketahui"
                : riskyCandidates === 0
                  ? "0 — aman dihapus"
                  : `${riskyCandidates} file berisiko 404`
            }
            tone={
              impact !== null && (riskyCandidates ?? 0) > 0
                ? "danger"
                : impact !== null
                  ? "muted"
                  : undefined
            }
          />
          {/* Status alert terakhir */}
          <div className="flex items-start gap-2 text-sm">
            {alert === null ? (
              <>
                <BellRing className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Alert kuota</p>
                  <p className="text-muted-foreground">Belum pernah berjalan</p>
                </div>
              </>
            ) : alert.aboveThreshold ? (
              <>
                <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Alert kuota</p>
                  <p className="font-medium text-destructive">
                    Di atas ambang
                    {alert.lastUsagePercent !== null
                      ? ` · ${alert.lastUsagePercent}%`
                      : ""}
                  </p>
                  {alert.lastAlertedAt && (
                    <p className="text-xs text-muted-foreground">
                      Notif: {formatDateTime(alert.lastAlertedAt)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Alert kuota</p>
                  <p className="font-medium">Di bawah ambang</p>
                  {alert.lastAlertedAt && (
                    <p className="text-xs text-muted-foreground">
                      Notif terakhir: {formatDateTime(alert.lastAlertedAt)}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Rincian jenis file + entitas perujuk */}
        {(data.byMimeType.length > 0 || (impact && riskyCandidates ? true : false)) && (
          <div className="grid grid-cols-1 gap-2 border-t pt-2 text-xs text-muted-foreground sm:grid-cols-2">
            {data.byMimeType.length > 0 && (
              <p className="truncate">
                {data.byMimeType
                  .slice(0, 3)
                  .map(
                    (m) => `${m.mimeType.replace("application/", "")}: ${m.count}`
                  )
                  .join(" · ")}
                {data.byMimeType.length > 3
                  ? ` · +${data.byMimeType.length - 3} lainnya`
                  : ""}
              </p>
            )}
            {impact && riskyCandidates ? (
              <p className="truncate">
                Dirujuk oleh:{" "}
                {Object.entries(impact.byEntity)
                  .map(([entity, n]) => `${entity} (${n})`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Diperbarui {formatDateTime(data.timestamp)} · cron cleanup hapus
          file &gt; 90 hari, cron alert memberi tahu admin via WhatsApp/Telegram.
        </p>
      </CardContent>
    </Card>
  );
}

export default StorageStatusPanel;
