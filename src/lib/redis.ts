// src/lib/redis.ts
import Redis from "ioredis";
import { logger } from "@/lib/logger";

// Ambil URL Redis dari environment variables.
// Pastikan Anda menambahkan REDIS_URL="redis://localhost:6379" ke file .env Anda.
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  // REDIS_URL opsional: tanpa Redis, rate limiter memakai fallback in-memory
  // (src/lib/rate-limit.ts) — cocok untuk single-instance self-hosted.
  // Untuk multi-instance/terdistribusi, set REDIS_URL dan jalankan Redis.
  logger.warn(
    "[REDIS] REDIS_URL tidak ditemukan. Rate limiter akan menggunakan fallback in-memory (tidak cocok untuk multi-instance)."
  );
}

// Buat instance Redis. Opsi lazyConnect berarti koneksi hanya dibuat saat dibutuhkan.
// Ini mencegah error jika Redis tidak tersedia saat aplikasi pertama kali start di development.
export const redis = redisUrl ? new Redis(redisUrl, { lazyConnect: true }) : null;
