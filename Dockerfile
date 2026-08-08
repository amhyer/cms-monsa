# ============================================
# CMS MONSA - Multi-stage Dockerfile
# ============================================
# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Install bun
RUN npm install -g bun@1.2

# Install dependencies with bun (including devDependencies for build)
RUN bun install --dev

# Generate Prisma client
RUN bunx prisma generate

# ============================================
# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app

# Install bun
RUN npm install -g bun@1.2

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Install dependencies with bun (including devDependencies for build)
RUN bun install --dev

# Copy source code
COPY . .

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./db/custom.db"
ENV AUTH_SECRET="build-time-placeholder"
ENV NEXT_PUBLIC_SITE_URL="https://sdn-mongisidi1.sch.id"

# Build the application
RUN bun run build

# ============================================
# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + migration files for runtime migrate deploy
COPY --from=builder /app/prisma ./prisma
RUN chown -R nextjs:nodejs prisma

# Copy Prisma CLI (version-locked via bun.lock) + package scripts so
# `migrate deploy` works both at startup and via `docker compose exec`
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/package.json ./package.json
RUN npm install -g bun@1.2

# Create directories for database and uploads
RUN mkdir -p prisma/db public/uploads && \
    chown -R nextjs:nodejs prisma/db public/uploads

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Apply pending migrations before starting the app
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema prisma/schema.postgres.prisma && node server.js"]
