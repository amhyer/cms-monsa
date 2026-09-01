"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  Database,
  Users,
  GraduationCap,
  Building2,
  Loader2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  ArrowUpCircle,
  Save,
  CheckCircle2,
  XCircle,
  Circle,
  Cable,
  KeyRound,
  Copy,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "../_shared";

type DapodikData = {
  sekolah?: {
    nama: string;
    npsn: string;
    alamat?: string;
    alamat_jalan?: string;
    provinsi?: string;
    kabupaten?: string;
    kabupaten_kota?: string;
    kecamatan?: string;
    kelurahan?: string;
    desa_kelurahan?: string;
  };
  peserta_didik?: Array<{
    nama: string;
    nipd: string;
    nisn: string;
    nik: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    jenis_kelamin: string;
    alamat_jalan: string;
    nomor_telepon_seluler: string;
    nomor_telepon_rumah: string;
    email: string;
    nama_ayah: string;
    pekerjaan_ayah_id_str: string;
    nama_ibu: string;
    pekerjaan_ibu_id_str: string;
    nama_wali: string;
    pekerjaan_wali_id_str: string;
    nama_rombel: string;
    sekolah_asal: string;
    anak_keberapa: string;
    berat_badan: string;
    tinggi_badan: string;
    kebutuhan_khusus: string;
  }>;
  gtk?: Array<{
    nama: string;
    nuptk: string;
    nik: string;
    nip: string;
    jenis_kelamin: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    status_kepegawaian_id_str: string;
    jenis_ptk_id_str: string;
    agama_id_str: string;
    jabatan_ptk_id_str: string;
    pangkat_golongan_terakhir: string;
    pendidikan_terakhir: string;
    bidang_studi_terakhir: string;
  }>;
  rombel?: Array<{ nama: string; tingkat_pendidikan_id_str: string; ptk_id_str: string }>;
};

type SyncPreview = {
  mode: "dry-run";
  sekolah: { updated: number };
  siswa: { created: number; updated: number; archived: number; errors: number };
  gtk: { created: number; updated: number; archived: number; errors: number };
  rombel: { created: number; updated: number; errors: number };
};

type StepStatus = "pending" | "loading" | "done" | "error";

// key di sini HARUS sama dengan nilai "endpoint" yang dikirim ke /api/dapodik
// (sekolah, siswa, guru, rombel) — bukan peserta_didik/gtk, biar sinkron
// dengan tombol-tombol lain (SummaryCard, tab Refresh) yang sudah ada.
const STEPS: { key: "sekolah" | "siswa" | "guru" | "rombel"; label: string }[] = [
  { key: "sekolah", label: "Data Sekolah" },
  { key: "siswa", label: "Peserta Didik" },
  { key: "guru", label: "GTK (Guru & Tendik)" },
  { key: "rombel", label: "Rombongan Belajar" },
];

export function DapodikManager() {
  const [config, setConfig] = useState({ npsn: "", token: "", host: "localhost", port: "5774", protocol: "http", archiveUnlisted: true as boolean, allowInsecureInProduction: false as boolean });
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [data, setData] = useState<DapodikData | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, StepStatus>>({});
  const [hasBridgeToken, setHasBridgeToken] = useState(false);
  const [bridgePrefix, setBridgePrefix] = useState<string | null>(null);
  const [bridgeCreatedAt, setBridgeCreatedAt] = useState<string | null>(null);
  const [plainBridgeToken, setPlainBridgeToken] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch("/api/dapodik/config")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((json) => {
        if (json?.config) {
          setConfig({
            npsn: json.config.npsn || "",
            token: "",
            host: json.config.host || "localhost",
            port: String(json.config.port || 5774),
            protocol: json.config.protocol || "http",
            archiveUnlisted: json.config.archiveUnlisted !== false,
            allowInsecureInProduction: json.config.allowInsecureInProduction === true,
          });
          setHasExistingToken(Boolean(json.config.hasToken ?? json.config.token));
          setHasBridgeToken(Boolean(json.config.hasBridgeToken));
          setBridgePrefix(json.config.bridgeTokenPrefix || null);
          setBridgeCreatedAt(json.config.bridgeTokenCreatedAt || null);
        }
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(true));
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config.npsn || (!config.token && !hasExistingToken)) {
      toast.error("NPSN wajib. Token wajib diisi pada konfigurasi pertama.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dapodik/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npsn: config.npsn,
          ...(config.token ? { token: config.token } : {}),
          host: config.host,
          port: Number(config.port),
          protocol: config.protocol,
          archiveUnlisted: config.archiveUnlisted,
          allowInsecureInProduction: config.allowInsecureInProduction,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Konfigurasi tersimpan!");
      if (config.token) setHasExistingToken(true);
      setShowConfig(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }, [config, hasExistingToken]);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch("/api/dapodik/test-connection", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || json.message || "Test gagal");
      setConnected(true);
      toast.success(json.message);
    } catch (err) {
      setConnected(false);
      const msg = err instanceof Error ? err.message : "Gagal menghubungi Dapodik";
      setError(msg);
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }, []);

  // Ambil satu jenis data saja dari /api/dapodik
  const pullOne = useCallback(async (endpoint: string) => {
    const res = await fetch("/api/dapodik", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json.data;
  }, []);

  const fetchData = useCallback(
    async (endpoint: string = "all") => {
      setLoading(true);
      setError(null);

      try {
        if (endpoint !== "all") {
          // Dipanggil dari SummaryCard / tombol Refresh per tab — tarik satu jenis saja
          setProgress((prev) => ({ ...prev, [endpoint]: "loading" }));
          const result = await pullOne(endpoint);
          setData((prev) => (prev ? { ...prev, ...result } : result));
          setProgress((prev) => ({ ...prev, [endpoint]: "done" }));
        } else {
          // Tombol "Tarik Data" utama — tarik semua jenis satu per satu,
          // sequential (bukan paralel) karena Dapodik lokal sering gagal
          // kalau menerima beberapa request database sekaligus.
          setProgress(Object.fromEntries(STEPS.map((s) => [s.key, "pending"])));
          for (const step of STEPS) {
            setProgress((prev) => ({ ...prev, [step.key]: "loading" }));
            const result = await pullOne(step.key);
            setData((prev) => (prev ? { ...prev, ...result } : result));
            setProgress((prev) => ({ ...prev, [step.key]: "done" }));
          }
        }
        setConnected(true);
        setLastFetch(new Date().toLocaleTimeString("id-ID"));
        toast.success("Data Dapodik berhasil ditarik!");
      } catch (err) {
        if (endpoint === "all") {
          // tandai step yang sedang loading sebagai error, sisanya tetap apa adanya
          setProgress((prev) => {
            const next = { ...prev };
            for (const step of STEPS) {
              if (next[step.key] === "loading") next[step.key] = "error";
            }
            return next;
          });
        } else {
          setProgress((prev) => ({ ...prev, [endpoint]: "error" }));
        }
        const msg = err instanceof Error ? err.message : "Gagal mengambil data";
        setError(msg);
        setConnected(false);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [pullOne]
  );

  const handleSyncPreview = useCallback(async () => {
    if (!data) {
      toast.error("Tarik data Dapodik terlebih dahulu.");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/dapodik/sync?mode=dry-run", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSyncPreview(json);
      setConfirmOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal melakukan dry-run");
    } finally {
      setSyncing(false);
    }
  }, [data]);

  const handleSyncCommit = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/dapodik/sync?mode=commit", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const r = json.results || json;
      toast.success(
        `Sinkron selesai: ${r.siswa.created + r.siswa.updated} siswa, ` +
        `${r.gtk.created + r.gtk.updated} guru, ` +
        `${r.rombel.created + r.rombel.updated} rombel`
      );
      setConfirmOpen(false);
      setSyncPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal sinkronisasi");
    } finally {
      setSyncing(false);
    }
  }, []);

  const downloadJembatan = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/dapodik/download");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jembatan-dapodik-monsa.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Paket jembatan diunduh. Jalankan di PC yang sama dengan Dapodik.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh");
    } finally {
      setDownloading(false);
    }
  }, []);

  const generateBridgeKey = useCallback(async () => {
    if (hasBridgeToken && !window.confirm("Kunci lama akan langsung tidak berlaku. Lanjutkan?")) {
      return;
    }
    setGeneratingKey(true);
    try {
      const res = await fetch("/api/dapodik/bridge", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPlainBridgeToken(json.token);
      setHasBridgeToken(true);
      setBridgePrefix(json.prefix || null);
      setBridgeCreatedAt(new Date().toISOString());
      setTokenDialogOpen(true);
      toast.success("Kunci pairing dibuat. Salin sekarang — tidak ditampilkan lagi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat kunci");
    } finally {
      setGeneratingKey(false);
    }
  }, [hasBridgeToken]);

  const revokeBridgeKey = useCallback(async () => {
    if (!window.confirm("Cabut kunci pairing? Jembatan tidak bisa mengirim data sampai kunci baru dibuat.")) {
      return;
    }
    setRevokingKey(true);
    try {
      const res = await fetch("/api/dapodik/bridge", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setHasBridgeToken(false);
      setBridgePrefix(null);
      setBridgeCreatedAt(null);
      setPlainBridgeToken(null);
      toast.success("Kunci pairing dicabut.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencabut kunci");
    } finally {
      setRevokingKey(false);
    }
  }, []);

  const copyBridgeToken = useCallback(async () => {
    if (!plainBridgeToken) return;
    try {
      await navigator.clipboard.writeText(plainBridgeToken);
      toast.success("Kunci disalin ke papan klip.");
    } catch {
      toast.error("Gagal menyalin. Salin manual dari kotak kunci.");
    }
  }, [plainBridgeToken]);

  if (!configLoaded) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Penarikan Data Dapodik</h1>
          <p className="text-sm text-muted-foreground">
            Konfigurasi koneksi, tarik data, dan sinkronisasi ke database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected !== null && (
            <Badge variant={connected ? "default" : "destructive"} className="gap-1">
              {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
              {connected ? "Tersambung" : "Terputus"}
            </Badge>
          )}
          {lastFetch && (
            <span className="text-xs text-muted-foreground">
              Terakhir ditarik: {lastFetch}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
            <Settings className="mr-1 size-3" />
            {showConfig ? "Tutup" : "Konfigurasi"}
          </Button>
          <Button onClick={() => fetchData("all")} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
            Tarik Data
          </Button>
          <Button variant="default" onClick={handleSyncPreview} disabled={syncing || !data}>
            {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowUpCircle className="mr-2 size-4" />}
            Sinkron ke Database
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 p-3 text-sm">
          {STEPS.map((step) => (
            <div key={step.key} className="flex items-center gap-1.5">
              {progress[step.key] === "loading" && <Loader2 className="size-3.5 animate-spin text-blue-500" />}
              {progress[step.key] === "done" && <CheckCircle2 className="size-3.5 text-emerald-500" />}
              {progress[step.key] === "error" && <XCircle className="size-3.5 text-destructive" />}
              {(!progress[step.key] || progress[step.key] === "pending") && (
                <Circle className="size-3.5 text-muted-foreground" />
              )}
              <span className={progress[step.key] === "done" ? "text-muted-foreground" : ""}>{step.label}</span>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cable className="size-4" />
            Jembatan PC Sekolah
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            CMS di cloud tidak bisa menjangkau Dapodik di <code>localhost:5774</code>.
            Unduh aplikasi jembatan, jalankan di komputer yang sama dengan Dapodik,
            lalu tempel kunci pairing. Port 5774 tetap tertutup dari internet.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadJembatan} disabled={downloading}>
              {downloading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Download className="mr-1 size-3" />}
              Unduh jembatan (.zip)
            </Button>
            <Button variant="outline" size="sm" onClick={generateBridgeKey} disabled={generatingKey}>
              {generatingKey ? <Loader2 className="mr-1 size-3 animate-spin" /> : <KeyRound className="mr-1 size-3" />}
              {hasBridgeToken ? "Buat ulang kunci" : "Buat kunci pairing"}
            </Button>
            {hasBridgeToken && (
              <Button variant="ghost" size="sm" onClick={revokeBridgeKey} disabled={revokingKey}>
                {revokingKey ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Unplug className="mr-1 size-3" />}
                Cabut kunci
              </Button>
            )}
          </div>
          {hasBridgeToken ? (
            <p className="text-xs text-muted-foreground">
              Kunci aktif: <span className="font-mono text-foreground">{bridgePrefix || "monsa_br_"}…</span>
              {bridgeCreatedAt
                ? ` · dibuat ${new Date(bridgeCreatedAt).toLocaleString("id-ID")}`
                : ""}
            </p>
          ) : (
            <p className="text-xs text-amber-700">
              Belum ada kunci pairing. Buat kunci, lalu tempel di aplikasi jembatan.
            </p>
          )}
        </CardContent>
      </Card>

      {showConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Konfigurasi Dapodik Web Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dapodik-npsn">NPSN</Label>
                <Input id="dapodik-npsn" placeholder="20223001" value={config.npsn} onChange={(e) => setConfig((p) => ({ ...p, npsn: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dapodik-host">Host</Label>
                <Input id="dapodik-host" placeholder="localhost" value={config.host} onChange={(e) => setConfig((p) => ({ ...p, host: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dapodik-port">Port</Label>
                <Input id="dapodik-port" placeholder="5774" value={config.port} onChange={(e) => setConfig((p) => ({ ...p, port: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dapodik-protocol">Protocol</Label>
                <Input id="dapodik-protocol" placeholder="http" value={config.protocol} onChange={(e) => setConfig((p) => ({ ...p, protocol: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dapodik-token">Token</Label>
                <Input
                  id="dapodik-token"
                  type="password"
                  placeholder={hasExistingToken ? "Kosongkan jika tidak ingin mengubah token" : "Token autentikasi Dapodik"}
                  value={config.token}
                  onChange={(e) => setConfig((p) => ({ ...p, token: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Nonaktifkan data yang tidak ada di Dapodik</p>
                  <p className="text-xs text-muted-foreground">
                    Saat aktif, siswa/guru yang tidak terdaftar di Dapodik diarsipkan (riwayat kehadiran tetap aman). Saat nonaktif, data lama dibiarkan aktif.
                  </p>
                </div>
                <Switch
                  checked={config.archiveUnlisted}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, archiveUnlisted: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Izinkan HTTP di production</p>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan bila CMS self-host di jaringan sekolah/VPN dan Web Service
                    Dapodik hanya HTTP. CMS di Vercel/cloud tidak bisa menjangkau
                    localhost sekolah — gunakan kartu Jembatan PC Sekolah di atas.
                    Jangan publikasikan port 5774 ke internet.
                  </p>
                </div>
                <Switch
                  checked={config.allowInsecureInProduction}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, allowInsecureInProduction: v }))}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={saveConfig} disabled={saving || !config.npsn || (!config.token && !hasExistingToken)}>
                {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Save className="mr-1 size-3" />}
                Simpan Konfigurasi
              </Button>
              <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Wifi className="mr-1 size-3" />}
                Cek Koneksi
              </Button>
              {connected === true && <span className="text-xs text-emerald-600 font-medium">Koneksi berhasil</span>}
              {connected === false && <span className="text-xs text-destructive font-medium">Koneksi gagal</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="size-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">Pastikan Dapodik Web Service berjalan dan konfigurasi sudah benar.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Sekolah" value={data?.sekolah?.nama ?? "-"} icon={Building2} loading={loading} onPull={() => fetchData("sekolah")} />
        <SummaryCard title="Peserta Didik" value={data?.peserta_didik?.length?.toString() ?? "-"} icon={GraduationCap} loading={loading} onPull={() => fetchData("siswa")} />
        <SummaryCard title="GTK (Guru)" value={data?.gtk?.length?.toString() ?? "-"} icon={Users} loading={loading} onPull={() => fetchData("guru")} />
        <SummaryCard title="Rombel" value={data?.rombel?.length?.toString() ?? "-"} icon={Database} loading={loading} onPull={() => fetchData("rombel")} />
      </div>

      <Tabs defaultValue="siswa">
        <TabsList>
          <TabsTrigger value="siswa">Peserta Didik</TabsTrigger>
          <TabsTrigger value="guru">GTK / Guru</TabsTrigger>
          <TabsTrigger value="rombel">Rombongan Belajar</TabsTrigger>
          <TabsTrigger value="sekolah">Data Sekolah</TabsTrigger>
        </TabsList>

        <TabsContent value="siswa">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Peserta Didik</CardTitle>
              <Button variant="outline" size="sm" onClick={() => fetchData("siswa")} disabled={loading}>
                <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {!data?.peserta_didik?.length ? (
                <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={GraduationCap} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2}>No</TableHead>
                        <TableHead rowSpan={2}>Nama</TableHead>
                        <TableHead rowSpan={2}>NIPD</TableHead>
                        <TableHead rowSpan={2}>JK</TableHead>
                        <TableHead rowSpan={2}>NISN</TableHead>
                        <TableHead rowSpan={2}>Tempat, Tanggal Lahir</TableHead>
                        <TableHead rowSpan={2}>NIK</TableHead>
                        <TableHead rowSpan={2}>Alamat</TableHead>
                        <TableHead rowSpan={2}>HP</TableHead>
                        <TableHead rowSpan={2}>E-Mail</TableHead>
                        <TableHead colSpan={2}>Data Ayah</TableHead>
                        <TableHead colSpan={2}>Data Ibu</TableHead>
                        <TableHead colSpan={2}>Data Wali</TableHead>
                        <TableHead rowSpan={2}>Rombel Saat Ini</TableHead>
                        <TableHead rowSpan={2}>Sekolah Asal</TableHead>
                        <TableHead rowSpan={2}>Anak Ke-</TableHead>
                        <TableHead rowSpan={2}>BB</TableHead>
                        <TableHead rowSpan={2}>TB</TableHead>
                        <TableHead rowSpan={2}>Kebutuhan Khusus</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Pekerjaan</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Pekerjaan</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Pekerjaan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.peserta_didik.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{s.nama ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{s.nipd ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant={s.jenis_kelamin === "L" ? "default" : "secondary"}>
                              {s.jenis_kelamin === "L" ? "L" : s.jenis_kelamin === "P" ? "P" : s.jenis_kelamin ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{s.nisn ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {[s.tempat_lahir, s.tanggal_lahir].filter(Boolean).join(", ") || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{s.nik ?? "-"}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{s.alamat_jalan ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {s.nomor_telepon_seluler || s.nomor_telepon_rumah || "-"}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">{s.email ?? "-"}</TableCell>
                          <TableCell>{s.nama_ayah ?? "-"}</TableCell>
                          <TableCell>{s.pekerjaan_ayah_id_str ?? "-"}</TableCell>
                          <TableCell>{s.nama_ibu ?? "-"}</TableCell>
                          <TableCell>{s.pekerjaan_ibu_id_str ?? "-"}</TableCell>
                          <TableCell>{s.nama_wali ?? "-"}</TableCell>
                          <TableCell>{s.pekerjaan_wali_id_str ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{s.nama_rombel ?? "-"}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{s.sekolah_asal ?? "-"}</TableCell>
                          <TableCell>{s.anak_keberapa ?? "-"}</TableCell>
                          <TableCell>{s.berat_badan ?? "-"}</TableCell>
                          <TableCell>{s.tinggi_badan ?? "-"}</TableCell>
                          <TableCell>{s.kebutuhan_khusus ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guru">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">GTK / Guru</CardTitle>
              <Button variant="outline" size="sm" onClick={() => fetchData("guru")} disabled={loading}>
                <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {!data?.gtk?.length ? (
                <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={Users} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>NUPTK</TableHead>
                        <TableHead>JK</TableHead>
                        <TableHead>Tempat, Tanggal Lahir</TableHead>
                        <TableHead>NIP</TableHead>
                        <TableHead>Status Kepegawaian</TableHead>
                        <TableHead>Jenis PTK</TableHead>
                        <TableHead>Agama</TableHead>
                        <TableHead>Tugas / Jabatan</TableHead>
                        <TableHead>Pangkat Golongan</TableHead>
                        <TableHead>Pendidikan Terakhir</TableHead>
                        <TableHead>Bidang Studi</TableHead>
                        <TableHead>NIK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.gtk.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{g.nama ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{g.nuptk ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant={g.jenis_kelamin === "L" ? "default" : "secondary"}>
                              {g.jenis_kelamin === "L" ? "L" : g.jenis_kelamin === "P" ? "P" : g.jenis_kelamin ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {[g.tempat_lahir, g.tanggal_lahir].filter(Boolean).join(", ") || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{g.nip ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{g.status_kepegawaian_id_str ?? "-"}</TableCell>
                          <TableCell>{g.jenis_ptk_id_str ?? "-"}</TableCell>
                          <TableCell>{g.agama_id_str ?? "-"}</TableCell>
                          <TableCell>{g.jabatan_ptk_id_str ?? "-"}</TableCell>
                          <TableCell>{g.pangkat_golongan_terakhir ?? "-"}</TableCell>
                          <TableCell>{g.pendidikan_terakhir ?? "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{g.bidang_studi_terakhir ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{g.nik ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rombel">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Rombongan Belajar</CardTitle>
              <Button variant="outline" size="sm" onClick={() => fetchData("rombel")} disabled={loading}>
                <RefreshCw className={`mr-1 size-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {!data?.rombel?.length ? (
                <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={Database} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Rombel</TableHead>
                        <TableHead>Tingkat</TableHead>
                        <TableHead>Wali Kelas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rombel.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.nama ?? "-"}</TableCell>
                          <TableCell>{r.tingkat_pendidikan_id_str ?? "-"}</TableCell>
                          <TableCell>{r.ptk_id_str ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sekolah">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Sekolah</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.sekolah ? (
                <EmptyState title="Belum ada data" description='Klik "Tarik Data" untuk mengambil data dari Dapodik.' icon={Building2} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoRow label="Nama" value={data.sekolah.nama} />
                  <InfoRow label="NPSN" value={data.sekolah.npsn} />
                  <InfoRow label="Alamat" value={data.sekolah.alamat_jalan || data.sekolah.alamat} />
                  <InfoRow label="Provinsi" value={data.sekolah.provinsi} />
                  <InfoRow label="Kabupaten" value={data.sekolah.kabupaten_kota || data.sekolah.kabupaten} />
                  <InfoRow label="Kecamatan" value={data.sekolah.kecamatan} />
                  <InfoRow label="Kelurahan" value={data.sekolah.desa_kelurahan || data.sekolah.kelurahan} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Sinkronisasi</DialogTitle>
            <DialogDescription>
              Review perubahan yang akan dilakukan ke database.
            </DialogDescription>
          </DialogHeader>
          {syncPreview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Sekolah</p>
                  <p className="font-medium">Update: {syncPreview.sekolah.updated}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Rombel</p>
                  <p className="font-medium">
                    Baru: {syncPreview.rombel.created} · Update: {syncPreview.rombel.updated}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Siswa</p>
                  <p className="font-medium">
                    Baru: {syncPreview.siswa.created} · Update: {syncPreview.siswa.updated} · Arsip: {syncPreview.siswa.archived}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">GTK / Guru</p>
                  <p className="font-medium">
                    Baru: {syncPreview.gtk.created} · Update: {syncPreview.gtk.updated} · Arsip: {syncPreview.gtk.archived}
                  </p>
                </div>
              </div>
              {(syncPreview.siswa.archived > 0 || syncPreview.gtk.archived > 0) && (
                <p className="text-xs text-amber-600">
                  Data yang diarsipkan tidak akan muncul di daftar aktif, tapi riwayat kehadiran/pembayarannya tetap aman.
                </p>
              )}
              {(syncPreview.siswa.errors > 0 || syncPreview.gtk.errors > 0) && (
                <p className="text-xs text-destructive">
                  {syncPreview.siswa.errors > 0
                    ? `${syncPreview.siswa.errors} siswa dilewati (rombel tidak ditemukan). `
                    : ""}
                  {syncPreview.gtk.errors > 0
                    ? `${syncPreview.gtk.errors} GTK dilewati (tanpa NUPTK/NIP).`
                    : ""}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Batal</Button>
            <Button onClick={handleSyncCommit} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Lanjutkan Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunci pairing jembatan</DialogTitle>
            <DialogDescription>
              Salin kunci ini ke aplikasi jembatan di PC sekolah. Setelah jendela ditutup,
              kunci tidak ditampilkan lagi (hanya hash yang disimpan di server).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <code className="block break-all rounded-md bg-muted p-3 text-xs">{plainBridgeToken}</code>
            <p className="text-xs text-amber-700">
              Jangan bagikan kunci ini. Cabut dari dashboard jika komputer sekolah berganti atau kunci bocor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyBridgeToken}>
              <Copy className="mr-1 size-3" />
              Salin
            </Button>
            <Button onClick={() => setTokenDialogOpen(false)}>Sudah disalin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, loading, onPull }: {
  title: string; value: string; icon: React.ComponentType<{ className?: string }>; loading: boolean; onPull: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-semibold">{loading ? "..." : value}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onPull} disabled={loading}>
          <Download className="size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "-"}</span>
    </div>
  );
}
