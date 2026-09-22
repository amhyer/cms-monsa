"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Loader2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DapodikDownloadSection } from "../dapodik-download-section";
import { DapodikConfigForm } from "./dapodik-config-form";
import { DapodikBridgeKeyCard, DapodikBridgeTokenDialog } from "./dapodik-bridge-key-section";
import { DapodikSyncDialog } from "./dapodik-sync-dialog";
import { DapodikSummaryCards } from "./dapodik-summary-cards";
import { DapodikDataTabs } from "./dapodik-data-tabs";
import { STEPS, readJson } from "./types";
import type { DapodikData, DapodikConfig, SyncPreview, StepStatus } from "./types";

export function DapodikManager() {
  const [config, setConfig] = useState<DapodikConfig>({ npsn: "", token: "", host: "localhost", port: "5774", protocol: "http", archiveUnlisted: true, allowInsecureInProduction: false, cfAccessClientId: "", cfAccessClientSecret: "" });
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [hasExistingCfSecret, setHasExistingCfSecret] = useState(false);
  const [cfSecretMasked, setCfSecretMasked] = useState<string | null>(null);
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
            cfAccessClientId: json.config.cfAccessClientId || "",
            cfAccessClientSecret: "",
          });
          setHasExistingToken(Boolean(json.config.hasToken ?? json.config.token));
          setHasExistingCfSecret(Boolean(json.config.cfAccessClientSecret));
          setCfSecretMasked(json.config.cfAccessClientSecret || null);
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
          cfAccessClientId: config.cfAccessClientId,
          // Secret hanya dikirim bila diisi — kosong = pertahankan secret
          // tersimpan (backend mem-fallback ke nilai DB, tidak ter-wipe).
          ...(config.cfAccessClientSecret
            ? { cfAccessClientSecret: config.cfAccessClientSecret }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Konfigurasi tersimpan!");
      if (config.token) setHasExistingToken(true);
      // Secret write-only: bila user mengisi field, secret tersimpan berubah —
      // kosongkan field dan tampilkan hint mask baru tanpa menunggu reload.
      // Bila field dikosongkan (tidak dikirim), secret DB dipertahankan dan
      // hint mask lama tetap valid.
      if (config.cfAccessClientSecret) {
        setConfig((p) => ({ ...p, cfAccessClientSecret: "" }));
        setHasExistingCfSecret(true);
        setCfSecretMasked("****");
      }
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

  const generateBridgeKey = useCallback(async () => {
    if (hasBridgeToken && !window.confirm("Kunci lama akan langsung tidak berlaku. Lanjutkan?")) {
      return;
    }
    setGeneratingKey(true);
    try {
      const res = await fetch("/api/dapodik/bridge", { method: "POST" });
      const json = await readJson(res);
      if (!res.ok) throw new Error((json.error as string) || `HTTP ${res.status}`);
      setPlainBridgeToken((json.token as string) || null);
      setHasBridgeToken(true);
      setBridgePrefix((json.prefix as string) || null);
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
      const json = await readJson(res);
      if (!res.ok) throw new Error((json.error as string) || `HTTP ${res.status}`);
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

      <DapodikDownloadSection />

      <DapodikBridgeKeyCard
        hasBridgeToken={hasBridgeToken}
        bridgePrefix={bridgePrefix}
        bridgeCreatedAt={bridgeCreatedAt}
        generatingKey={generatingKey}
        revokingKey={revokingKey}
        onGenerate={generateBridgeKey}
        onRevoke={revokeBridgeKey}
      />

      {showConfig && (
        <DapodikConfigForm
          config={config}
          onConfigChange={setConfig}
          hasExistingToken={hasExistingToken}
          hasExistingCfSecret={hasExistingCfSecret}
          cfSecretMasked={cfSecretMasked}
          saving={saving}
          testing={testing}
          connected={connected}
          onSave={saveConfig}
          onTestConnection={testConnection}
        />
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

      <DapodikSummaryCards data={data} loading={loading} onFetch={fetchData} />

      <DapodikDataTabs data={data} loading={loading} onFetch={fetchData} />

      <DapodikSyncDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        syncPreview={syncPreview}
        syncing={syncing}
        onCommit={handleSyncCommit}
      />

      <DapodikBridgeTokenDialog
        open={tokenDialogOpen}
        onOpenChange={setTokenDialogOpen}
        plainBridgeToken={plainBridgeToken}
        onCopy={copyBridgeToken}
      />
    </div>
  );
}
