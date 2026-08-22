"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store/app";

export function TwoFactorSettings() {
  const user = useAppStore((s) => s.user);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{
    uri: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Only SUPER_ADMIN can manage 2FA
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Check current 2FA status
  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    // We check by trying to fetch user info from a lightweight endpoint
    // For now, we'll use the settings endpoint or just show the component
    setLoading(false);
  }, [isSuperAdmin]);

  // Generate QR code on canvas using the otpauth URI
  const generateQR = useCallback(async (uri: string) => {
    if (!canvasRef.current) return;
    try {
      const QRCode = await import("qrcode");
      await QRCode.toCanvas(canvasRef.current, uri, {
        width: 200,
        margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" },
      });
    } catch {
      // QR library not installed — fallback to text display
    }
  }, []);

  useEffect(() => {
    if (setupData?.uri) {
      generateQR(setupData.uri);
    }
  }, [setupData, generateQR]);

  async function handleSetup() {
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai setup 2FA");
      setSetupData(data);
      setVerifyToken("");
      setBackupCodesSaved(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memulai setup 2FA");
    }
  }

  async function handleVerify() {
    if (!verifyToken || verifyToken.length !== 6) {
      toast.error("Masukkan kode 6 digit dari aplikasi authenticator.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verifikasi gagal");
      toast.success("2FA berhasil diaktifkan!");
      setIsEnabled(true);
      setSetupData(null);
      setVerifyToken("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verifikasi gagal");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDisable() {
    if (!disablePassword) {
      toast.error("Masukkan password untuk menonaktifkan 2FA.");
      return;
    }
    setDisabling(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menonaktifkan 2FA");
      toast.success("2FA berhasil dinonaktifkan.");
      setIsEnabled(false);
      setShowDisableDialog(false);
      setDisablePassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menonaktifkan 2FA");
    } finally {
      setDisabling(false);
    }
  }

  function copySecret() {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyBackupCodes() {
    if (!setupData?.backupCodes) return;
    navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
    toast.success("Backup codes disalin ke clipboard.");
  }

  if (!isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">Two-Factor Authentication (2FA)</CardTitle>
            <CardDescription>
              Tambahkan lapisan keamanan ekstra dengan authenticator app (Google Authenticator, Authy, dll).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memeriksa status 2FA…
          </div>
        ) : isEnabled ? (
          /* 2FA is enabled */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white">
                <ShieldCheck className="mr-1 size-3" /> Aktif
              </Badge>
              <span className="text-sm text-muted-foreground">
                2FA sudah aktif untuk akun ini.
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDisableDialog(true)}
            >
              <ShieldOff className="size-4" /> Nonaktifkan 2FA
            </Button>
          </div>
        ) : setupData ? (
          /* Setup in progress — show QR code + verification */
          <div className="space-y-6">
            {/* Step 1: QR Code */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Langkah 1: Pindai QR Code
              </h4>
              <p className="text-xs text-muted-foreground">
                Buka aplikasi authenticator (Google Authenticator, Authy, dll.) dan pindai QR code di bawah ini.
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="rounded-lg border bg-white p-3">
                  <canvas ref={canvasRef} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Atau masukkan kode manual:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                      {setupData.secret}
                    </code>
                    <Button variant="ghost" size="icon" className="size-7" onClick={copySecret}>
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Backup Codes */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Langkah 2: Simpan Backup Codes
              </h4>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 text-amber-600" />
                  <div className="space-y-2">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Simpan backup codes ini di tempat yang aman. Kode ini hanya ditampilkan sekali dan dapat digunakan jika Anda kehilangan akses ke aplikasi authenticator.
                    </p>
                    <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                      {setupData.backupCodes.map((code) => (
                        <div key={code} className="rounded bg-white px-2 py-1 dark:bg-amber-900/30">
                          {code}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                      <Copy className="mr-1 size-3" /> Salin Semua
                    </Button>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={backupCodesSaved}
                  onChange={(e) => setBackupCodesSaved(e.target.checked)}
                  className="size-3"
                />
                Saya sudah menyimpan backup codes
              </label>
            </div>

            {/* Step 3: Verify */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Langkah 3: Verifikasi Kode
              </h4>
              <p className="text-xs text-muted-foreground">
                Masukkan kode 6 digit dari aplikasi authenticator Anda.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, ""))}
                  className="w-32 font-mono text-center"
                />
                <Button
                  onClick={handleVerify}
                  disabled={verifying || verifyToken.length !== 6 || !backupCodesSaved}
                >
                  {verifying ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-1 size-4" />
                  )}
                  Aktifkan 2FA
                </Button>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setSetupData(null)}>
              Batal
            </Button>
          </div>
        ) : (
          /* 2FA not enabled — show setup button */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              2FA belum aktif. Aktifkan untuk meningkatkan keamanan akun Super Admin.
            </p>
            <Button onClick={handleSetup} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Shield className="mr-1 size-4" /> Aktifkan 2FA
            </Button>
          </div>
        )}

        {/* Disable Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nonaktifkan 2FA</DialogTitle>
              <DialogDescription>
                Masukkan password Anda untuk menonaktifkan two-factor authentication.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disable-password">Password</Label>
                <Input
                  id="disable-password"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Masukkan password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDisableDialog(false)} disabled={disabling}>
                Batal
              </Button>
              <Button variant="destructive" onClick={handleDisable} disabled={disabling || !disablePassword}>
                {disabling ? <Loader2 className="mr-1 size-4 animate-spin" /> : <ShieldOff className="mr-1 size-4" />}
                Nonaktifkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
