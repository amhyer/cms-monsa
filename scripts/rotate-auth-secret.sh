#!/usr/bin/env bash
# ============================================================
# Rotasi AUTH_SECRET di environment Vercel (Production & Preview)
# lalu redeploy agar konsisten dengan lokal.
#
# Prasyarat:
#   - Vercel CLI terinstall & ter-login: npx vercel login
#   - Token akses ke project ini
#
# Konsekuensi:
#   - Semua sesi login aktif HANGUS (pengguna harus login ulang)
#   - Cookie dari history git definitif mati
#   - Local & produksi konsisten
#
# Usage:
#   bash scripts/rotate-auth-secret.sh
#   bash scripts/rotate-auth-secret.sh --dry-run   # hanya tampilkan, jangan apply
# ============================================================
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  echo "🔍 DRY RUN — tidak ada yang diubah."
  echo ""
fi

# 1. Generate secret baru (32 byte = 64 hex chars)
NEW_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
echo "✅ Secret baru digenerate: ${#NEW_SECRET} karakter"

# 2. Tampilkan (tidak pernah di-echo ke log — hanya untuk konfirmasi visual)
echo ""
echo "⚠️  Secret baru (64 hex): ${NEW_SECRET:0:8}...${NEW_SECRET: -8}"
echo ""

# 3. Apply ke Vercel Production
echo "📦 Setting AUTH_SECRET di Production..."
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "   [dry-run] npx vercel env add AUTH_SECRET production <<< '$NEW_SECRET'"
else
  echo "$NEW_SECRET" | npx vercel env add AUTH_SECRET production --force 2>&1
  echo "   ✅ Production updated"
fi

# 4. Apply ke Vercel Preview
echo ""
echo "📦 Setting AUTH_SECRET di Preview..."
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "   [dry-run] npx vercel env add AUTH_SECRET preview <<< '$NEW_SECRET'"
else
  echo "$NEW_SECRET" | npx vercel env add AUTH_SECRET preview --force 2>&1
  echo "   ✅ Preview updated"
fi

# 5. Update .env lokal juga
echo ""
echo "📝 Updating .env lokal..."
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "   [dry-run] sed -i 's/^AUTH_SECRET=.*/AUTH_SECRET=$NEW_SECRET/' .env"
else
  if [[ -f .env ]]; then
    sed -i "s/^AUTH_SECRET=.*/AUTH_SECRET=$NEW_SECRET/" .env
    echo "   ✅ .env updated"
  else
    echo "AUTH_SECRET=$NEW_SECRET" >> .env
    echo "   ✅ .env created with new secret"
  fi
fi

# 6. Trigger redeploy
echo ""
echo "🚀 Triggering redeploy..."
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "   [dry-run] npx vercel --prod --force"
else
  npx vercel --prod --force 2>&1 | tail -3
  echo "   ✅ Redeploy triggered"
fi

echo ""
echo "============================================="
echo "✅ ROTASI SELESAI"
echo "============================================="
echo ""
echo "Konskuensi:"
echo "  - Semua sesi login aktif HANGUS"
echo "  - Pengguna harus login ulang"
echo "  - Cookie dari history git definitif mati"
echo "  - Production & Preview konsisten dengan lokal"
echo ""
echo "⚠️  JANGAN commit secret ke git!"
echo "   Pastikan .env tetap di .gitignore."
