#!/bin/sh
# =============================================================================
# CMS MONSA — Docker entrypoint
#
# Menjalankan migrasi Prisma (idempotent) SEBELUM server start, sehingga
# `docker compose up -d` pada database kosong langsung menghasilkan aplikasi
# yang siap pakai (klaim "migrasi otomatis oleh container" di
# docs/DEPLOYMENT_CHECKLIST.md kini benar-benar dijalankan di sini).
#
# Kontrol lewat environment variable:
#   RUN_MIGRATIONS (default: true)  — set "false" untuk melewati migrasi
#                                     (mis. multiple instance agar hanya satu
#                                     yang migrate; instance lain set false).
#
# Prisma CLI dipanggil langsung dari node_modules (node node_modules/prisma/
# build/index.js) — bukan `npx prisma` — agar tidak mencoba unduh paket dari
# registry saat runtime (offline-safe).
# =============================================================================
set -e

# ── Peringatan REDIS_URL localhost ──────────────────────────────
# Footgun umum: REDIS_URL dev (redis://localhost:6379) ikut ter-interpolasi
# compose dari .env ke dalam container. Di dalam container, "localhost" adalah
# container ini sendiri — Redis tidak ada di sana, dan offline queue ioredis
# membuat request rate-limiter menggantung ±20 detik lalu gagal (mis. login).
# Kosongkan REDIS_URL di .env (single-instance, fallback in-memory) atau pakai
# hostname service compose redis://redis:6379 (profile with-redis).
# Detail: docs/DEPLOYMENT_CHECKLIST.md §1 Environment Variables.
case "$REDIS_URL" in
  redis://localhost:*|rediss://localhost:*|redis://127.0.0.1:*|rediss://127.0.0.1:*|redis://\[::1\]:*|rediss://\[::1\]:*)
    echo ">> [entrypoint] PERINGATAN: REDIS_URL menunjuk ke localhost — di dalam"
    echo ">> [entrypoint] container, localhost adalah container ini sendiri, bukan"
    echo ">> [entrypoint] host atau service redis compose. Request rate-limiter"
    echo ">> [entrypoint] akan menggantung ~20 detik lalu gagal. Kosongkan"
    echo ">> [entrypoint] REDIS_URL di .env (single-instance) atau pakai"
    echo ">> [entrypoint] redis://redis:6379 (profile with-redis)."
    echo ">> [entrypoint] Detail: docs/DEPLOYMENT_CHECKLIST.md §1."
    ;;
esac

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo ">> [entrypoint] prisma migrate deploy ..."
  node node_modules/prisma/build/index.js migrate deploy
  echo ">> [entrypoint] migrasi selesai."
else
  echo ">> [entrypoint] RUN_MIGRATIONS != true — migrasi dilewati."
fi

echo ">> [entrypoint] menjalankan server ..."
exec node server.js
