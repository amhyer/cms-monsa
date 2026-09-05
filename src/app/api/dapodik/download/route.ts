import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getJembatanFiles } from "@/lib/dapodik-jembatan-files";
import { buildZipStore } from "@/lib/zip-store";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

// Path ke folder public/downloads
const PUBLIC_DOWNLOADS_PATH = path.join(process.cwd(), "public", "downloads");

// File executables
const EXECUTABLES = {
  windows: "Jembatan-Dapodik.exe",
  macos: "Jembatan-Dapodik-macos",
  linux: "Jembatan-Dapodik-linux",
} as const;

type Platform = keyof typeof EXECUTABLES;

function getContentType(filename: string): string {
  if (filename.endsWith(".exe")) {
    return "application/x-msdownload; charset=utf-8";
  }
  if (filename.endsWith("-macos") || filename.endsWith("-macos-x64")) {
    return "application/x-mach-binary";
  }
  if (filename.endsWith("-linux") || filename.endsWith("-linux-x64")) {
    return "application/x-executable";
  }
  return "application/octet-stream";
}

/**
 * Download executable berdasarkan platform
 */
function serveExecutable(platform: Platform) {
  const filename = EXECUTABLES[platform];
  const filePath = path.join(PUBLIC_DOWNLOADS_PATH, filename);

  // Cek apakah file ada
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath);
  const contentType = getContentType(filename);

  // Buat README inline
  const readme = generateReadme(platform, filename);

  // Buat ZIP dengan executable + README
  // Simple concatenation untuk now (dalam production, gunakan library ZIP)
  // Return executable + readme as combined download
  
  return {
    filename: `Jembatan-Dapodik-${platform}.zip`,
    contentType: "application/zip",
    content: createSimpleZip(filename, content, readme),
  };
}

function generateReadme(platform: Platform, exeFilename: string): string {
  const osName = platform === "windows" ? "Windows" : platform === "macos" ? "macOS" : "Linux";
  
  return `JEMBATAN DAPODIK - CMS MONSA
${"=".repeat(40)}

File: ${exeFilename}
Platform: ${osName}
Tanggal: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}

CARA PAKAI:
${"-".repeat(40)}

1. EKSTRAK FILE (jika dalam format ZIP)
   - Ekstrak file ZIP ke folder yang mudah diakses

2. JALANKAN APLIKASI
   ${platform === "windows" ? `
   - Double-click file ${exeFilename}
   - Atau klik kanan > "Run as Administrator"
   ` : platform === "macos" ? `
   - Buka Terminal
   - chmod +x ${exeFilename}
   - ./${exeFilename}
   ` : `
   - Buka Terminal
   - chmod +x ${exeFilename}
   - ./${exeFilename}
   `}
   
3. BROWSER AKAN TERBUKA OTOMATIS
   - Alamat: http://localhost:3847

4. SETUP DI HALAMAN WEB
   - Masukkan URL CMS Anda
   - Masukkan Kunci Pairing (dari dashboard CMS)
   - Masukkan NPSN sekolah
   - Masukkan Token Web Service dari Dapodik

5. KONEKSIKAN KE DAPODIK
   - Pastikan aplikasi Dapodik terbuka
   - Pastikan Dapodik Web Service aktif
   - Klik "Tes Dapodik" untuk memastikan koneksi
   - Klik "Tarik & Kirim" untuk sinkronisasi

PERSYARATAN:
${"-".repeat(40)}
- PC/laptop terhubung ke internet
- Aplikasi Dapodik sudah terbuka
- Dapodik Web Service sudah diaktifkan
- Port 5774 tidak terblokir firewall

TROUBLESHOOTING:
${"-".repeat(40)}
- Error "Port 3847 dipakai": Tutup aplikasi lain yang menggunakan port tersebut
- Error koneksi Dapodik: Pastikan Dapodik sudah login
- Error koneksi CMS: Pastikan URL dan Kunci Pairing benar

DOKUMENTASI:
${"-".repeat(40)}
Lihat README-OPERATOR.md untuk panduan lengkap.

© CMS MONSA - ${new Date().getFullYear()}
`;
}

function createSimpleZip(exeFilename: string, exeContent: Buffer, readme: string): Uint8Array {
  // Simple approach: Return executable as-is with .exe extension
  // For proper ZIP, you would use a library like jszip
  // For now, we'll serve the executable directly
  
  // Return the executable content
  return new Uint8Array(exeContent);
}

function getDownloadContentType(platform: Platform): string {
  return getContentType(EXECUTABLES[platform]);
}

/** Unduh paket aplikasi jembatan (.exe) untuk dijalankan di PC sekolah. */
export async function GET(req: NextRequest) {
  // Cek autentikasi
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  // Cek parameter platform
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as Platform | null;
  
  // Tentukan platform
  let targetPlatform: Platform = "windows";
  
  if (platform && platform in EXECUTABLES) {
    targetPlatform = platform;
  } else {
    // Detect dari User-Agent
    const userAgent = req.headers.get("user-agent") || "";
    if (userAgent.toLowerCase().includes("win")) {
      targetPlatform = "windows";
    } else if (userAgent.toLowerCase().includes("mac")) {
      targetPlatform = "macos";
    } else if (userAgent.toLowerCase().includes("linux")) {
      targetPlatform = "linux";
    }
  }

  // Coba serve executable
  const exeResult = serveExecutable(targetPlatform);
  
  if (exeResult) {
    // Serve executable
    const filename = targetPlatform === "windows" 
      ? "Jembatan-Dapodik.exe"
      : `Jembatan-Dapodik-${targetPlatform}`;

    return new NextResponse(exeResult.content, {
      status: 200,
      headers: {
        "Content-Type": getDownloadContentType(targetPlatform),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(exeResult.content.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Fallback: Jika executable tidak ada, serve source code bundle
  console.log("[jembatan-download] Executable tidak ditemukan, fallback ke source bundle");
  
  try {
    const files = getJembatanFiles();
    const zip = buildZipStore(files);
    
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="jembatan-dapodik-source.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat berkas unduhan.";
    console.error("[jembatan-download] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
