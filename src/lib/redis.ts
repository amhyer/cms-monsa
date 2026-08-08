// src/lib/redis.ts
import Redis from "ioredis";

// Ambil URL Redis dari environment variables.
// Pastikan Anda menambahkan REDIS_URL="redis://localhost:6379" ke file .env Anda.
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  // Di lingkungan produksi, koneksi Redis wajib ada.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "REDIS_URL tidak di-set. Rate limiting terdistribusi tidak akan berfungsi."
    );
  }
  // Di development, berikan peringatan tapi jangan hentikan aplikasi.
  // Rate limiting akan kembali ke mode in-memory jika Redis tidak ada.
  console.warn(
    "[REDIS] REDIS_URL tidak ditemukan. Rate limiter akan menggunakan fallback in-memory (tidak cocok untuk produksi)."
  );
}

// Buat instance Redis. Opsi lazyConnect berarti koneksi hanya dibuat saat dibutuhkan.
// Ini mencegah error jika Redis tidak tersedia saat aplikasi pertama kali start di development.
export const redis = redisUrl ? new Redis(redisUrl, { lazyConnect: true }) : null;
