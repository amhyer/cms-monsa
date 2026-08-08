"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database,
  Download,
  Save,
  Loader2,
  PlugZap,
  School,
  Users,
  UserSquare2,
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/format";
import type {
  GTK,
  PesertaDidik,
  RombonganBelajar,
  Sekolah,
} from "@/lib/dapodik-client";
import type { SyncCounts } from "@/lib/dapodik-sync";
import { PageLoader, EmptyState } from "../_shared";

// ---- Konstanta & helper label periode -------------------------------------

const SEMESTER_STORAGE_KEY = "dapodik.selectedSemester";

// "20261" → "2026/2027 Ganjil"; "20252" → "2025/2026 Genap".
function semesterLabel(sid: string | null | undefined): string {
  if (!sid || !/^[0-9]{4}[12]$/.test(sid)) return sid || "-";
  const y = Number(sid.slice(0, 4));
  const s = sid.slice(4);
  return `${y}/${y + 1} ${s === "1" ? "Ganjil" : "Genap"}`;
}

// Fallback 12 semester terakhir (dipakai kalau daftar dari Dapodik kosong/
// gagal dimuat). Urut menurun: semester paling baru di atas.
function semesterOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1..12
  // Semester ganjil dimulai Juli; kalau sekarang sebelum Juli, ganjil terakhir
  // adalah tahun lalu.
  let y = month >= 7 ? year : year - 1;
  const list: string[] = [];
  let sem = 1;
  for (let i = 0; i < 12; i++) {
    list.push(`${y}${sem}`);
    sem = sem === 1 ? 2 : 1;
    if (sem === 1) y -= 1;
  }
  return list;
}

// Daftar semester unik dari data yang SUDAH ditarik (tanpa fetch ulang).
function deriveSemestersFromData(d: DapodikData | null): string[] | null {
  if (!d) return null;
  const seen = new Set<string>();
  for (const s of d.peserta_didik ?? []) if (s.semester_id) seen.add(s.semester_id);
  for (const r of d.rombel ?? []) if (r.semester_id) seen.add(r.semester_id);
  if (seen.size === 0) return null;
  return [...seen].sort().reverse();
}

// Pilihan semester terakhir dari localStorage (per browser operator).
function readStoredSemester(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(SEMESTER_STORAGE_KEY);
    // Hanya terima format semester Dapodik (XXXX1/XXXX2); selain itu abaikan.
    if (raw && /^[0-9]{4}[12]$/.test(raw)) return raw;
    if (raw) window.localStorage.removeItem(SEMESTER_STORAGE_KEY);
  } catch {
    // Mode privat / storage tak tersedia — fallback tanpa persist.
  }
  return "";
}

function persistSemester(sid: string) {
  if (typeof window === "undefined") return;
  try {
    if (sid) window.localStorage.setItem(SEMESTER_STORAGE_KEY, sid);
    else window.localStorage.removeItem(SEMESTER_STORAGE_KEY);
  } catch {
    // abaikan
  }
}

// ---- Tipe data hasil tarikan ----------------------------------------------

type DapodikData = {
  sekolah: Sekolah | null;
  peserta_didik: PesertaDidik[];
  gtk: GTK[];
  rombel: RombonganBelajar[];
};

const EMPTY_DATA: DapodikData = {
  sekolah: null,
  peserta_didik: [],
  gtk: [],
  rombel: [],
};

const STEPS = [
  { key: "sekolah", label: "Sekolah" },
  { key: "siswa", label: "Peserta Didik" },
  { key: "gtk", label: "GTK / Guru" },
  { key: "rombel", label: "Rombongan Belajar" },
] as const;

type StepStatus = "pending" | "running" | "done" | "error";

// ---- Kartu ringkasan -------------------------------------------------------

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof School;
  loading?: boolean;
  accent?: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">
              {loading ? "…" : value}
            </p>
            {subtitle && !loading && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="size-3" />
                <span className="truncate">{subtitle}</span>
              </p>
            )}
          </div>
          <div
            className={`rounded-lg p-2.5 ${accent ?? "bg-muted text-muted-foreground"}`}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Komponen utama --------------------------------------------------------

export function DapodikManager() {
  const [configLoaded, setConfigLoaded] = useState(false);
  const [config, setConfig] = useState({
    npsn: "",
    token: "",
    host: "localhost",
    port: "5774",
    protocol: "http" as "http" | "https",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Sinkronisasi otomatis (jadwal berkala).
  const [autoSync, setAutoSync] = useState({
    enabled: false,
    intervalHours: 24,
    lastRunAt: null as string | null,
    lastStatus: null as "OK" | "ERROR" | null,
    lastError: null as string | null,
    lastSyncAt: null as string | null,
    nextRunAt: null as string | null,
    saving: false,
  });

  // Periode & daftar semester dinamis dari Dapodik.
  const [semesterId, setSemesterId] = useState("");
  const [availableSemesters, setAvailableSemesters] = useState<string[] | null>(null);
  const [semesterCounts, setSemesterCounts] = useState<
    Record<string, { siswa: number; rombel: number }> | null
  >(null);

  // Hasil tarikan data & progress per langkah.
  const [data, setData] = useState<DapodikData | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState<Record<string, StepStatus>>({});

  // Sinkronisasi / preview.
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    counts?: SyncCounts;
    errors?: string[];
    semesterId?: string | null;
  } | null>(null);

  // Pulihkan pilihan semester terakhir dari localStorage saat halaman dibuka.
  useEffect(() => {
    setSemesterId(readStoredSemester());
  }, []);

  // Muat daftar semester yang benar-benar tersedia di Dapodik.
  const loadSemesters = useCallback(async () => {
    try {
      const res = await fetch("/api/dapodik/semesters", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat daftar semester");
      const list = Array.isArray(json.semesters) ? (json.semesters as string[]) : [];
      setAvailableSemesters(list.length > 0 ? list : null);
      if (json.counts && typeof json.counts === "object") {
        setSemesterCounts(json.counts as Record<string, { siswa: number; rombel: number }>);
      }
    } catch {
      setAvailableSemesters(null);
      setSemesterCounts(null);
    }
  }, []);

  // Muat konfigurasi tersimpan; jika ada, sekalian muat daftar semester.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/dapodik/config", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat konfigurasi");
        if (!alive) return;
        const c = json.config;
        if (c) {
          setConfig({
            npsn: c.npsn ?? "",
            token: c.token ?? "",
            host: c.host ?? "localhost",
            port: String(c.port ?? 5774),
            protocol: c.protocol === "https" ? "https" : "http",
          });
          setConfigLoaded(true);
        }
      } catch {
        // Belum ada konfigurasi — biarkan form kosong.
      } finally {
        if (alive) setConfigLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Setelah config tersedia, muat daftar semester.
  useEffect(() => {
    if (configLoaded) loadSemesters();
  }, [configLoaded, loadSemesters]);

  // Muat status sinkronisasi otomatis.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/dapodik/auto-sync", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat pengaturan");
        if (!alive) return;
        setAutoSync((s) => ({
          ...s,
          enabled: Boolean(json.enabled),
          intervalHours: Number(json.intervalHours) || 24,
          lastRunAt: json.autoSyncLastRunAt ?? null,
          lastStatus: json.autoSyncLastStatus ?? null,
          lastError: json.autoSyncLastError ?? null,
          lastSyncAt: json.lastSyncAt ?? null,
          nextRunAt: json.nextRunAt ?? null,
        }));
      } catch {
        // status gagal dimuat — biarkan kartu menampilkan nilai default
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Simpan pengaturan sinkronisasi otomatis.
  const saveAutoSync = async () => {
    setAutoSync((s) => ({ ...s, saving: true }));
    try {
      const res = await fetch("/api/dapodik/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: autoSync.enabled,
          intervalHours: autoSync.intervalHours,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan pengaturan");
      setAutoSync((s) => ({
        ...s,
        enabled: Boolean(json.enabled),
        intervalHours: Number(json.intervalHours) || s.intervalHours,
        lastRunAt: json.autoSyncLastRunAt ?? null,
        lastStatus: json.autoSyncLastStatus ?? null,
        lastError: json.autoSyncLastError ?? null,
        lastSyncAt: json.lastSyncAt ?? null,
        nextRunAt: json.nextRunAt ?? null,
      }));
      toast.success(
        autoSync.enabled
          ? "Sinkronisasi otomatis diaktifkan."
          : "Sinkronisasi otomatis dinonaktifkan."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan pengaturan.");
    } finally {
      setAutoSync((s) => ({ ...s, saving: false }));
    }
  };

  const saveConfig = async () => {
    if (!config.npsn.trim() || !config.token.trim()) {
      toast.error("NPSN dan token wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dapodik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npsn: config.npsn.trim(),
          token: config.token.trim(),
          host: config.host.trim() || "localhost",
          port: Number(config.port) || 5774,
          protocol: config.protocol,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan konfigurasi");
      toast.success("Konfigurasi Dapodik disimpan.");
      setConfigLoaded(true);
      loadSemesters();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!config.npsn.trim() || !config.token.trim()) {
      toast.error("NPSN dan token wajib diisi.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/dapodik/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npsn: config.npsn.trim(),
          token: config.token.trim(),
          host: config.host.trim() || "localhost",
          port: Number(config.port) || 5774,
          protocol: config.protocol,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Koneksi gagal");
      toast.success(`Koneksi berhasil: ${json.sekolah?.nama ?? "Dapodik"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Koneksi gagal.");
    } finally {
      setTesting(false);
    }
  };

  // Tarik data dari Dapodik. endpoint: "all" | "sekolah" | "siswa" | "gtk" | "rombel".
  const fetchData = useCallback(
    async (endpoint: string) => {
      if (!configLoaded) {
        toast.error("Simpan konfigurasi Dapodik terlebih dahulu.");
        return;
      }
      setFetching(true);
      setSyncResult(null);
      setProgress(Object.fromEntries(STEPS.map((s) => [s.key, "pending"])));
      const next: DapodikData = { ...EMPTY_DATA };
      const targets = endpoint === "all" ? STEPS : STEPS.filter((s) => s.key === endpoint);
      try {
        for (const step of targets) {
          setProgress((p) => ({ ...p, [step.key]: "running" }));
          const res = await fetch("/api/dapodik/pull", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: step.key,
              semesterId: semesterId || undefined,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || `Gagal menarik ${step.label}`);
          if (step.key === "sekolah") next.sekolah = json.sekolah ?? null;
          if (step.key === "siswa") next.peserta_didik = json.peserta_didik ?? [];
          if (step.key === "gtk") next.gtk = json.gtk ?? [];
          if (step.key === "rombel") next.rombel = json.rombel ?? [];
          setProgress((p) => ({ ...p, [step.key]: "done" }));
        }
        setData(next);
        setLastFetch(new Date().toISOString());
        // Derive daftar semester dari data yang baru saja ditarik (tanpa
        // fetch ulang ke Dapodik) supaya dropdown selalu sinkron.
        const derived = deriveSemestersFromData(next);
        if (derived) {
          setAvailableSemesters(derived);
          // Badge jumlah per semester dihitung dari data yang baru ditarik
          // (siswa) + rombel, tanpa memanggil Dapodik sekali lagi.
          const counts: Record<string, { siswa: number; rombel: number }> = {};
          for (const s of next.peserta_didik) {
            if (s.semester_id) {
              counts[s.semester_id] = counts[s.semester_id] ?? { siswa: 0, rombel: 0 };
              counts[s.semester_id].siswa += 1;
            }
          }
          for (const r of next.rombel) {
            if (r.semester_id) {
              counts[r.semester_id] = counts[r.semester_id] ?? { siswa: 0, rombel: 0 };
              counts[r.semester_id].rombel += 1;
            }
          }
          // Merge, jangan replace — hasil tarikan per semester hanya berisi
          // semester yang ditarik, counts semester lain tetap dipertahankan.
          setSemesterCounts((prev) => ({ ...(prev ?? {}), ...counts }));
        }
        toast.success("Data Dapodik berhasil ditarik.");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Gagal menarik data Dapodik";
        toast.error(message);
        setProgress((p) => {
          const running = Object.keys(p).find((k) => p[k] === "running");
          return running ? { ...p, [running]: "error" } : p;
        });
      } finally {
        setFetching(false);
      }
    },
    [configLoaded, semesterId]
  );

  // Preview (dry-run) atau sinkronisasi nyata ke database.
  const runSync = async (dryRun: boolean) => {
    if (!configLoaded) {
      toast.error("Simpan konfigurasi Dapodik terlebih dahulu.");
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(dryRun ? "/api/dapodik/preview" : "/api/dapodik/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: semesterId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal sinkronisasi");
      setSyncResult(json);
      toast.success(dryRun ? "Preview selesai — belum ada data yang ditulis." : "Sinkronisasi ke database selesai.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal sinkronisasi.");
    } finally {
      setSyncing(false);
    }
  };

  // Daftar semester yang ditampilkan: dari Dapodik (dinamis) atau fallback.
  // Kalau pilihan tersimpan (localStorage) tidak ada di daftar, tetap tampilkan
  // di posisi teratas supaya tidak tampak hilang.
  const semesterListBase = availableSemesters ?? semesterOptions();
  const semesterList = semesterId && !semesterListBase.includes(semesterId)
    ? [semesterId, ...semesterListBase]
    : semesterListBase;
  const dataSemester = semesterId || "";

  // Periode ringkas utk kartu ringkasan (format konsisten dgn header).
  const periodHint = data
    ? dataSemester
      ? semesterLabel(dataSemester)
      : "Semester aktif"
    : undefined;

  if (!configLoaded) return <PageLoader label="Memuat pengaturan Dapodik…" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Penarikan Data Dapodik</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tarik data dari Dapodik Web Service untuk dipakai di website sekolah.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastFetch && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3 text-emerald-600" />
              Terakhir ditarik: {formatDateTime(lastFetch)}
              {dataSemester && ` · Periode: ${semesterLabel(dataSemester)}`}
            </Badge>
          )}
          {!lastFetch && (
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="size-3" />
              Belum ada data ditarik
            </Badge>
          )}
        </div>
      </div>

      {/* Konfigurasi koneksi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4 text-primary" />
            Konfigurasi Koneksi Dapodik
          </CardTitle>
          <CardDescription>
            NPSN & token Web Service Dapodik. Biasanya di server lokal sekolah
            (localhost:5774).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="dap-npsn">NPSN</Label>
              <Input
                id="dap-npsn"
                value={config.npsn}
                onChange={(e) => setConfig({ ...config, npsn: e.target.value })}
                placeholder="40313912"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dap-token">Token Web Service</Label>
              <Input
                id="dap-token"
                type="password"
                value={config.token}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder="Token dari Prefill Dapodik"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dap-host">Host</Label>
              <Input
                id="dap-host"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dap-port">Port</Label>
              <Input
                id="dap-port"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                placeholder="5774"
              />
            </div>
            <div className="space-y-2">
              <Label>Protokol</Label>
              <Select
                value={config.protocol}
                onValueChange={(v) => setConfig({ ...config, protocol: v as "http" | "https" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Protokol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">http://</SelectItem>
                  <SelectItem value="https">https://</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan Konfigurasi
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Uji Koneksi
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sinkronisasi otomatis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="size-4 text-primary" />
            Sinkronisasi Otomatis
          </CardTitle>
          <CardDescription>
            Tarik & sinkronkan data Dapodik ke database secara berkala tanpa
            klik manual. Scheduler berjalan selama server website aktif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="dap-auto-sync"
                checked={autoSync.enabled}
                onCheckedChange={(v) => setAutoSync((s) => ({ ...s, enabled: v }))}
              />
              <div>
                <Label htmlFor="dap-auto-sync" className="font-medium">
                  Aktifkan jadwal otomatis
                </Label>
                <p className="text-xs text-muted-foreground">
                  {autoSync.enabled
                    ? "Data ditarik otomatis sesuai interval di bawah."
                    : "Matikan untuk hanya sinkronisasi manual."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label>Interval</Label>
                <Select
                  value={String(autoSync.intervalHours)}
                  onValueChange={(v) =>
                    setAutoSync((s) => ({ ...s, intervalHours: Number(v) }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Pilih interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">Setiap 6 jam</SelectItem>
                    <SelectItem value="12">Setiap 12 jam</SelectItem>
                    <SelectItem value="24">Setiap 24 jam (harian)</SelectItem>
                    <SelectItem value="48">Setiap 2 hari</SelectItem>
                    <SelectItem value="168">Setiap 7 hari</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveAutoSync} disabled={autoSync.saving}>
                {autoSync.saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Simpan
              </Button>
            </div>
          </div>

          {/* Status jadwal */}
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">
                Auto-sync terakhir
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-medium">
                {autoSync.lastRunAt ? (
                  <>
                    {formatDateTime(autoSync.lastRunAt)}
                    {autoSync.lastStatus === "OK" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : autoSync.lastStatus === "ERROR" ? (
                      <XCircle className="size-3.5 text-red-600" />
                    ) : null}
                  </>
                ) : (
                  "Belum pernah berjalan"
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">
                Jadwal berikutnya
              </p>
              <p className="mt-0.5 font-medium">
                {autoSync.enabled
                  ? autoSync.nextRunAt
                    ? formatDateTime(autoSync.nextRunAt)
                    : "Segera (menunggu jadwal pertama)"
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">
                Sinkronisasi terakhir
              </p>
              <p className="mt-0.5 font-medium">
                {autoSync.lastSyncAt ? formatDateTime(autoSync.lastSyncAt) : "—"}
              </p>
            </div>
          </div>
          {autoSync.lastStatus === "ERROR" && autoSync.lastError && (
            <p className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600 dark:border-red-900 dark:bg-red-950">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {autoSync.lastError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Periode & aksi tarik data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" />
            Periode & Tarik Data
          </CardTitle>
          <CardDescription>
            Pilih semester yang datanya ingin ditarik. Daftar semester diambil
            otomatis dari data yang tersedia di Dapodik sekolah Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs space-y-2">
              <Label htmlFor="dap-semester">Periode</Label>
              <Select
                value={semesterId || "__aktif__"}
                onValueChange={(v) => {
                  const sid = v === "__aktif__" ? "" : v;
                  setSemesterId(sid);
                  persistSemester(sid);
                }}
              >
                <SelectTrigger id="dap-semester" className="w-full">
                  <SelectValue placeholder="Semester aktif (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__aktif__">Semester aktif (default)</SelectItem>
                  {semesterList.map((sid) => {
                    const c = semesterCounts?.[sid];
                    return (
                      <SelectItem key={sid} value={sid} textValue={semesterLabel(sid)}>
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="truncate">{semesterLabel(sid)}</span>
                          {c && (
                            <span className="flex shrink-0 items-center gap-1.5">
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                {c.siswa} siswa
                              </Badge>
                              {c.rombel > 0 && (
                                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                  {c.rombel} rombel
                                </Badge>
                              )}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {availableSemesters
                  ? "Daftar dari Dapodik (otomatis diperbarui setelah tarik data)."
                  : "Daftar fallback 12 semester terakhir (tunggu tarik data untuk daftar asli)."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => fetchData("all")} disabled={fetching}>
                {fetching ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Tarik Data
              </Button>
              <Button
                variant="outline"
                onClick={() => runSync(true)}
                disabled={syncing || fetching}
              >
                <Search className="size-4" />
                Preview Sinkronisasi
              </Button>
              <Button
                variant="secondary"
                onClick={() => runSync(false)}
                disabled={syncing || fetching}
              >
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Sinkron ke Database
              </Button>
            </div>
          </div>

          {/* Progress per langkah */}
          {fetching && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => {
                const status = progress[s.key] ?? "pending";
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                      status === "done"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950"
                        : status === "running"
                          ? "border-primary/30 bg-primary/5 text-primary"
                          : status === "error"
                            ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950"
                            : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {status === "done" ? (
                      <CheckCircle2 className="size-4 shrink-0" />
                    ) : status === "running" ? (
                      <Loader2 className="size-4 shrink-0 animate-spin" />
                    ) : status === "error" ? (
                      <XCircle className="size-4 shrink-0" />
                    ) : (
                      <span className="size-4 shrink-0 rounded-full border border-current opacity-40" />
                    )}
                    <span className="truncate font-medium">{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kartu ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Sekolah"
          value={data?.sekolah?.nama ?? (fetching ? "…" : 0)}
          subtitle={
            data?.sekolah
              ? `NPSN ${data.sekolah.npsn}`
              : undefined
          }
          icon={School}
          loading={fetching && !data}
          accent="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        />
        <SummaryCard
          title="Peserta Didik"
          value={data?.peserta_didik.length ?? 0}
          subtitle={periodHint}
          icon={UserSquare2}
          loading={fetching && !data}
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <SummaryCard
          title="GTK / Guru"
          value={data?.gtk.length ?? 0}
          subtitle={periodHint}
          icon={Users}
          loading={fetching && !data}
          accent="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        />
        <SummaryCard
          title="Rombongan Belajar"
          value={data?.rombel.length ?? 0}
          subtitle={periodHint}
          icon={GraduationCap}
          loading={fetching && !data}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        />
      </div>

      {/* Hasil sinkronisasi / preview */}
      {syncResult && syncResult.counts && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Hasil Sinkronisasi
              {syncResult.semesterId && (
                <Badge variant="secondary">{semesterLabel(syncResult.semesterId)}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <CountBox
                label="Peserta Didik"
                counts={syncResult.counts.siswa}
              />
              <CountBox label="GTK / Guru" counts={syncResult.counts.gtk} />
              <CountBox label="Rombongan Belajar" counts={syncResult.counts.rombel} />
            </div>
            {syncResult.errors && syncResult.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p className="mb-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="size-3.5" />
                  {syncResult.errors.length} catatan
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {syncResult.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {syncResult.errors.length > 8 && (
                    <li>… dan {syncResult.errors.length - 8} lainnya</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabel data hasil tarikan */}
      <Card>
        <CardContent className="p-4">
          {!data && !fetching ? (
            <EmptyState
              title="Belum ada data"
              description="Klik 'Tarik Data' untuk mengambil data dari Dapodik."
              icon={Database}
              className="py-10"
            />
          ) : (
            <Tabs defaultValue="sekolah">
              <TabsList className="mb-4 flex w-full justify-start overflow-x-auto">
                <TabsTrigger value="sekolah">Sekolah</TabsTrigger>
                <TabsTrigger value="siswa">Peserta Didik ({data?.peserta_didik.length ?? 0})</TabsTrigger>
                <TabsTrigger value="gtk">GTK / Guru ({data?.gtk.length ?? 0})</TabsTrigger>
                <TabsTrigger value="rombel">Rombel ({data?.rombel.length ?? 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="sekolah" className="space-y-3">
                {data?.sekolah ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoBox label="Nama Sekolah" value={data.sekolah.nama ?? "-"} />
                    <InfoBox label="NPSN" value={data.sekolah.npsn ?? "-"} />
                    <InfoBox label="Alamat" value={data.sekolah.alamat_jalan ?? data.sekolah.alamat ?? "-"} wide />
                    <InfoBox label="Wilayah" value={[data.sekolah.kelurahan, data.sekolah.kecamatan, data.sekolah.kabupaten, data.sekolah.provinsi].filter(Boolean).join(", ") || "-"} wide />
                  </div>
                ) : (
                  <EmptyState title="Data sekolah belum ditarik" icon={School} className="py-8" />
                )}
              </TabsContent>

              <TabsContent value="siswa">
                {data && data.peserta_didik.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>NIS / NIPD</TableHead>
                        <TableHead>NISN</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>L/P</TableHead>
                        <TableHead>Rombel</TableHead>
                        <TableHead>Periode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.peserta_didik.slice(0, 100).map((s, i) => (
                        <TableRow key={s.peserta_didik_id ?? i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>{s.nipd || "-"}</TableCell>
                          <TableCell>{s.nisn || "-"}</TableCell>
                          <TableCell className="font-medium">{s.nama}</TableCell>
                          <TableCell>{s.jenis_kelamin || "-"}</TableCell>
                          <TableCell>{s.nama_rombel || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px]">
                              {semesterLabel(s.semester_id || dataSemester || null)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState title="Data peserta didik belum ditarik" icon={UserSquare2} className="py-8" />
                )}
              </TabsContent>

              <TabsContent value="gtk">
                {data && data.gtk.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>NUPTK</TableHead>
                        <TableHead>NIP</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Periode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.gtk.slice(0, 100).map((g, i) => (
                        <TableRow key={`${g.nuptk ?? g.nip ?? g.nama}-${i}`}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{g.nama}</TableCell>
                          <TableCell>{g.nuptk || "-"}</TableCell>
                          <TableCell>{g.nip || "-"}</TableCell>
                          <TableCell>{g.jenis_ptk_id_str || g.jabatan || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px]">
                              {semesterLabel(g.semester_id || dataSemester || null)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState title="Data GTK belum ditarik" icon={Users} className="py-8" />
                )}
              </TabsContent>

              <TabsContent value="rombel">
                {data && data.rombel.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>Nama Rombel</TableHead>
                        <TableHead>Tingkat</TableHead>
                        <TableHead>Wali Kelas</TableHead>
                        <TableHead>Periode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rombel.map((r, i) => (
                        <TableRow key={r.rombongan_belajar_id ?? i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{r.nama}</TableCell>
                          <TableCell>{r.tingkat_pendidikan_id_str || r.tingkat_pendidikan_id || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px]">
                              {semesterLabel(r.semester_id || dataSemester || null)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState title="Data rombel belum ditarik" icon={GraduationCap} className="py-8" />
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Kotak ringkasan hasil sinkronisasi ------------------------------------

function CountBox({ label, counts }: { label: string; counts: SyncCounts[keyof SyncCounts] }) {
  const items = [
    { k: "update", label: "Diperbarui", cls: "text-emerald-600" },
    { k: "create", label: "Baru", cls: "text-sky-600" },
    { k: "error", label: "Gagal", cls: "text-red-600" },
    ...(counts && "archived" in counts ? [{ k: "archived", label: "Dinonaktifkan", cls: "text-amber-600" }] : []),
  ] as const;
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((it) => (
          <span key={it.k} className="flex items-baseline gap-1 text-sm">
            <b className={`text-base ${it.cls}`}>{counts?.[it.k as keyof typeof counts] ?? 0}</b>
            <span className="text-[11px] text-muted-foreground">{it.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function InfoBox({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg border bg-muted/30 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
