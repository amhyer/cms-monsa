#!/usr/bin/env bash
# ============================================================
# CMS MONSA — Batch set environment variables ke Vercel
#
# Script ini membaca .env.production dan meng-apply semua
# variabel ke Vercel (Production + Preview) sekaligus.
#
# Prasyarat:
#   - Vercel CLI terinstall: npm i -g vercel
#   - Sudah login: npx vercel login
#   - Sudah link project: npx vercel link
#
# Usage:
#   bash scripts/vercel-env-setup.sh                    # dari .env.production
#   bash scripts/vercel-env-setup.sh --from-file .env   # dari file spesifik
#   bash scripts/vercel-env-setup.sh --dry-run           # hanya tampilkan
#   bash scripts/vercel-env-setup.sh --production-only   # skip Preview env
#   bash scripts/vercel-env-setup.sh --interactive       # input manual per variabel
#
# Catatan:
#   - Variabel kosong ("") tidak di-skip — tetap di-set ke ""
#     agar Vercel punya placeholder jika nanti diisi.
#   - AUTH_SECRET di-generate otomatis jika belum ada.
# ============================================================
set -euo pipefail

# ── Argumen ──────────────────────────────────────────────────
DRY_RUN=0
PRODUCTION_ONLY=0
INTERACTIVE=0
ENV_FILE=".env.production"
ENVIRONMENTS=("production" "preview")

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)         DRY_RUN=1; shift ;;
        --production-only) PRODUCTION_ONLY=1; ENVIRONMENTS=("production"); shift ;;
        --interactive)     INTERACTIVE=1; shift ;;
        --from-file)       ENV_FILE="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [--production-only] [--interactive] [--from-file FILE]"
            echo ""
            echo "Options:"
            echo "  --dry-run           Tampilkan yang akan dilakukan tanpa mengubah apa pun"
            echo "  --production-only   Hanya set env untuk Production (skip Preview)"
            echo "  --interactive       Input nilai secara manual per variabel"
            echo "  --from-file FILE    Baca env vars dari file (default: .env.production)"
            exit 0
            ;;
        *) echo "Argumen tidak dikenal: $1 (lihat --help)" >&2; exit 1 ;;
    esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Warna ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*" >&2; }
info()  { echo -e "${CYAN}[→]${NC} $*"; }

# ── Pre-flight checks ───────────────────────────────────────
echo ""
echo "============================================="
echo "  CMS MONSA — Vercel Environment Setup"
echo "============================================="
echo ""

# 1. Check Vercel CLI
if ! command -v npx >/dev/null 2>&1; then
    error "npx tidak ditemukan. Install Node.js terlebih dahulu."
    exit 1
fi

# 2. Check login
info "Memeriksa autentikasi Vercel..."
if ! npx vercel whoami >/dev/null 2>&1; then
    error "Vercel CLI belum login. Jalankan: npx vercel login"
    exit 1
fi
VERCEL_USER=$(npx vercel whoami 2>/dev/null || echo "unknown")
log "Logged in sebagai: $VERCEL_USER"

# 3. Check project link
if [[ ! -f .vercel/project.json ]]; then
    error "Project belum di-link ke Vercel. Jalankan: npx vercel link"
    exit 1
fi
PROJECT_NAME=$(grep -o '"projectName":"[^"]*"' .vercel/project.json | cut -d'"' -f4)
log "Project: $PROJECT_NAME"

# ── Baca env vars ───────────────────────────────────────────
echo ""

# Daftar variabel yang dikelompokkan
declare -A ENV_VALUES
declare -A ENV_COMMENTS

# Helper: baca nilai dari .env file
read_env_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        error "File $file tidak ditemukan."
        exit 1
    fi
    
    # Parse .env file — handle comments, quotes, inline comments
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        
        # Extract key=value (handle quotes)
        if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*) ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"
            
            # Remove surrounding quotes
            val="${val#\"}"
            val="${val%\"}"
            val="${val#\'}"
            val="${val%\'}"
            
            # Remove inline comments (only if value doesn't contain spaces before #)
            # val="${val%%#*}"  # disabled — too aggressive
            
            ENV_VALUES["$key"]="$val"
        fi
    done < "$file"
}

if [[ "$INTERACTIVE" -eq 1 ]]; then
    info "Mode interaktif — input nilai per variabel."
    echo ""
    
    # Definisi variabel dengan deskripsi
    declare -A VAR_DESC=(
        ["DATABASE_URL"]="PostgreSQL connection string (Neon/supabase)"
        ["DATABASE_URL_DIRECT"]="Direct connection string (untuk migrasi)"
        ["AUTH_SECRET"]="Secret untuk session (64 hex chars)"
        ["NEXT_PUBLIC_SITE_URL"]="URL publik situs"
        ["APP_DEBUG"]="Debug mode (false untuk production)"
        ["SMTP_HOST"]="SMTP server host"
        ["SMTP_PORT"]="SMTP server port"
        ["SMTP_USER"]="Email pengirim"
        ["SMTP_PASS"]="App password email"
        ["SMTP_FROM"]="Format pengirim"
        ["ADMIN_EMAIL"]="Email admin notifikasi"
        ["FONNTE_TOKEN"]="Fonnte WhatsApp API token"
        ["ADMIN_PHONE"]="Nomor HP admin (628xxx)"
        ["TELEGRAM_BOT_TOKEN"]="Telegram bot token"
        ["TELEGRAM_CHAT_ID"]="Telegram chat/group ID"
        ["NEXT_PUBLIC_SENTRY_DSN"]="Sentry DSN (client)"
        ["SENTRY_DSN"]="Sentry DSN (server)"
        ["SENTRY_AUTH_TOKEN"]="Sentry auth token"
        ["LOKI_URL"]="Loki URL untuk log aggregation"
        ["SITE_DOMAIN"]="Domain situs"
        ["ALLOWED_ORIGINS"]="CORS allowed origins"
        ["CRON_SECRET"]="Secret untuk Vercel Cron"
        ["NEON_API_KEY"]="Neon API key"
        ["NEON_PROJECT_ID"]="Neon project ID"
        ["SEED_ADMIN_PASSWORD"]="Password admin seed"
        ["SEED_OPERATOR_PASSWORD"]="Password operator seed"
        ["SEED_GURU_PASSWORD"]="Password guru seed"
        ["SEED_ORTU_PASSWORD"]="Password ortu seed"
        ["SEED_SISWA_PASSWORD"]="Password siswa seed"
    )
    
    # Generate AUTH_SECRET jika tidak ada
    AUTH_SECRET_DEFAULT=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "")
    
    for key in $(echo "${!VAR_DESC[@]}" | tr ' ' '\n' | sort); do
        desc="${VAR_DESC[$key]}"
        default=""
        
        # Default values
        case "$key" in
            APP_DEBUG) default="false" ;;
            SMTP_HOST) default="smtp.gmail.com" ;;
            SMTP_PORT) default="587" ;;
            SMTP_FROM) default="CMS MONSA <noreply@sdn-mongisidi1.sch.id>" ;;
            ADMIN_EMAIL) default="admin@sdn-mongisidi1.sch.id" ;;
            NEXT_PUBLIC_SITE_URL) default="https://sdn-mongisidi1.sch.id" ;;
            SITE_DOMAIN) default="sdn-mongisidi1.sch.id" ;;
            AUTH_SECRET) default="$AUTH_SECRET_DEFAULT" ;;
        esac
        
        if [[ -n "$default" ]]; then
            read -rp "  $key ($desc) [$default]: " val
            ENV_VALUES["$key"]="${val:-$default}"
        else
            read -rp "  $key ($desc): " val
            ENV_VALUES["$key"]="$val"
        fi
    done
else
    # Batch mode: baca dari file
    if [[ ! -f "$ENV_FILE" ]]; then
        error "File $ENV_FILE tidak ditemukan."
        error "Gunakan --from-file <path> atau buat .env.production terlebih dahulu."
        exit 1
    fi
    
    info "Membaca env vars dari $ENV_FILE ..."
    read_env_file "$ENV_FILE"
    
    # Auto-generate AUTH_SECRET jika placeholder
    if [[ "${ENV_VALUES[AUTH_SECRET]:-}" == "your-random-secret-here" || -z "${ENV_VALUES[AUTH_SECRET]:-}" ]]; then
        AUTH_SECRET_DEFAULT=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "")
        if [[ -n "$AUTH_SECRET_DEFAULT" ]]; then
            warn "AUTH_SECRET kosong/placeholder — auto-generate baru."
            ENV_VALUES["AUTH_SECRET"]="$AUTH_SECRET_DEFAULT"
        fi
    fi
fi

# ── Tampilkan rencana ───────────────────────────────────────
echo ""
echo "============================================="
echo "  Rencana: Set Environment Variables"
echo "============================================="
echo ""
echo "  Environments: ${ENVIRONMENTS[*]}"
echo "  Variabel:     ${#ENV_VALUES[@]}"
echo ""

# Kategorikan
REQUIRED_KEYS=("AUTH_SECRET" "DATABASE_URL" "NEXT_PUBLIC_SITE_URL")
OPTIONAL_KEYS=("SMTP_HOST" "SMTP_PORT" "SMTP_USER" "SMTP_PASS" "SMTP_FROM" "ADMIN_EMAIL" "FONNTE_TOKEN" "ADMIN_PHONE" "TELEGRAM_BOT_TOKEN" "TELEGRAM_CHAT_ID" "SENTRY_DSN" "NEXT_PUBLIC_SENTRY_DSN" "SENTRY_AUTH_TOKEN" "CRON_SECRET" "NEON_API_KEY" "NEON_PROJECT_ID" "DATABASE_URL_DIRECT" "REDIS_URL" "LOKI_URL" "SITE_DOMAIN" "ALLOWED_ORIGINS" "APP_DEBUG" "SEED_ADMIN_PASSWORD" "SEED_OPERATOR_PASSWORD" "SEED_GURU_PASSWORD" "SEED_ORTU_PASSWORD" "SEED_SISWA_PASSWORD")

# Tampilkan yang required
for key in "${REQUIRED_KEYS[@]}"; do
    val="${ENV_VALUES[$key]:-}"
    if [[ -n "$val" ]]; then
        # Mask secrets
        case "$key" in
            *SECRET*|*PASS*|*TOKEN*|*KEY*)
                masked="${val:0:8}...${val: -4}"
                ;;
            *URL*)
                masked="${val:0:20}..."
                ;;
            *)
                masked="$val"
                ;;
        esac
        log "$key = $masked"
    else
        warn "$key = (KOSONG — required!)"
    fi
done

echo ""

# ── Apply ke Vercel ─────────────────────────────────────────
TOTAL=${#ENV_VALUES[@]}
SUCCESS=0
FAILED=0
SKIPPED=0

info "Mengirim $TOTAL variabel ke Vercel..."
echo ""

for key in $(echo "${!ENV_VALUES[@]}" | tr ' ' '\n' | sort); do
    val="${ENV_VALUES[$key]}"
    
    # Apply ke setiap environment
    for env in "${ENVIRONMENTS[@]}"; do
        if [[ "$DRY_RUN" -eq 1 ]]; then
            # Mask value in dry-run
            case "$key" in
                *SECRET*|*PASS*|*TOKEN*|*KEY*|*AUTH*)
                    display_val="***masked***"
                    ;;
                *)
                    display_val="$val"
                    ;;
            esac
            info "[dry-run] vercel env add $key $env = $display_val"
            ((SUCCESS++)) || true
        else
            # Use --force to overwrite existing
            if echo "$val" | npx vercel env add "$key" "$env" --force 2>/dev/null; then
                ((SUCCESS++)) || true
            else
                error "Gagal set $key di $env"
                ((FAILED++)) || true
            fi
        fi
    done
done

# ── Ringkasan ────────────────────────────────────────────────
echo ""
echo "============================================="
if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  DRY RUN SELESAI"
else
    echo "  SETUP SELESAI"
fi
echo "============================================="
echo ""
echo "  Total:    $TOTAL variabel"
echo "  Berhasil: $SUCCESS"
if [[ "$FAILED" -gt 0 ]]; then
    echo "  Gagal:    $FAILED"
fi
echo "  Env:      ${ENVIRONMENTS[*]}"
echo ""

if [[ "$DRY_RUN" -eq 0 && "$FAILED" -eq 0 ]]; then
    echo "Langkah selanjutnya:"
    echo "  1. Redeploy: npx vercel --prod"
    echo "  2. Jalankan migrasi DB: bash scripts/deploy-vercel.sh"
    echo ""
    warn "JANGAN commit secrets ke git!"
    warn "Pastikan .env tetap di .gitignore."
fi
