"use client";

import { useState } from "react";
import { Download, Loader2, Monitor, Globe, AlertCircle, CheckCircle2, FolderOpen, FileCode } from "lucide-react";
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
  DialogTrigger,
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
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    id: "macos" as Platform,
    name: "macOS",
    icon: Monitor,
    description: "MacBook/iMac",
    extension: "",
    color: "bg-gray-600 hover:bg-gray-700",
  },
  {
    id: "linux" as Platform,
    name: "Linux",
    icon: Globe,
    description: "PC/Laptop Linux",
    extension: "",
    color: "bg-orange-500 hover:bg-orange-600",
  },
];

/**
 * Download section untuk aplikasi Jembatan Dapodik
 * Menampilkan opsi download berdasarkan platform
 */
export function DapodikDownloadSection() {
  const [downloading, setDownloading] = useState<Platform | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [downloadType, setDownloadType] = useState<"exe" | "source" | null>(null);

  const handleDownload = async (platform: Platform) => {
    setDownloading(platform);
    setDownloadType("exe");
    try {
      const res = await fetch(`/api/dapodik/download?platform=${platform}`);
      
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const blob = await blobFromResponse(res);
      const contentDisposition = res.headers.get("Content-Disposition");
      const filename = extractFilename(contentDisposition, platform, downloadType);
      
      downloadBlob(blob, filename);
      toast.success("Download dimulai! Simpan file di tempat yang mudah diakses.");
      
      // Tampilkan instruksi setelah download
      setTimeout(() => setShowInstructions(true), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh");
    } finally {
      setDownloading(null);
      setDownloadType(null);
    }
  };

  // Detect if download is executable or source bundle
  const checkDownloadType = async (platform: Platform) => {
    try {
      const res = await fetch(`/api/dapodik/download?platform=${platform}`, { method: "HEAD" });
      const contentType = res.headers.get("Content-Type") || "";
      
      if (contentType.includes("zip") || contentType.includes("octet-stream")) {
        return "source";
      }
      return "exe";
    } catch {
      return "unknown";
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
                Untuk sinkronisasi data Dapodik ke database
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

        {/* Alert untuk file tidak ditemukan */}
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>File executable belum tersedia</AlertTitle>
          <AlertDescription className="text-xs">
            Untuk mengunduh aplikasi executable (.exe), administrator perlu:
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Copy file <code>Jembatan-Dapodik.exe</code> ke folder <code>public/downloads/</code></li>
              <li>Redeploy aplikasi ke Vercel</li>
            </ol>
            Sementara ini, download source code untuk dijalankan manual dengan Node.js.
          </AlertDescription>
        </Alert>

        {/* Platform Selection */}
        <div className="grid gap-3 sm:grid-cols-3">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            const isDownloading = downloading === platform.id;
            
            return (
              <div key={platform.id} className="space-y-2">
                <Button
                  variant="outline"
                  className="h-auto flex-col py-4 gap-2 w-full"
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
                <p className="text-xs text-center text-muted-foreground">
                  <FileCode className="size-3 inline mr-1" />
                  Source code bundle
                </p>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs">
          <AlertCircle className="size-4 shrink-0 text-muted-foreground mt-0.5" />
          <p className="text-muted-foreground">
            <strong>Catatan:</strong> Download saat ini adalah source code. 
            Untuk aplikasi siap-pakai (.exe), lihat instruksi di atas atau hubungi administrator.
          </p>
        </div>

        {/* Instructions Dialog */}
        <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              <CheckCircle2 className="mr-1 size-3" />
              Lihat instruksi penggunaan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Cara Menggunakan Jembatan Dapodik</DialogTitle>
              <DialogDescription>
                {downloadType === "exe" 
                  ? "Aplikasi executable berhasil diunduh. Ikuti langkah-langkah berikut:"
                  : "Source code berhasil diunduh. Berikut cara menjalankannya:"}
              </DialogDescription>
            </DialogHeader>
            
            {downloadType === "exe" ? (
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
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold">1. Install Node.js</h4>
                  <p className="text-muted-foreground">
                    Pastikan Node.js 18+ sudah terinstall. Download dari <a href="https://nodejs.org" target="_blank" className="text-primary underline">nodejs.org</a>
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">2. Ekstrak dan Jalankan</h4>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
                    <li>Ekstrak file ZIP yang sudah diunduh</li>
                    <li>Buka Terminal/Command Prompt di folder hasil ekstrak</li>
                    <li>Jalankan: <code>node jembatan.mjs</code></li>
                    <li>Buka browser ke <code>http://localhost:3847</code></li>
                  </ol>
                </div>

                <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-800">
                    <strong>💡 Tips:</strong> Hubungi administrator untuk mendapatkan aplikasi .exe yang lebih mudah dijalankan tanpa perlu install Node.js.
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Helper functions
function blobFromResponse(res: Response): Promise<Blob> {
  return res.blob();
}

function extractFilename(contentDisposition: string | null, platform: Platform, type: "exe" | "source" | null): string {
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match) {
      return match[1].replace(/['"]/g, "");
    }
  }
  
  // Default filenames
  if (type === "exe") {
    switch (platform) {
      case "windows":
        return "Jembatan-Dapodik.exe";
      case "macos":
        return "Jembatan-Dapodik-macos";
      case "linux":
        return "Jembatan-Dapodik-linux";
    }
  }
  
  // Fallback to source bundle
  return "jembatan-dapodik-source.zip";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
