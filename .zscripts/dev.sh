#!/bin/bash

set -euo pipefail

# 获取脚本所在目录（.zscripts）
# 使用 $0 获取脚本路径（与 build.sh 保持一致）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Flag --no-log: tetap tulis output server ke terminal (live streaming)
# alih-alih .zscripts/dev.log. CATATAN: tanpa dev.log, reuse mode test:e2e
# (--if-up / pidfile) tidak punya sumber tail — set E2E_SERVER_LOG ke log
# terminal milik Anda bila ingin diagnosa kegagalan reuse tetap lengkap.
NO_LOG=0
for arg in "$@"; do
        case "$arg" in
                --no-log) NO_LOG=1 ;;
                *) echo "WARN: argumen tidak dikenal: $arg (hanya --no-log yang didukung)" >&2 ;;
        esac
done

log_step_start() {
        local step_name="$1"
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting: $step_name"
        echo "=========================================="
        export STEP_START_TIME
        STEP_START_TIME=$(date +%s)
}

log_step_end() {
        local step_name="${1:-Unknown step}"
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - STEP_START_TIME))
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completed: $step_name"
        echo "[LOG] Step: $step_name | Duration: ${duration}s"
        echo "=========================================="
        echo ""
}

start_mini_services() {
        local mini_services_dir="$PROJECT_DIR/mini-services"
        local started_count=0

        log_step_start "Starting mini-services"
        if [ ! -d "$mini_services_dir" ]; then
                echo "Mini-services directory not found, skipping..."
                log_step_end "Starting mini-services"
                return 0
        fi

        echo "Found mini-services directory, scanning for sub-services..."

        for service_dir in "$mini_services_dir"/*; do
                if [ ! -d "$service_dir" ]; then
                        continue
                fi

                local service_name
                service_name=$(basename "$service_dir")
                echo "Checking service: $service_name"

                if [ ! -f "$service_dir/package.json" ]; then
                        echo "[$service_name] No package.json found, skipping..."
                        continue
                fi

                if ! grep -q '"dev"' "$service_dir/package.json"; then
                        echo "[$service_name] No dev script found, skipping..."
                        continue
                fi

                echo "Starting $service_name in background..."
                (
                        cd "$service_dir"
                        echo "[$service_name] Installing dependencies..."
                        bun install
                        echo "[$service_name] Running bun run dev..."
                        exec bun run dev
                ) >"$PROJECT_DIR/.zscripts/mini-service-${service_name}.log" 2>&1 &

                local service_pid=$!
                echo "[$service_name] Started in background (PID: $service_pid)"
                echo "[$service_name] Log: $PROJECT_DIR/.zscripts/mini-service-${service_name}.log"
                disown "$service_pid" 2>/dev/null || true
                started_count=$((started_count + 1))
        done

        echo "Mini-services startup completed. Started $started_count service(s)."
        log_step_end "Starting mini-services"
}

wait_for_service() {
        local host="$1"
        local port="$2"
        local service_name="$3"
        local max_attempts="${4:-60}"
        local attempt=1

        echo "Waiting for $service_name to be ready on $host:$port..."

        while [ "$attempt" -le "$max_attempts" ]; do
                if curl -s --connect-timeout 2 --max-time 5 "http://$host:$port" >/dev/null 2>&1; then
                        echo "$service_name is ready!"
                        return 0
                fi

                echo "Attempt $attempt/$max_attempts: $service_name not ready yet, waiting..."
                sleep 1
                attempt=$((attempt + 1))
        done

        echo "ERROR: $service_name failed to start within $max_attempts seconds"
        return 1
}

cleanup() {
        if [ -n "${DEV_PID:-}" ] && kill -0 "$DEV_PID" >/dev/null 2>&1; then
                echo "Stopping Next.js dev server (PID: $DEV_PID)..."
                kill "$DEV_PID" >/dev/null 2>&1 || true
                # Hapus state dev server (lihat catatan di bawah); pada exit
                # normal DEV_PID sudah di-unset sehingga pidfile tetap ada
                # (server masih berjalan untuk pre-commit warm-up). Log
                # (dev.log) sengaja DIKEEP — jejak diagnosa post-mortem.
                rm -f "$PROJECT_DIR/.zscripts/dev.pid" "$PROJECT_DIR/.zscripts/dev.port"
        fi
}

trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"

# Port dev server (bisa di-override; default 3000). Ditulis ke
# .zscripts/dev.port (bersama dev.pid) agar pre-commit warm-up (e2e:warmup)
# otomatis membaca port ini — tidak perlu hardcode localhost:3000.
DEV_PORT="${DEV_PORT:-3000}"

# .env jangan pernah ditulis/di-overwrite dari script (REFACTOR_PLAN #3).
# .env yang hilang/salah → error Prisma yang jelas, bukan korup diam-diam.
# DB kanonik: prisma/db/custom.db (Prisma resolve file: relatif ke lokasi schema)
export DATABASE_URL="file:../db/custom.db"

if ! command -v bun >/dev/null 2>&1; then
        echo "ERROR: bun is not installed or not in PATH"
        exit 1
fi

log_step_start "bun install"
echo "[BUN] Installing dependencies..."
bun install
log_step_end "bun install"

log_step_start "bun run db:push"
echo "[BUN] Setting up database..."
bun run db:push
log_step_end "bun run db:push"

log_step_start "Starting Next.js dev server"
echo "[BUN] Starting development server on port $DEV_PORT..."
# `-p` tambahan menimpa port bawaan `next dev -p 3000` (arg parser Next
# memakai nilai terakhir), jadi DEV_PORT selalu yang berlaku.
if [ "$NO_LOG" -eq 1 ]; then
        # --no-log: output server mengalir ke terminal ini (live streaming),
        # bukan ke .zscripts/dev.log.
        bun run dev -p "$DEV_PORT" &
else
        # Output server ditulis ke .zscripts/dev.log (bukan terminal) —
        # wrapper test:e2e auto-membaca log ini di reuse mode (--if-up /
        # pidfile) untuk tail kegagalan tanpa perlu E2E_SERVER_LOG.
        bun run dev -p "$DEV_PORT" > "$PROJECT_DIR/.zscripts/dev.log" 2>&1 &
fi
DEV_PID=$!
echo "$DEV_PID" > "$PROJECT_DIR/.zscripts/dev.pid"
echo "$DEV_PORT" > "$PROJECT_DIR/.zscripts/dev.port"
log_step_end "Starting Next.js dev server"

log_step_start "Waiting for Next.js dev server"
wait_for_service "localhost" "$DEV_PORT" "Next.js dev server"
log_step_end "Waiting for Next.js dev server"

log_step_start "Health check"
echo "[BUN] Performing health check..."
curl -fsS "localhost:$DEV_PORT" >/dev/null
echo "[BUN] Health check passed"
log_step_end "Health check"

start_mini_services

echo "Next.js dev server is running in background (PID: $DEV_PID)."
if [ "$NO_LOG" -eq 1 ]; then
        echo "Log: live di terminal ini (--no-log) — tidak ada .zscripts/dev.log; set E2E_SERVER_LOG untuk tail reuse mode test:e2e"
else
        echo "Log: $PROJECT_DIR/.zscripts/dev.log (tail -f untuk live)"
fi
echo "Use 'kill $DEV_PID' to stop it."
disown "$DEV_PID" 2>/dev/null || true
unset DEV_PID
