#!/usr/bin/env bash
# ============================================================
# Gate pre-commit — SATU sumber kebenaran untuk semua validasi.
#
# Dipanggil oleh beberapa jalur identik (tidak bisa drift):
#   - .githooks/pre-commit  → otomatis saat `git commit` (gate penuh)
#   - .githooks/pre-push    → sanity check cepat saat push (--quick)
#   - bun run hooks:check   → dry-run manual, TANPA commit
#   - CI job `hooks-gate`   → gate penuh di setiap PR
#
# Isi:
#   1. Guard cepat (gagal seketika) — file .db/.env ter-stage atau
#      file kritikal (upload route / CORS proxy) dihapus dari index.
#   2. Warm-up rute dev server (non-blocking, --if-up) — port dibaca
#      otomatis dari .zscripts/dev.pid/.port (lihat e2e/warmup.ts).
#   3. Gate penuh: bun run check — typecheck · eslint · markdownlint ·
#      schema-sync · vitest.
#
# Guard 1 & 2 memeriksa INDEX (git diff --cached) — isi yang akan
# ter-commit. Di dry-run (`bun run hooks:check`) index adalah "yang akan
# ter-commit bila commit sekarang", jadi hasilnya sama persis.
#
# Mode ringan (lewati gate penuh yang lambat — tsc/vitest/dll):
#   bun run hooks:check -- --staged   → guard + lint HANYA file ter-stage
#   bun run hooks:check -- --quick    → guard + lint seluruh repo
#   bun run hooks:check -- --staged-push → guard + lint HANYA file pada
#     commit yang di-push (daftar file dikirim pre-push lewat env
#     HOOKS_PUSH_FILES baris per baris + HOOKS_PUSH_NON_JS untuk transparansi
#     non-JS/TS — lihat .githooks/pre-push)
#   bun run hooks:check -- --staged --quick → sama dengan --staged (scope
#     ter-sempit menang; keduanya melewati bagian lambat)
# Cocok sebagai sanity check cepat sebelum commit/push. Guard yang memblokir
# selalu exit 1 seketika di mode apa pun.
#
# Mode JSON (untuk tooling):
#   bun run hooks:check -- --json [--quick] [--staged] [--staged-push]
#   → stdout berisi SATU baris JSON; detail manusia dipindah ke stderr.
#     Exit code tetap 0/1/2 (ok / gagal / argumen salah). Mode staged-push
#     ikut melaporkan `pushScope` (total file scope push vs file JS/TS yang
#     di-lint) dari env HOOKS_PUSH_SCOPE_TOTAL yang di-set pre-push.
# ============================================================
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

# Flag: --quick (lint repo saja) · --staged (lint HANYA file ter-stage) ·
# --staged-push (lint HANYA file commit yang di-push) · --json (output JSON
# satu baris ke stdout). Argumen lain → usage + exit 2.
QUICK=0
STAGED=0
STAGED_PUSH=0
JSON=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --staged) STAGED=1 ;;
    --staged-push) STAGED_PUSH=1 ;;
    --json) JSON=1 ;;
    *)
      if [[ "$JSON" -eq 1 ]]; then
        echo '{"tool":"hooks:check","ok":false,"error":"Argumen tidak dikenal: '"$arg"'"}' >&2
      else
        echo "❌ [hooks] Argumen tidak dikenal: $arg" >&2
        echo "   Usage: bun run hooks:check [--quick] [--staged] [--staged-push] [--json]" >&2
      fi
      exit 2
      ;;
  esac
done

# Mode: full (gate penuh) | quick (lint repo) | staged (lint file ter-stage)
# | staged-push (lint file commit yang di-push, daftar dari HOOKS_PUSH_FILES).
# Kombinasi → scope ter-sempit menang: staged-push > staged > quick.
MODE="full"
if [[ "$STAGED_PUSH" -eq 1 ]]; then
  MODE="staged-push"
elif [[ "$STAGED" -eq 1 ]]; then
  MODE="staged"
elif [[ "$QUICK" -eq 1 ]]; then
  MODE="quick"
fi

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\r//g'
}

json_str_list() {
  if [ "$#" -eq 0 ]; then
    printf '[]'
    return
  fi
  local out='[' first=1 item
  for item in "$@"; do
    if [ "$first" -eq 1 ]; then
      out+="\"$(json_escape "$item")\""
      first=0
    else
      out+=",\"$(json_escape "$item")\""
    fi
  done
  printf '%s]' "$out"
}

# Sama dengan json_str_list, tapi tiap path melewati truncate_path (display
# form yang sama dengan output manusia) — dipakai field `fileDisplay` agar
# konsumen mesin dapat FULL path (`files`) dan bentuk tampil terpotong.
json_display_list() {
  if [ "$#" -eq 0 ]; then
    printf '[]'
    return
  fi
  local out='[' first=1 item
  for item in "$@"; do
    if [ "$first" -eq 1 ]; then
      out+="\"$(json_escape "$(truncate_path "$item")")\""
      first=0
    else
      out+=",\"$(json_escape "$(truncate_path "$item")")\""
    fi
  done
  printf '%s]' "$out"
}

# Warna ANSI HANYA saat stdout TTY (bukan pipe/log/CI) dan NO_COLOR kosong.
USE_COLOR=0
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  USE_COLOR=1
fi

# Keputusan warna yang SAMA untuk eslint (semua mode ringan) — agar umpan
# balik visual konsisten dengan print_file_list: --color hanya bila stdout
# TTY & NO_COLOR kosong, --no-color di pipe/log/CI (dan mode JSON, stdout
# dikhususkan untuk baris JSON). Di-set sekarang agar bisa dipakai lint_file_scope.
LINT_COLOR="--no-color"
if [[ "$USE_COLOR" -eq 1 ]]; then
  LINT_COLOR="--color"
fi

# Potong path panjang jadi head...tail (ujung — basename + induk — tetap
# terlihat). Panjang default 70 karakter.
truncate_path() {
  local p="$1" max="${2:-70}"
  if [[ "${#p}" -le "$max" ]]; then
    printf '%s' "$p"
    return
  fi
  # Pisah jadi dua `local`: RHS `tail=$((max - head - 3))` diekspansi SEBELUM
  # `head` ter-assign bila satu deklarasi — di bawah `set -u` itu error
  # "head: unbound variable" (gotcha bash klasik).
  local head=12
  local tail=$((max - head - 3))
  printf '%s...%s' "${p:0:head}" "${p: -tail}"
}

# Cetak daftar file: warna (bila TTY) + truncate. $1 = kode ANSI (kosong di
# non-TTY); sisanya = daftar file.
print_file_list() {
  local color="$1"
  shift
  if [[ "$USE_COLOR" -eq 1 ]]; then
    for f in "$@"; do
      printf '   - %s%s\033[0m\n' "$color" "$(truncate_path "$f")"
    done
  else
    for f in "$@"; do
      printf '   - %s\n' "$(truncate_path "$f")"
    done
  fi
}

GUARD_VIOLATIONS=()
LINT_FILES=()

# --- Guard 1: file .db / .env ter-stage? --------------------------------
# .env.example adalah satu-satunya file .env* yang sah untuk di-commit.
FORBIDDEN="$(git diff --cached --name-only | awk '
  /\.db(-journal)?$/ { print; next }
  {
    base = $0
    sub(/^.*\//, "", base)
    if (base ~ /^\.env(\.|$)/ && base != ".env.example") print
  }
' || true)"

if [[ -n "$FORBIDDEN" ]]; then
  if [[ "$JSON" -eq 0 ]]; then
    echo "❌ [hooks] Perubahan DITOLAK — file terlarang ter-stage:"
    echo "$FORBIDDEN" | sed 's/^/   - /'
    echo "   File .db / .env tidak boleh di-commit (kecuali .env.example)."
    echo "   Hapus dari index:  git reset HEAD <file>"
  fi
  while IFS= read -r f; do
    [ -n "$f" ] && GUARD_VIOLATIONS+=("$f")
  done <<< "$FORBIDDEN"
fi

# --- Guard 2: upload route / CORS proxy dihapus? ------------------------
# Mencegah pola lama terulang: "restore: upload route" (REPO_HEALTH_AUDIT 1.2).
for f in src/app/api/upload/route.ts src/proxy.ts; do
  in_head=0
  in_index=0
  git cat-file -e "HEAD:$f" 2>/dev/null && in_head=1
  git ls-files --cached --error-unmatch -- "$f" >/dev/null 2>&1 && in_index=1

  if (( in_head && ! in_index )); then
    if [[ "$JSON" -eq 0 ]]; then
      echo "❌ [hooks] Perubahan DITOLAK — file kritikal dihapus: $f"
      echo "   Upload route & CORS proxy WAJIB ada (REPO_HEALTH_AUDIT C.9)."
      echo "   Jika penghapusan disengaja:  git commit --no-verify"
    fi
    GUARD_VIOLATIONS+=("$f")
  fi
done

emit_result() {
  # $1 = ok (0=lulus, 1=gagal) · $2 = pesan error (opsional)
  local ok="$1"
  local err="${2:-}"
  local ok_json="false"
  [ "$ok" -eq 0 ] && ok_json="true"
  local blocked="false"
  [ "${#GUARD_VIOLATIONS[@]}" -gt 0 ] && blocked="true"

  local out="{\"tool\":\"hooks:check\",\"mode\":\"$MODE\",\"ok\":$ok_json,"
  out+="\"blocked\":$blocked,"
  out+="\"guardViolations\":$(json_str_list "${GUARD_VIOLATIONS[@]}"),"
  if [[ "$MODE" == "full" ]]; then
    out+="\"check\":{\"ok\":$ok_json}"
  else
    out+="\"lint\":{\"ok\":$ok_json,\"count\":${#LINT_FILES[@]},"
    # files = FULL path (untuk mesin); fileDisplay = bentuk terpotong
    # (truncate_path, sama dengan output manusia) — untuk display/ringkasan.
    out+="\"files\":$(json_str_list "${LINT_FILES[@]}"),"
    out+="\"fileDisplay\":$(json_display_list "${LINT_FILES[@]}")}"
  fi
  # Scope push (mode staged-push): total file yang disentuh commit push
  # (dari pre-push, HOOKS_PUSH_SCOPE_TOTAL) vs file JS/TS yang di-lint.
  if [[ "$MODE" == "staged-push" ]]; then
    out+=",\"pushScope\":{\"total\":${PUSH_SCOPE_TOTAL},\"js\":${#LINT_FILES[@]}}"
  fi
  if [[ "$MODE" != "full" ]]; then
    out+=",\"skippedSteps\":$(json_str_list typecheck vitest markdownlint schema-sync warmup)"
  fi
  if [[ -n "$err" ]]; then
    out+=",\"error\":\"$(json_escape "$err")\""
  fi
  out+="}"
  echo "$out"
}

if [[ "${#GUARD_VIOLATIONS[@]}" -gt 0 ]]; then
  if [[ "$JSON" -eq 1 ]]; then
    emit_result 1 "Guard repository memblokir perubahan."
  else
    echo
    echo "⛔ [hooks] Guard repository memblokir perubahan (lihat di atas)."
  fi
  exit 1
fi

# --- Mode ringan: --staged / --staged-push / --quick -------------------
LINT_OK=0
# Total scope push (mode staged-push) — dikirim pre-push lewat
# HOOKS_PUSH_SCOPE_TOTAL (jumlah file diff remote..local SEBELUM filter
# JS/TS); dipakai emit_result untuk payload --json `pushScope`. Di-init di
# sini agar aman di jalur guard (emit_result sebelum mode branches).
PUSH_SCOPE_TOTAL=0

# Lint daftar file JS/TS (mode ringan) — SATU implementasi untuk --staged
# dan --staged-push: pesan scope + jalankan eslint (stdout dibersihkan di
# mode JSON) + set LINT_OK. $1 = label mode ("staged"/"staged-push"), $2 =
# deskripsi scope ("ter-stage"/"pada commit yang di-push"), sisanya = file
# yang di-lint. Tanpa file → pesan "hanya guard", LINT_OK tetap 0.
lint_file_scope() {
  local label="$1" scope="$2"
  shift 2
  if [[ "$#" -eq 0 ]]; then
    if [[ "$JSON" -eq 0 ]]; then
      echo "🔍 [hooks] (--$label) tidak ada file JS/TS $scope — hanya guard."
    fi
    return 0
  fi
  LINT_FILES=("$@")
  if [[ "$JSON" -eq 0 ]]; then
    echo "🔍 [hooks] (--$label) lint ${#LINT_FILES[@]} file $scope (tanpa gate penuh):"
    print_file_list "\033[36m" "${LINT_FILES[@]}"  # cyan
  fi
  # stdout di JSON mode dikhususkan untuk baris JSON — detail ke stderr.
  # LINT_COLOR menyamakan keputusan warna dengan USE_COLOR (TTY-aware).
  if [[ "$JSON" -eq 1 ]]; then
    bunx eslint "$LINT_COLOR" "${LINT_FILES[@]}" >&2 && LINT_OK=0 || LINT_OK=1
  else
    bunx eslint "$LINT_COLOR" "${LINT_FILES[@]}" && LINT_OK=0 || LINT_OK=1
  fi
}

if [[ "$MODE" == "staged" ]]; then
  # ALL_STAGED dihitung SEKALI, lalu dipecah: file JS/TS (di-lint) dan
  # non-JS/TS (dilaporkan transparan, TIDAK di-lint). sort -u: output stabil
  # & abjad apa pun urutan git diff (variasi git version / diff.orderFile /
  # case-insensitivity), sekaligus dedupe defensif.
  ALL_STAGED="$(git diff --cached --name-only --diff-filter=ACM || true)"
  STAGED_FILES="$(printf '%s\n' "$ALL_STAGED" |
    grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' | sort -u || true)"
  NON_JS_FILES="$(printf '%s\n' "$ALL_STAGED" |
    grep -vE '\.(ts|tsx|js|jsx|mjs|cjs)$' | sed '/^[[:space:]]*$/d' | sort -u || true)"
  STAGED_FILES_ARR=()
  if [[ -n "$STAGED_FILES" ]]; then
    mapfile -t STAGED_FILES_ARR <<< "$STAGED_FILES"
  fi
  lint_file_scope staged "ter-stage" "${STAGED_FILES_ARR[@]}"
  # Transparansi scope: file non-JS/TS ikut dilaporkan (tidak di-lint)
  # supaya jelas apa yang sebenarnya ter-stage vs apa yang hanya di-lint.
  if [[ -n "$NON_JS_FILES" ]]; then
    mapfile -t NON_JS_ARR <<< "$NON_JS_FILES"
    if [[ "$JSON" -eq 0 ]]; then
      echo "ℹ️  [hooks] (--staged) ${#NON_JS_ARR[@]} file non-JS/TS ter-stage (tidak di-lint):"
      print_file_list "\033[90m" "${NON_JS_ARR[@]}"  # abu-abu
    fi
  fi
elif [[ "$MODE" == "staged-push" ]]; then
  # Daftar file dikirim pre-push lewat HOOKS_PUSH_FILES (baris per baris,
  # sudah diff remote..local). Filter JS/TS di sini juga (defensif). Total
  # scope push (sebelum filter) dari HOOKS_PUSH_SCOPE_TOTAL — hanya pre-push
  # yang tahu jumlah itu (diff remote..local), dipakai payload --json.
  PUSH_SCOPE_TOTAL="${HOOKS_PUSH_SCOPE_TOTAL:-0}"
  PUSH_FILES="$(printf '%s\n' "${HOOKS_PUSH_FILES:-}" |
    sed '/^[[:space:]]*$/d' | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' || true)"
  PUSH_FILES_ARR=()
  if [[ -n "$PUSH_FILES" ]]; then
    mapfile -t PUSH_FILES_ARR <<< "$PUSH_FILES"
  fi
  lint_file_scope staged-push "pada commit yang di-push" "${PUSH_FILES_ARR[@]}"
  # Transparansi scope (parity visual dengan --staged): file non-JS/TS pada
  # commit yang di-push ikut dilaporkan (abu-abu, truncate) meski tidak
  # di-lint. Daftar dikirim pre-push lewat HOOKS_PUSH_NON_JS (sudah sort -u).
  PUSH_NON_JS="$(printf '%s\n' "${HOOKS_PUSH_NON_JS:-}" |
    sed '/^[[:space:]]*$/d' | sort -u || true)"
  if [[ -n "$PUSH_NON_JS" ]]; then
    mapfile -t PUSH_NON_JS_ARR <<< "$PUSH_NON_JS"
    if [[ "$JSON" -eq 0 ]]; then
      echo "ℹ️  [hooks] (--staged-push) ${#PUSH_NON_JS_ARR[@]} file non-JS/TS pada commit yang di-push (tidak di-lint):"
      print_file_list "\033[90m" "${PUSH_NON_JS_ARR[@]}"  # abu-abu
    fi
  fi
elif [[ "$MODE" == "quick" ]]; then
  if [[ "$JSON" -eq 0 ]]; then
    echo "🔍 [hooks] (--quick) lint seluruh repo (tanpa tsc/vitest/schema-sync)..."
  fi
  # LINT_COLOR menyamakan keputusan warna dengan mode lain (TTY-aware):
  # eslint . --color hanya bila stdout TTY & NO_COLOR kosong.
  if [[ "$JSON" -eq 1 ]]; then
    bun run lint -- "$LINT_COLOR" >&2 && LINT_OK=0 || LINT_OK=1
  else
    bun run lint -- "$LINT_COLOR" && LINT_OK=0 || LINT_OK=1
  fi
fi

if [[ "$MODE" != "full" ]]; then
  if [[ "$JSON" -eq 1 ]]; then
    emit_result "$LINT_OK"
  elif [[ "$LINT_OK" -eq 0 ]]; then
    echo "✅ [hooks] Semua validasi (mode --$MODE) lulus."
  fi
  exit "$LINT_OK"
fi

# --- Gate penuh (mode full) ---------------------------------------------
# Warm-up rute dev server (non-blocking) — server mati → dilewati (--if-up).
if [[ "$JSON" -eq 0 ]]; then
  echo "🔥 [hooks] Memanaskan rute dev server (lewati bila server mati)..."
  bun run e2e:warmup -- --if-up
else
  bun run e2e:warmup -- --if-up >&2
fi

if [[ "$JSON" -eq 0 ]]; then
  echo "🔍 [hooks] Guard repo bersih — menjalankan typecheck + lint + test..."
  bun run check
  echo "✅ [hooks] Semua validasi lulus."
  exit 0
else
  if bun run check >&2; then
    emit_result 0
    exit 0
  else
    emit_result 1 "bun run check gagal (typecheck/lint/markdownlint/schema/vitest)."
    exit 1
  fi
fi
