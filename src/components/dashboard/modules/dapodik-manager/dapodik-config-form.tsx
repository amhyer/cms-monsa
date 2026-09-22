"use client";

import { Loader2, Save, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DapodikConfig } from "./types";

export function DapodikConfigForm({
  config,
  onConfigChange,
  hasExistingToken,
  hasExistingCfSecret,
  cfSecretMasked,
  saving,
  testing,
  connected,
  onSave,
  onTestConnection,
}: {
  config: DapodikConfig;
  onConfigChange: React.Dispatch<React.SetStateAction<DapodikConfig>>;
  hasExistingToken: boolean;
  hasExistingCfSecret: boolean;
  cfSecretMasked: string | null;
  saving: boolean;
  testing: boolean;
  connected: boolean | null;
  onSave: () => void;
  onTestConnection: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Konfigurasi Dapodik Web Service</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dapodik-npsn">NPSN</Label>
            <Input id="dapodik-npsn" placeholder="20223001" value={config.npsn} onChange={(e) => onConfigChange((p) => ({ ...p, npsn: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dapodik-host">Host</Label>
            <Input id="dapodik-host" placeholder="localhost" value={config.host} onChange={(e) => onConfigChange((p) => ({ ...p, host: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dapodik-port">Port</Label>
            <Input id="dapodik-port" placeholder="5774" value={config.port} onChange={(e) => onConfigChange((p) => ({ ...p, port: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dapodik-protocol">Protocol</Label>
            <Input id="dapodik-protocol" placeholder="http" value={config.protocol} onChange={(e) => onConfigChange((p) => ({ ...p, protocol: e.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="dapodik-token">Token</Label>
            <Input
              id="dapodik-token"
              type="password"
              placeholder={hasExistingToken ? "Kosongkan jika tidak ingin mengubah token" : "Token autentikasi Dapodik"}
              value={config.token}
              onChange={(e) => onConfigChange((p) => ({ ...p, token: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dapodik-cf-client-id">CF Access Client ID</Label>
            <Input
              id="dapodik-cf-client-id"
              placeholder="Kosongkan jika tidak memakai Cloudflare Access"
              value={config.cfAccessClientId}
              onChange={(e) => onConfigChange((p) => ({ ...p, cfAccessClientId: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Service token Cloudflare Access bila Web Service Dapodik berada di balik CF — opsional.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dapodik-cf-secret">CF Access Client Secret</Label>
            <Input
              id="dapodik-cf-secret"
              type="password"
              placeholder={hasExistingCfSecret ? "Kosongkan jika tidak ingin mengubah secret" : "Secret service token (opsional)"}
              value={config.cfAccessClientSecret}
              onChange={(e) => onConfigChange((p) => ({ ...p, cfAccessClientSecret: e.target.value }))}
            />
            {hasExistingCfSecret && cfSecretMasked && (
              <p className="text-xs text-muted-foreground">
                Secret tersimpan: <span className="font-mono">{cfSecretMasked}</span>
              </p>
            )}
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
              onCheckedChange={(v) => onConfigChange((p) => ({ ...p, archiveUnlisted: v }))}
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
              onCheckedChange={(v) => onConfigChange((p) => ({ ...p, allowInsecureInProduction: v }))}
              aria-label="Izinkan HTTP di production"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSave} disabled={saving || !config.npsn || (!config.token && !hasExistingToken)}>
            {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Save className="mr-1 size-3" />}
            Simpan Konfigurasi
          </Button>
          <Button variant="outline" size="sm" onClick={onTestConnection} disabled={testing}>
            {testing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Wifi className="mr-1 size-3" />}
            Cek Koneksi
          </Button>
          {connected === true && <span className="text-xs text-emerald-600 font-medium">Koneksi berhasil</span>}
          {connected === false && <span className="text-xs text-destructive font-medium">Koneksi gagal</span>}
        </div>
      </CardContent>
    </Card>
  );
}
