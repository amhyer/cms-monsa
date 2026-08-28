#!/usr/bin/env bash
# ============================================================
# CMS MONSA — Deploy otomatis ke Vercel + Neon (PostgreSQL)
#
# Script ini menjalankan langkah post-deploy yang TIDAK bisa
# dilakukan Vercel sendiri: migrasi skema + seed ke database
# Neon. Jalankan SETELAH Vercel selesai build & deploy.
#
# Skema: prisma/schema.prisma — SATU skema PostgreSQL untuk semua
# environment (konsolidasi 2026-08-28; dulu schema.postgres.prisma terpisah).
#
# Pemakaian:
#   ./scripts/deploy-vercel.sh                 # migrate + seed
#   ./scripts/deploy-vercel.sh --skip-seed     # migrate saja
#   ./scripts/deploy-vercel.sh --pull-env      # tarik env dari Vercel dulu
#
# Prasyarat:
#   - DATABASE_URL mengarah ke Neon PostgreSQL (koneksi POOLED, untuk
#     runtime) — atau di-set via `vercel env pull` / file .env
#   - DATABASE_URL_DIRECT (opsional) — koneksi DIRECT (non-pooler) ke Neon.
#     Operasi skema (migrate deploy / db push / seed) memakainya bila ada;
#     fallback ke DATABASE_URL bila tidak di-set. Set juga di Vercel env
#     bila ingin `--pull-env` menariknya otomatis.
#   - Prisma CLI tersedia (sudah jadi dependency project)
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Skema tunggal PostgreSQL (prisma/schema.prisma) — tidak perlu flag --schema.
SKIP_SEED=0
PULL_ENV=0

for arg in "$@"; do
    case "$arg" in
        --skip-seed) SKIP_SEED=1 ;;
        --pull-env)  PULL_ENV=1 ;;
        -h|--help)
            echo "Pemakaian: $0 [--skip-seed] [--pull-env]"
            exit 0
            ;;
        *) echo "Argumen tidak dikenal: $arg (lihat --help)" >&2; exit 1 ;;
    esac
done

cd "$ROOT"

# 1) (Opsional) Tarik environment variables dari Vercel project
if [ "$PULL_ENV" = "1" ]; then
    if ! command -v vercel >/dev/null 2>&1; then
        echo "ERROR: CLI 'vercel' tidak ditemukan. Install dulu: npm i -g vercel" >&2
        exit 1
    fi
    echo ">> Menarik env dari Vercel ke .env.local ..."
    vercel env pull .env.local --environment=production
    set -a; source .env.local; set +a
fi

# 2) Pastikan DATABASE_URL tersedia & PostgreSQL
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL tidak di-set." >&2
    echo "  - Set manual:  export DATABASE_URL='postgresql://...'  ATAU" >&2
    echo "  - Pakai flag:  $0 --pull-env" >&2
    exit 1
fi
case "$DATABASE_URL" in
    postgresql://*|postgres://*) ;;
    *)
        echo "ERROR: DATABASE_URL harus PostgreSQL (Neon)." >&2
        echo "  Ditemukan: ${DATABASE_URL%%:*}" >&2
        exit 1
        ;;
esac

echo ">> DATABASE_URL OK (${DATABASE_URL%%:*})"

# 2b) Pilih koneksi untuk operasi skema: DATABASE_URL_DIRECT (direct,
# non-pooler) bila tersedia — pooled connection (DATABASE_URL) tidak ideal
# untuk DDL/migrasi. Fallback ke DATABASE_URL bila tidak di-set.
MIGRATION_URL="${DATABASE_URL_DIRECT:-$DATABASE_URL}"
case "$MIGRATION_URL" in
    postgresql://*|postgres://*) ;;
    *)
        echo "ERROR: DATABASE_URL_DIRECT (fallback: DATABASE_URL) harus PostgreSQL (Neon)." >&2
        echo "  Ditemukan: ${MIGRATION_URL%%:*}" >&2
        exit 1
        ;;
esac
if [ -n "${DATABASE_URL_DIRECT:-}" ]; then
    echo ">> Koneksi skema: DATABASE_URL_DIRECT (direct, non-pooler)"
else
    echo ">> Koneksi skema: DATABASE_URL_DIRECT tidak di-set — fallback ke DATABASE_URL"
fi

# 3) Generate Prisma client dari skema PostgreSQL
echo ">> prisma generate ..."
bunx prisma generate

# 4) Migrasi skema ke Neon (pakai koneksi DIRECT bila tersedia)
echo ">> prisma migrate deploy ..."
DATABASE_URL="$MIGRATION_URL" bunx prisma migrate deploy

# 5) Seed data awal (idempotent — aman dijalankan berulang)
if [ "$SKIP_SEED" = "1" ]; then
    echo ">> Seed dilewati (--skip-seed)."
else
    echo ">> Seed data awal ..."
    DATABASE_URL="$MIGRATION_URL" bunx tsx prisma/seed.ts
fi

echo ""
echo "============================================================"
echo "✅ Deploy database selesai."
echo "   - Migrasi : prisma/schema.prisma (PostgreSQL tunggal)"
echo "   - Seed    : $([ "$SKIP_SEED" = "1" ] && echo 'dilewati' || echo 'dijalankan')"
echo "   - DB      : ${DATABASE_URL%%:*}"
echo "   - Skema   : ${DATABASE_URL_DIRECT:+DATABASE_URL_DIRECT}${DATABASE_URL_DIRECT:-DATABASE_URL (fallback)}"
echo "============================================================"
