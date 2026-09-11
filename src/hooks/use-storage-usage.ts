import { useCallback, useEffect, useState } from "react";

/**
 * Data laporan /api/storage-usage (getUploadStorageStats + timestamp).
 * Satu tipe untuk panel beranda dan widget sidebar agar tidak menyimpang.
 */
export type StorageUsageData = {
  ok?: boolean;
  fileCount: number;
  totalBytes: number;
  byMimeType: { mimeType: string; count: number; bytes: number }[];
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
    // Kirim cron terakhir (apa pun hasilnya) — dari /api/cron/storage-alert.
    lastSendAt: string | null;
    lastChannelsWhatsapp: boolean | null;
    lastChannelsTelegram: boolean | null;
    // Uji manual terakhir — dari /api/notifications/test-alert.
    lastTestedAt: string | null;
    lastTestSendAt: string | null;
    lastTestChannelsWhatsapp: boolean | null;
    lastTestChannelsTelegram: boolean | null;
  } | null;
  timestamp: string;
};

/**
 * Muat /api/storage-usage (khusus SUPER_ADMIN — route menolak role lain) dan
 * muat ulang otomatis setiap `refreshMs` milidetik (0 = hanya manual).
 *
 * Aman dipasang di sidebar yang hidup di semua halaman admin: request
 * gagal (mis. sesi berakhir) tidak melempar error dan tidak mereset data
 * terakhir; `error` cukup untuk memutuskan apakah widget ditampilkan.
 * Pola interval mengikuti SidebarNav (fetch /api/stats tiap 30 detik).
 */
export function useStorageUsage(
  refreshMs: number,
  enabled = true
): {
  data: StorageUsageData | null;
  error: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<StorageUsageData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/storage-usage", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as StorageUsageData;
        if (!active) return;
        setData(json);
        setError(false);
      } catch {
        // Pertahankan data terakhir; error hanya menyembunyikan widget.
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    if (refreshMs > 0) {
      const interval = setInterval(load, refreshMs);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }
    return () => {
      active = false;
    };
  }, [tick, enabled, refreshMs]);

  return { data, error, loading, refresh };
}
