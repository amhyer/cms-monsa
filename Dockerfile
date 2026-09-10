# ==============================================================================
# CMS MONSA — Production Dockerfile
# Multi-stage build untuk optimized production image
# ==============================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
# Bun diambil sebagai binary tunggal dari image resmi oven/bun — BUKAN
# corepack: corepack hanya mengelola package manager yang didukung npm
# (npm/pnpm/yarn) dan menolak spec `bun@latest` ("Unsupported package
# manager specification") pada node:20-alpine terbaru. Binary bun
# self-contained (satu file, tanpa runtime tambahan), jadi COPY antar
# image cukup.
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
# Schema Prisma ikut di-copy: postinstall project menjalankan `prisma
# generate`, yang mencari prisma/schema.prisma — tanpa file ini `bun
# install` gagal di stage deps.
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# bun harus di-install lagi di stage ini — stage adalah image terpisah; bun
# yang di-copy di stage `deps` TIDAK ikut ter-copy ke sini (hanya
# node_modules yang di-copy). Tanpa ini `bun run build` gagal
# ("bun: not found"). Lihat komentar stage deps: binary dari oven/bun,
# bukan corepack (corepack menolak spec bun).
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (skema tunggal PostgreSQL)
RUN npx prisma generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Env dummy build — meniru kondisi CI (.github/workflows/ci.yml) yang juga
# men-set DATABASE_URL + AUTH_SECRET saat `next build`: sitemap.ts di-
# prerender saat build dan mengonstruksi PrismaClient; tanpa env ini build
# berjalan di kondisi berbeda dari CI. Nilai dummy tidak dipakai untuk
# koneksi nyata (query gagal tertangani try/catch di sitemap).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-dummy-secret-not-used-at-runtime"
RUN bun run build

# ── Stage: Prisma CLI (versi disamakan dengan builder) ────────────────────────
# Runner menyalin node_modules secara piecemeal — itu TIDAK cukup untuk CLI
# Prisma: @prisma/config punya dependensi runtime (effect, c12, deepmerge-ts,
# empathic + transitifnya) yang tidak ikut bila hanya folder `prisma` yang
# disalin (gejala: "Cannot find module 'effect'" saat entrypoint menjalankan
# `prisma migrate deploy`). Stage ini memasang HANYA CLI prisma; versinya
# dibaca dari package.json yang sudah terpasang di builder supaya selalu
# identik tanpa perlu di-update manual saat Prisma di-upgrade.
FROM oven/bun:1-alpine AS prisma-cli
WORKDIR /cli
COPY --from=builder /app/node_modules/prisma/package.json ./prisma-package.json
RUN echo '{"name":"prisma-cli","private":true}' > package.json \
  && bun -e "console.log(JSON.parse(require('fs').readFileSync('prisma-package.json','utf8')).version)" > .prisma-version \
  && bun add "prisma@$(cat .prisma-version)"

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma client and schema
# CLI Prisma dengan pohon dependensi RUNTIME utuh (stage prisma-cli) —
# dibutuhkan entrypoint untuk `prisma migrate deploy`. Disalin SEBELUM
# potongan dari builder agar binari engine platform linux-musl dari builder
# (hasil install yang sama dengan generate client) yang menang bila path
# tumpang tindih.
COPY --from=prisma-cli /cli/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# Copy scripts — hanya 2 file yang lolos .dockerignore:
#   docker-entrypoint.sh (migrasi sebelum start) & backup-db.sh (cron backup)
COPY --from=builder /app/scripts ./scripts
RUN chmod +x ./scripts/docker-entrypoint.sh ./scripts/backup-db.sh

# Create logs directory
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check — start-period lapang: pada boot pertama entrypoint menjalankan
# migrasi Prisma dulu sebelum server listen.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Entrypoint menjalankan `prisma migrate deploy` (idempotent) sebelum server
# start — set RUN_MIGRATIONS=false untuk melewati (mis. multi-instance).
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
