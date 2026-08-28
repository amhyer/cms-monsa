/**
 * Abstraksi penyimpanan file upload — disk vs database.
 *
 * Latar belakang (audit deployment 2026-08-28, temuan K4/K5):
 * Route upload sebelumnya menulis file ke `public/uploads` di filesystem
 * lokal. Pola itu benar untuk self-host (Docker/VM) tetapi RUSAK di platform
 * serverless seperti Vercel: filesystem bersifat ephemeral dan `public/`
 * hanya berisi aset hasil build — file yang diunggah hilang seketika/404.
 *
 * Backend aktif dipilih otomatis (bisa dioverride lewat env):
 *   - UPLOAD_STORAGE="disk" | "db"
 *   - Default: "db" saat VERCEL=1, selain itu "disk".
 *
 * URL publik SAMA untuk kedua backend — `/uploads/<filename>`:
 *   - disk → diserve sebagai static file oleh Next (behavior lama).
 *   - db   → diserve oleh route handler src/app/uploads/[...path]/route.ts
 *     yang membaca tabel UploadedFile.
 * Filename dibuat unik (timestamp-random) oleh route upload sehingga aman
 * di-cache immutable.
 */
import { mkdir, writeFile, readFile, unlink, access } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type UploadStorageBackend = "disk" | "db";

/** Direktori upload di disk (backend "disk"). */
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

/** Backend penyimpanan aktif. */
export function uploadStorage(): UploadStorageBackend {
  const env = (process.env.UPLOAD_STORAGE ?? "").toLowerCase();
  if (env === "db" || env === "disk") return env;
  // Vercel: filesystem ephemeral → simpan di database (Neon).
  // Self-host (Docker/VM): disk di volume uploads-data.
  return process.env.VERCEL === "1" ? "db" : "disk";
}

/**
 * Batas ukuran upload (MB) yang sadar-platform.
 *
 * Vercel membatasi request body Serverless Function di 4.5 MB pada LEVEL
 * PLATFORM (tidak bisa dinaikkan lewat config mana pun). Default di sana
 * diambil 4 MB agar file terlalu besar ditolak oleh route dengan pesan 400
 * yang jelas — bukan 413 FUNCTION_PAYLOAD_TOO_LARGE dari platform. Self-host
 * memakai `defaultMb` (5 MB gambar / 15 MB PDF) karena proxyClientMaxBodySize
 * sudah diset 25mb di next.config.ts.
 *
 * Override manual: env MAX_UPLOAD_MB (berlaku untuk semua jenis upload).
 */
export function maxUploadMb(defaultMb: number): number {
  const env = Number(process.env.MAX_UPLOAD_MB);
  if (Number.isFinite(env) && env > 0) return env;
  return process.env.VERCEL === "1" ? 4 : defaultMb;
}

/** Ekstensi yang boleh disimpan/diserve (sesuai validasi route upload). */
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "pdf"]);

/**
 * Validasi nama file upload sebelum menyentuh disk/DB — menolak path
 * traversal (`..`), separator, dan ekstensi di luar whitelist. Nama file
 * selalu dibuat oleh route upload (timestamp-random + ekstensi dari deteksi
 * magic bytes), bukan dari input pengguna.
 */
export function isSafeUploadFilename(filename: string): boolean {
  if (!filename || filename.length > 128 || filename.includes("/")) return false;
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  return ALLOWED_EXT.has(ext);
}

export type SavedUpload = {
  /** URL publik — sama untuk kedua backend. */
  url: string;
  filename: string;
  size: number;
};

/**
 * Simpan file upload ke backend aktif.
 * `mimeType` HARUS hasil deteksi server (magic bytes), bukan input klien.
 */
export async function saveUpload(
  bytes: Uint8Array,
  filename: string,
  mimeType: string
): Promise<SavedUpload> {
  if (!isSafeUploadFilename(filename)) {
    throw new Error(`Nama file upload tidak valid: ${filename}`);
  }
  const size = bytes.byteLength;

  if (uploadStorage() === "db") {
    await db.uploadedFile.create({
      data: {
        filename,
        mimeType,
        size,
        data: Buffer.from(bytes),
      },
    });
  } else {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), Buffer.from(bytes));
  }
  return { url: `/uploads/${filename}`, filename, size };
}

export type LoadedUpload = {
  data: Buffer;
  mimeType: string;
  size: number;
  /** ETag sederhana (filename + size) untuk conditional caching. */
  etag: string;
};

/**
 * Muat file upload: cek disk dulu (self-host), lalu tabel UploadedFile
 * (fallback — mencakup file yang dibuat saat/backend db). Mengembalikan
 * null bila tidak ada di mana pun.
 */
export async function loadUpload(
  filename: string
): Promise<LoadedUpload | null> {
  if (!isSafeUploadFilename(filename)) return null;

  // 1) Disk (self-host: static file biasanya sudah diserve Next; pembacaan
  //    di sini adalah fallback bila file ada tapi tidak terserve static).
  try {
    const diskPath = join(UPLOAD_DIR, filename);
    await access(diskPath);
    const data = await readFile(diskPath);
    const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
    const mimeType =
      ext === "pdf"
        ? "application/pdf"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "png"
            ? "image/png"
            : ext === "gif"
              ? "image/gif"
              : "image/webp";
    return { data, mimeType, size: data.byteLength, etag: `"${filename}-${data.byteLength}"` };
  } catch {
    // Tidak ada di disk — lanjut ke DB.
  }

  // 2) Database (backend db / Vercel).
  try {
    const row = await db.uploadedFile.findUnique({ where: { filename } });
    if (!row) return null;
    return {
      data: Buffer.from(row.data),
      mimeType: row.mimeType,
      size: row.size,
      etag: `"${row.id}-${row.size}"`,
    };
  } catch (e) {
    logger.error({ err: e, filename }, "[file-storage] loadUpload db gagal");
    return null;
  }
}

/**
 * Hapus file upload dari backend aktif (kedua-duanya dicoba secara best
 * effort — file bisa saja berpindah backend). Idempotent.
 */
export async function deleteUpload(filename: string): Promise<void> {
  if (!isSafeUploadFilename(filename)) return;
  try {
    await unlink(join(UPLOAD_DIR, filename));
  } catch {
    // Tidak ada di disk — abaikan.
  }
  try {
    await db.uploadedFile.deleteMany({ where: { filename } });
  } catch (e) {
    logger.error({ err: e, filename }, "[file-storage] deleteUpload db gagal");
  }
}
