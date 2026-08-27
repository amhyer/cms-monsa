# ==============================================================================
# CMS MONSA — Production Dockerfile
# Multi-stage build untuk optimized production image
# ==============================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lock ./
RUN corepack enable && corepack prepare bun@latest --activate
RUN bun install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# bun harus di-install lagi di stage ini — stage adalah image terpisah; bun
# yang di-activate via corepack di stage `deps` TIDAK ikut ter-copy ke sini
# (hanya node_modules yang di-copy). Tanpa ini `bun run build` gagal
# ("bun: not found").
RUN corepack enable && corepack prepare bun@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=prisma/schema.postgres.prisma

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
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI — dibutuhkan entrypoint untuk `prisma migrate deploy`
# (paket `prisma` self-contained; engine binary sudah ikut di
# node_modules/@prisma/engines dari stage builder).
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
