#!/usr/bin/env bash
# CMS MONSA - Backup Database & Uploads (Linux)
# Pasang di crontab (tiap hari 02.00):
#   0 2 * * * cd /srv/cms-monsa && ./scripts/backup-db.sh >/dev/null 2>&1
# Menyimpan 14 backup terakhir (rotasi otomatis).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT/backups"
RETENTION=14
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# 1) PostgreSQL (produksi)
DB_URL="${DATABASE_URL:-}"
if [[ "$DB_URL" == postgresql://* || "$DB_URL" == postgres://* ]]; then
    DB_USER="$(echo "$DB_URL" | sed -E 's#^[^:]+://([^:]+):.*#\1#')"
    DB_PASS="$(echo "$DB_URL" | sed -E 's#^[^:]+://[^:]+:([^@]+)@.*#\1#')"
    DB_HOST="$(echo "$DB_URL" | sed -E 's#^[^:]+://[^@]+@([^:/]+).*#\1#')"
    DB_PORT="$(echo "$DB_URL" | sed -E 's#^[^:]+://[^@]+@[^:]+:([0-9]+)/.*#\1#')"
    DB_NAME="$(echo "$DB_URL" | sed -E 's#^[^:]+://[^@]+@[^/]+/([^?]+).*#\1#')"
    DB_PORT="${DB_PORT:-5432}"
    PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -F c -f "$BACKUP_DIR/db-$STAMP.sql"
    echo "Backup PostgreSQL -> $BACKUP_DIR/db-$STAMP.sql"
elif [[ "$DB_URL" == file:* || -f "$ROOT/prisma/db/custom.db" ]]; then
    DB_FILE="$ROOT/prisma/db/custom.db"
    [ -f "$DB_FILE" ] || DB_FILE="$ROOT/db/custom.db"
    cp "$DB_FILE" "$BACKUP_DIR/db-$STAMP.db"
    echo "Backup SQLite -> $BACKUP_DIR/db-$STAMP.db"
else
    echo "WARNING: DATABASE_URL tidak dikenali, lewati backup database" >&2
fi

# 2) Uploads
if [ -d "$ROOT/public/uploads" ]; then
    tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$ROOT/public" uploads
    echo "Backup uploads -> $BACKUP_DIR/uploads-$STAMP.tar.gz"
fi

# 3) Rotasi: pertahankan $RETENTION backup terakhir per jenis
for kind in db uploads; do
    ls -1t "$BACKUP_DIR"/"$kind"-*.{db,sql,tar.gz} 2>/dev/null | tail -n +$((RETENTION + 1)) | while read -r f; do
        rm -f "$f"
    done || true
done

echo "Backup selesai: $BACKUP_DIR"
