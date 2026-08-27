# CMS MONSA - Vercel Deployment Guide

## Overview

This guide covers deploying CMS MONSA to Vercel with PostgreSQL database support.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket**: Your code must be in a Git repository
3. **Node.js 22+**: Required for Next.js 16

## Quick Start (5 minutes)

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Create repository on GitHub, then:
git remote add origin https://github.com/your-username/cms-monsa.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `cms-monsa` repository
4. Click **"Import"**

### Step 3: Configure Environment Variables

In the Vercel dashboard, go to **Settings → Environment Variables** and add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://...` | Production, Preview |
| `AUTH_SECRET` | (generate with command below) | Production, Preview |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Production |
| `APP_DEBUG` | `false` | Production |

**Generate AUTH_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Deploy

Click **"Deploy"** — Vercel will:
1. Install dependencies
2. Run `prisma generate`
3. Build the Next.js app
4. Deploy to edge network

---

## Database Setup

### Option A: Vercel Postgres (Recommended)

1. In Vercel dashboard, go to **Storage** tab
2. Click **"Create Database"** → **"Postgres"**
3. Select region (e.g., Singapore for Indonesia)
4. Vercel auto-adds these env vars:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
5. Update `DATABASE_URL` to use `POSTGRES_PRISMA_URL`

### Option B: External PostgreSQL (Supabase, Neon, etc.)

1. Create database on external provider
2. Get connection string
3. Add as `DATABASE_URL` in Vercel env vars

---

## Post-Deployment Setup

### 1. Run Database Migrations

After first deploy, run migrations via Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Run migrations
vercel env pull .env.local
npx prisma migrate deploy --schema prisma/schema.postgres.prisma
#   ^ also applies prisma/migrations/*_add_dapodik_allow_insecure/
#     (adds the allowInsecureInProduction column to DapodikConfig)

# Seed database
npx tsx prisma/seed.ts
```

### 2. Custom Domain (Optional)

1. In Vercel dashboard, go to **Settings → Domains**
2. Add your domain (e.g., `sdn-mongisidi1.sch.id`)
3. Update DNS records as instructed by Vercel
4. SSL certificate is auto-provisioned

### 3. Dapodik Sync: "Izinkan HTTP di production"

The Dapodik data pull enforces an HTTPS-only guard in production: connections
to the Dapodik Web Service over `http://` are rejected unless the
**"Izinkan HTTP di production"** toggle is enabled in the dashboard
(**Dapodik → Penarikan Data Dapodik → Konfigurasi → Simpan Konfigurasi**).

Notes for Vercel:

- The app runs in the cloud, so it can only reach the school's Dapodik Web
  Service if that server is publicly reachable. Prefer exposing it over
  HTTPS (reverse proxy / tunnel, e.g. Caddy or Cloudflare Tunnel) and use an
  `https://` URL — no toggle needed.
- Only enable the toggle when Dapodik is reachable over HTTP inside a secure
  network (VPN / private tunnel). Never enable it for plain public HTTP —
  tokens and student data would be sent unencrypted.

Migration: the `allowInsecureInProduction` column (table `DapodikConfig`) is
added by the migrations in **Step 1** above (`prisma migrate deploy`); no extra
step needed. For a SQLite fallback (local dev), run `bun run db:push`.

### 4. File Uploads (IMPORTANT — works out of the box on Vercel)

Vercel's serverless filesystem is **ephemeral** — files written to
`public/uploads` at runtime disappear immediately and are never served. The
CMS handles this automatically via `src/lib/file-storage.ts`:

- **On Vercel** (detected via `VERCEL=1`), uploads are stored in the
  **database** (table `UploadedFile`, bytea on Neon PostgreSQL) and served
  through the `/uploads/<filename>` route handler with immutable caching.
  No extra configuration needed.
- **Self-hosted** (Docker/VM), uploads go to disk (`public/uploads`) — on
  Docker, make sure the `uploads-data` volume is mounted
  (already configured in `docker-compose.yml`).

Override with env `UPLOAD_STORAGE=db|disk` if needed.

**Size limit caveat**: Vercel caps Serverless Function request bodies at
**4.5 MB at the platform level** (not configurable). Upload routes
automatically use a **4 MB limit on Vercel** (15 MB for PDFs / 5 MB for
images on self-host) so oversized files get a clear 400 error instead of a
platform 413. Override with env `MAX_UPLOAD_MB` (single value for all
upload kinds). For larger PDFs, deploy self-hosted (Docker) or implement
direct-to-storage uploads.

Migration: the `UploadedFile` table is created by migration
`20260828120000_add_uploaded_file` (applied by `prisma migrate deploy`).
For a SQLite dev database, run `bun run db:push`.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | JWT/session secret (64 hex chars) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Full site URL with https:// |
| `APP_DEBUG` | No | Debug flag (default: false) |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |
| `SMTP_HOST` | No | Email SMTP host |
| `SMTP_PORT` | No | Email SMTP port |
| `SMTP_USER` | No | Email SMTP username |
| `SMTP_PASS` | No | Email SMTP password |
| `ADMIN_EMAIL` | No | Admin notification email |

---

## Vercel Features

### Automatic Deployments

- **Production**: Push to `main` branch
- **Preview**: Push to any other branch (creates unique URL)
- **Pull Request**: Auto-comments with preview URL

### Performance

- **Edge Network**: Global CDN with 99.99% uptime
- **Serverless Functions**: Auto-scaling API routes
- **ISR/SSG**: Incremental Static Regeneration for fast pages

### Monitoring

- **Analytics**: Real-time performance metrics
- **Speed Insights**: Core Web Vitals tracking
- **Logs**: Function execution logs

---

## Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Ensure `prisma generate` runs during build
3. Verify all env vars are set

### Database Connection Issues

1. Check `DATABASE_URL` format
2. Ensure database allows Vercel IP ranges
3. Use connection pooling for serverless

### Prisma Errors

1. Run `npx prisma generate` locally
2. Commit `node_modules/.prisma` if needed
3. Check schema compatibility

---

## Cost

### Vercel Free Tier

- **Hobby**: $0/month
- 100 GB bandwidth
- 100,000 serverless function invocations
- 1,000 build minutes

### Vercel Pro Tier

- $20/user/month
- 1 TB bandwidth
- Unlimited builds
- Team collaboration

### Vercel Postgres

- **Free**: 256 MB storage, 100 hours compute
- **Pro**: Starting at $20/month for more storage

---

## Comparison: Vercel vs Docker

| Feature | Vercel | Docker |
|---------|--------|--------|
| Setup Time | 5 minutes | 30+ minutes |
| SSL/TLS | Automatic | Manual (Caddy/Nginx) |
| Scaling | Automatic | Manual |
| Cost | Free tier available | Server costs |
| Database | Managed (Vercel Postgres) | Self-managed |
| Maintenance | None | High |
| Custom Domain | Easy | Manual DNS |
| Monitoring | Built-in | External tools |

**Recommendation**: For most Next.js projects, Vercel is the easiest and most cost-effective option.
