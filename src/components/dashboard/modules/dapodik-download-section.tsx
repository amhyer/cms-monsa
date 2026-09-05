"use client";

import { useState } from "react";
import { Download, Loader2, Monitor, Globe, AlertCircle, CheckCircle2, ExternalLink, Github } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type Platform = "windows" | "macos" | "linux";

const PLATFORMS = [
  {
    id: "windows" as Platform,
    name: "Windows",
    icon: Monitor,
    description: "PC/Laptop Windows",
    extension: ".exe",
  },
  {
    id: "macos" as Platform,
    name: "macOS",
    icon: Monitor,
    description: "MacBook/iMac",
    extension: "",
  },
  {
    id: "linux" as Platform,
    name: "Linux",
    icon: Globe,
    description: "PC/Laptop Linux",
    extension: "",
  },
];

const GITHUB_REPO = "amhyer/cms-monsa";
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

/**
 * Download section untuk aplikasi Jembatan Dapodik
 */
export function DapodikDownloadSection() {
  const [downloading, setDownloading] = useState<Platform | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showReleaseInfo, setShowReleaseInfo] = useState(false);

  const handleDownload = async (platform: Platform) => {
    setDownloading(platform);
    
    try {
      const res = await fetch(`/api/dapodik/download?platform=${platform}`);
      
      if (res.redirected && res.url) {
        // Success - redirected to download URL
        window.open(res.url, "_blank");
        toast.success("Download dimulai dari GitHub!");
        setTimeout(() => setShowInstructions(true), 1500);
      } else if (res.status === 404) {
        // File not in releases - show info
        setShowReleaseInfo(true);
        toast.warning("File belum tersedia di GitHub Releases");
      } else {
        // Other error
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengunduh";
      toast.error(message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Download className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Unduh Aplikasi Jembatan</CardTitle>
              <CardDescription className="text-xs">
                Sinkronisasi data Dapodik ke website sekolah
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            v1.0.0
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Unduh aplikasi jembatan untuk menarik data dari Dapodik. Aplikasi ini dijalankan di PC/laptop 
          yang sama dengan aplikasi Dapodik. Tidak perlu install Node.js atau software tambahan.
        </p>

        {/* Alert - Release belum ada */}
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>File executable belum tersedia</AlertTitle>
          <AlertDescription className="text-xs">
            Administrator perlu upload file executable ke GitHub Releases terlebih dahulu.
            <Button 
              variant="link" 
              className="p-0 h-auto text-xs underline block mt-2" 
              onClick={() => window.open(GITHUB_RELEASES_URL, "_blank")}
            >
              <Github className="size-3 mr-1" />
              Buka GitHub Releases untuk upload
            </Button>
          </AlertDescription>
        </Alert>

        {/* Platform Selection */}
        <div className="grid gap-3 sm:grid-cols-3">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            const isDownloading = downloading === platform.id;
            
            return (
              <Button
                key={platform.id}
                variant="outline"
                className="h-auto flex-col py-4 gap-2"
                onClick={() => handleDownload(platform.id)}
                disabled={downloading !== null}
              >
                {isDownloading ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <Icon className="size-6" />
                )}
                <span className="font-medium">{platform.name}</span>
                <span className="text-xs text-muted-foreground">
                  {platform.description}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs">
          <AlertCircle className="size-4 shrink-0 text-muted-foreground mt-0.5" />
          <p className="text-muted-foreground">
            <strong>Catatan:</strong> Download mengalihkan ke GitHub Releases untuk mengunduh 
            file executable. Pastikan Dapodik terbuka dan Web Service aktif sebelum menjalankan.
          </p>
        </div>

        {/* Release Info Dialog */}
        <Dialog open={showReleaseInfo} onOpenChange={setShowReleaseInfo}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>File Belum Tersedia</DialogTitle>
              <DialogDescription>
                File executable untuk platform yang dipilih belum tersedia di GitHub Releases.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                <h4 className="font-semibold text-sm text-amber-900 mb-2">Langkah untuk Administrator:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-amber-800">
                  <li>Buka <strong>GitHub Releases</strong></li>
                  <li>Klik <strong>Draft a new release</strong></li>
                  <li>Isi tag <code>v1.0.0</code> dan title</li>
                  <li>Drag & drop file executable</li>
                  <li>Klik <strong>Publish release</strong></li>
                </ol>
              </div>
              
              <Button 
                className="w-full" 
                onClick={() => window.open(GITHUB_RELEASES_URL, "_blank")}
              >
                <Github className="size-4 mr-2" />
                Buka GitHub Releases
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Instructions Dialog */}
        <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Cara Menggunakan Jembatan Dapodik</DialogTitle>
              <DialogDescription>
                Ikuti langkah-langkah berikut untuk menghubungkan Dapodik dengan website sekolah
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold">1. Setup di Dapodik</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                  <li>Buka aplikasi Dapodik</li>
                  <li>Login sebagai Admin</li>
                  <li>Klik <strong>Pengaturan</strong> → <strong>Web Service Lokal</strong></li>
                  <li>Klik <strong>Tambah</strong></li>
                  <li>Isi nama: <code>Jembatan-CMS</code>, IP: <code>localhost</code></li>
                  <li>Simpan dan <strong>salin Token</strong></li>
                </ol>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">2. Jalankan Aplikasi Jembatan</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                  <li>Double-click file executable yang sudah diunduh</li>
                  <li>Tunggu sampai browser terbuka otomatis</li>
                  <li>Jika tidak terbuka, buka browser ke <code>http://localhost:3847</code></li>
                </ol>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">3. Sinkronisasi Data</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                  <li>Isi <strong>URL CMS</strong>, <strong>Kunci Pairing</strong>, <strong>NPSN</strong>, dan <strong>Token</strong></li>
                  <li>Klik <strong>Tes Dapodik</strong> untuk memastikan koneksi</li>
                  <li>Klik <strong>Tarik & Kirim</strong></li>
                </ol>
              </div>

              <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-800">
                  <strong>💡 Tips:</strong> Lakukan sinkronisasi secara berkala, terutama saat ada 
                  perubahan data siswa atau guru di Dapodik.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
