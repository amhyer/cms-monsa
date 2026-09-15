// src/lib/redis.ts
import Redis from "ioredis";
import { logger } from "@/lib/logger";

// Ambil URL Redis dari environment variables.
// PENTING di Docker/compose: jangan pernah memakai "localhost" di sini —
// nilai .env DI-INTERPOLASI ke dalam container, di mana localhost adalah
// container itu sendiri (bukan host), sehingga koneksi tidak pernah berhasil
// dan offline queue ioredis membuat request rate-limiter menggantung ~20
// detik lalu gagal. Self-host single-instance: biarkan kosong. Profile
// with-redis: redis://redis:6379 (hostname service compose).
// Detail: docs/DEPLOYMENT_CHECKLIST.md §1.
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
