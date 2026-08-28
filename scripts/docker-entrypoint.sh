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

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo ">> [entrypoint] prisma migrate deploy ..."
  node node_modules/prisma/build/index.js migrate deploy
  echo ">> [entrypoint] migrasi selesai."
else
  echo ">> [entrypoint] RUN_MIGRATIONS != true — migrasi dilewati."
fi

echo ">> [entrypoint] menjalankan server ..."
exec node server.js
