#!/usr/bin/env bash
# ============================================
# CMS MONSA - Backup Cron Job Script
# ============================================
# This script is designed to be run by cron or systemd timer.
# It sets up the environment and runs the backup script.
#
# Installation:
#   chmod +x scripts/backup-cron.sh
#   crontab -e
#   Add: 0 2 * * * /path/to/scripts/backup-cron.sh >> /var/log/cms-monsa-backup.log 2>&1
#
# Or with Docker:
#   docker compose exec app /app/scripts/backup-cron.sh
#
set -euo pipefail

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables from .env file
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
elif [ -f "$PROJECT_DIR/.env.production" ]; then
    set -a
    source "$PROJECT_DIR/.env.production"
    set +a
fi

# Ensure DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set"
    exit 1
fi

# ============================================
# Logging
# ============================================
LOG_FILE="${LOG_FILE:-/var/log/cms-monsa-backup.log}"
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ============================================
# Run Backup
# ============================================
log "Starting backup..."

# Run the main backup script
bash "$SCRIPT_DIR/backup-db.sh"

# Exit with appropriate status
if [ $? -eq 0 ]; then
    log "Backup completed successfully"
else
    log "ERROR: Backup failed with exit code $?"
    exit 1
fi
