#!/bin/sh
# ============================================
# CMS MONSA - Cron job runner (container cron)
# ============================================
# Pembungkus job wget cron APP: mencoba sekali, bila gagal mengulang SATU
# kali setelah RETRY_DELAY_SEC detik (default 300 = 5 menit), dan selalu
# mencatat body respons ke log — sehingga kegagalan cron (401, 5xx, timeout)
# kelihatan penyebabnya di /backups/cron.log tanpa menjalankan ulang manual.
#
# Pemakaian di crontab:
#   30 2 * * * /bin/sh /app/scripts/cron-job.sh cleanup-uploads /api/cron/cleanup-uploads >> /backups/cron.log 2>&1
#   0 3 * * * /bin/sh /app/scripts/cron-job.sh storage-alert /api/cron/storage-alert >> /backups/cron.log 2>&1
#
# Env:
#   CRON_SECRET       — token bearer untuk header Authorization (wajib)
#   BASE_URL          — dasar URL app (default http://app:3000)
#   RETRY_DELAY_SEC   — jeda sebelum ulangan (default 300)
#   CRON_JOB_LOG      — file log (default /backups/cron.log)
#   WGET_TIMEOUT_SEC  — timeout wget per percobaan (default 60)
#
# Kompatibel busybox ash (image cron = postgres:16-alpine).
# ============================================
set -u

LABEL="${1:-}"
JOB_PATH="${2:-}"
BASE_URL="${BASE_URL:-http://app:3000}"
RETRY_DELAY_SEC="${RETRY_DELAY_SEC:-300}"
LOG="${CRON_JOB_LOG:-/backups/cron.log}"
WGET_TIMEOUT_SEC="${WGET_TIMEOUT_SEC:-60}"

if [ -z "$LABEL" ] || [ -z "$JOB_PATH" ]; then
  echo "[cron-job] pemakaian: cron-job.sh <label> <path-api> (mis. cron-job.sh storage-alert /api/cron/storage-alert)" >>"$LOG"
  exit 2
fi

TMP="/tmp/cron-job-body.$$"
ERR="/tmp/cron-job-err.$$"
trap 'rm -f "$TMP" "$ERR"' EXIT

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$LABEL] $*" >>"$LOG"; }

attempt() {
  : >"$TMP"
  # stderr ditangkap: busybox wget tidak menulis body respons saat HTTP
  # error, tapi mencetak statusnya (mis. "wget: server returned error:
  # HTTP/1.1 401 Unauthorized") — jauh lebih berguna daripada rc saja.
  wget -qO "$TMP" -T "$WGET_TIMEOUT_SEC" \
    --header "Authorization: Bearer ${CRON_SECRET:-}" \
    "${BASE_URL}${JOB_PATH}" 2>"$ERR"
}

body_of() {
  # Potong 500 byte agar log tetap ringkas bila body tak terduga.
  if [ -s "$TMP" ]; then head -c 500 "$TMP"; else echo "(body kosong)"; fi
}

detail_of() {
  if [ -s "$ERR" ]; then tail -n1 "$ERR"; else echo "(tanpa detail)"; fi
}

# 1 percobaan + 1 ulangan. Direct call (bukan `if attempt`) agar rc wget
# benar-benar tertangkap — POSIX sh me-reset $? di akhir blok `if`.
attempt_no=1
max_attempt=2
status=1
while :; do
  attempt
  rc=$?
  if [ "$rc" -eq 0 ]; then
    log "percobaan-${attempt_no} ok body=$(body_of)"
    status=0
    break
  fi
  log "percobaan-${attempt_no} gagal (rc=${rc}) detail=$(detail_of) body=$(body_of)"
  if [ "$attempt_no" -ge "$max_attempt" ]; then
    break
  fi
  log "mengulang dalam ${RETRY_DELAY_SEC} detik"
  sleep "$RETRY_DELAY_SEC"
  attempt_no=$((attempt_no + 1))
done

exit $status
