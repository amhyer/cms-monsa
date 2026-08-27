import { NextRequest, NextResponse } from "next/server";
import { loadUpload, isSafeUploadFilename } from "@/lib/file-storage";

/**
 * Serve file upload dari URL publik /uploads/<filename>.
 *
 * Mengapa route ini ada (audit deployment 2026-08-28, temuan K4/K5):
 * - Self-host (backend "disk"): Next sudah menyerve public/uploads sebagai
 *   static file — route ini tidak pernah terpanggil untuk file yang ada di
 *   disk (static menang) dan hanya menjadi fallback.
 * - Vercel (backend "db"): tidak ada file di disk — request jatuh ke route
 *   ini dan file dibaca dari tabel UploadedFile (Neon). Tanpa route ini,
 *   semua gambar berita/galeri dan PDF transparansi BOS akan 404 di Vercel.
 *
 * Caching: filename dibuat unik oleh route upload (timestamp-random) dan
 * isinya tidak pernah berubah → aman untuk cache immutable setahun.
 * Content-Type diambil dari metadata tersimpan (hasil deteksi magic bytes
 * saat upload), bukan dari ekstensi/permintaan klien.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filename = path.join("/");

  if (!isSafeUploadFilename(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await loadUpload(filename);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: file.etag,
      // Inline untuk gambar/PDF yang tervalidasi; nama file asli tidak
      // diteruskan (tidak pernah dipakai untuk menyimpan file).
      "Content-Disposition": "inline",
    },
  });
}
