# CMS MONSA - SSL Deployment Guide

## Overview

This guide covers deploying CMS MONSA with automatic SSL/TLS certificates using Caddy reverse proxy.

## Architecture

```
Internet → Caddy (80/443) → Next.js App (3000) → PostgreSQL (5432)
```

## Prerequisites

1. **Domain Name**: You need a domain pointing to your server's IP
2. **DNS Configuration**: A record pointing to your server
3. **Ports 80 & 443**: Open in firewall for HTTP/HTTPS traffic
4. **Docker & Docker Compose**: Installed on your server

## Quick Start

### 1. Clone Repository

```bash
git clone <your-repo-url> cms-monsa
cd cms-monsa
```

### 2. Create Environment File

```bash
cat > .env << 'EOF'
# Database
DB_PASSWORD=$(openssl rand -hex 16)

# Authentication
AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Domain Configuration
SITE_DOMAIN=your-domain.com
ADMIN_EMAIL=your-email@domain.com
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Optional: Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=CMS MONSA <noreply@your-domain.com>
ADMIN_EMAIL=admin@your-domain.com
EOF
```

### 3. Deploy with SSL

```bash
# Build and start all services
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d --build

# Run database migrations
docker compose exec app bun run db:migrate:prod

# Seed initial admin account
docker compose exec app bun run db:seed

# Check status
docker compose ps
```

### 4. Verify SSL

```bash
# Check certificate
curl -I https://your-domain.com

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/
```

## Configuration Options

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_DOMAIN` | Yes | Your domain name (e.g., `sdn-mongisidi1.sch.id`) |
| `ADMIN_EMAIL` | Yes | Email for Let's Encrypt notifications |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `AUTH_SECRET` | Yes | JWT/session secret (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `APP_PORT` | No | App port (default: 3000) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Full site URL with https:// |

### Caddy Features

- **Automatic HTTPS**: Certificates auto-renewed by Let's Encrypt
- **HTTP/2 & HTTP/3**: Enabled by default
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Compression**: Automatic gzip/brotli
- **Logging**: JSON format with rotation

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base configuration (app + database) |
| `docker-compose.ssl.yml` | Adds Caddy reverse proxy with SSL |
| `docker-compose.cron.yml` | Adds automated backup cron job |

### Combining Multiple Overrides

```bash
# Base + SSL
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d

# Base + SSL + Cron
docker compose -f docker-compose.yml -f docker-compose.ssl.yml -f docker-compose.cron.yml up -d
```

## SSL Certificate Management

### Automatic Renewal

Caddy automatically handles certificate renewal. No manual intervention needed.

### Check Certificate Status

```bash
# View Caddy logs
docker compose logs caddy

# Check certificate files
docker compose exec caddy ls -la /data/caddy/certificates/
```

### Force Certificate Renewal

```bash
# Restart Caddy to force renewal
docker compose restart caddy
```

## Troubleshooting

### Certificate Not Issued

1. **Check DNS**: Ensure domain points to server IP
2. **Check Ports**: 80 and 443 must be open
3. **Check Logs**: `docker compose logs caddy`
4. **Check Rate Limits**: Let's Encrypt has rate limits

### Common Issues

| Issue | Solution |
|-------|----------|
| `ERR_CONNECTION_REFUSED` | Check if Caddy is running: `docker compose ps caddy` |
| `SSL_ERROR` | Check certificate: `docker compose logs caddy` |
| `502 Bad Gateway` | Check app is running: `docker compose ps app` |
| `Timeout` | Check firewall rules for ports 80/443 |

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f caddy
docker compose logs -f app

# Last 100 lines
docker compose logs --tail 100 caddy
```

## Security Features

### Headers Set by Caddy

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Next.js Security Headers

Additional headers are set by Next.js in `next.config.ts`:
- Content-Security-Policy
- Permissions-Policy

## Backup with SSL

```bash
# Include cron service
docker compose -f docker-compose.yml -f docker-compose.ssl.yml -f docker-compose.cron.yml up -d

# Manual backup
docker compose exec cron /app/scripts/backup-db.sh
```

## Monitoring

### Health Checks

```bash
# Check all services
docker compose ps

# Check specific health
curl -I https://your-domain.com/api/health
```

### View Metrics

```bash
# Resource usage
docker stats

# Disk usage
docker system df
```

## Update Deployment

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d --build

# Run migrations if needed
docker compose exec app bun run db:migrate:prod
```

## Rollback

```bash
# Stop all services
docker compose -f docker-compose.yml -f docker-compose.ssl.yml down

# Start previous version
git checkout <previous-commit>
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d --build
```
