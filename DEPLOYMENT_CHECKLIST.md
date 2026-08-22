# 🚀 CMS MONSA — Deployment Checklist

> Checklist lengkap untuk deployment CMS MONSA ke production.
> Dibuat: 22 Agustus 2026

---

## 📋 Pre-Deployment

### 1. Environment Variables

```bash
# WAJIB diisi (tidak boleh kosong)
AUTH_SECRET=""           # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DATABASE_URL=""          # PostgreSQL connection string
NEXT_PUBLIC_SITE_URL=""  # https://sdn-mongisidi1.sch.id

# Email (untuk notifikasi)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="CMS MONSA <noreply@sdn-mongisidi1.sch.id>"
ADMIN_EMAIL=""

# WhatsApp/Telegram (opsional, tapi recommended)
FONNTE_TOKEN=""
ADMIN_PHONE=""           # Format: 628xxx
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# Sentry (opsional, recommended untuk monitoring)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""

# Redis (opsional, untuk rate limiting multi-instance)
REDIS_URL=""

# Loki (opsional, untuk log aggregation)
LOKI_URL=""
```

### 2. Database Setup

```bash
# 1. Buat PostgreSQL database
createdb cms_mongisidi

# 2. Run migrations
npx prisma migrate deploy --schema prisma/schema.postgres.prisma

# 3. Seed data (opsional)
bunx tsx prisma/seed.ts

# 4. Verify connection
bun run db:generate
```

### 3. Build Application

```bash
# 1. Install dependencies
bun install

# 2. Generate Prisma client
bun run db:generate

# 3. Build for production
bun run build

# 4. Verify build
ls -la .next/
```

---

## 🔒 Security Checklist

- [ ] `AUTH_SECRET` sudah di-set (bukan default value)
- [ ] `DATABASE_URL` menggunakan PostgreSQL (bukan SQLite)
- [ ] `NEXT_PUBLIC_SITE_URL` sudah benar
- [ ] `SMTP_PASS` sudah di-set (App Password untuk Gmail)
- [ ] `FONNTE_TOKEN` sudah di-set (jika pakai WhatsApp)
- [ ] `TELEGRAM_BOT_TOKEN` sudah di-set (jika pakai Telegram)
- [ ] `SENTRY_DSN` sudah di-set (jika pakai Sentry)
- [ ] Tidak ada `.env` atau `.env.local` yang ter-commit
- [ ] `.gitignore` sudah benar (node_modules, .env*, .next, db/*.db)
- [ ] Pre-commit hook sudah aktif (`bun run hooks:install`)

---

## 🗄️ Database Checklist

- [ ] PostgreSQL database sudah dibuat
- [ ] `prisma migrate deploy` sudah dijalankan
- [ ] Seed data sudah di-import (jika diperlukan)
- [ ] Database backup schedule sudah diatur
- [ ] `DATABASE_URL` menggunakan connection pooling (jika high traffic)

---

## 📧 Email Checklist

- [ ] SMTP server sudah dikonfigurasi
- [ ] `SMTP_USER` dan `SMTP_PASS` sudah di-set
- [ ] `ADMIN_EMAIL` sudah di-set
- [ ] Test email notification: buat pengaduan baru → cek email admin
- [ ] SPF/DKIM sudah dikonfigurasi (untuk deliverability)

---

## 📱 WhatsApp/Telegram Checklist

- [ ] `FONNTE_TOKEN` sudah di-set (jika pakai WhatsApp)
- [ ] `ADMIN_PHONE` sudah di-set (format: 628xxx)
- [ ] `TELEGRAM_BOT_TOKEN` sudah di-set (dari @BotFather)
- [ ] `TELEGRAM_CHAT_ID` sudah di-set (ID grup/channel)
- [ ] Test WhatsApp notification: buat pengaduan baru → cek WhatsApp admin
- [ ] Test Telegram notification: buat pengaduan baru → cek Telegram admin

---

## 🔐 2FA Checklist

- [ ] Super Admin sudah mengaktifkan 2FA di Settings
- [ ] Backup codes sudah disimpan di tempat aman
- [ ] Test login dengan 2FA: password → TOTP code → dashboard
- [ ] Test login dengan backup code: password → backup code → dashboard

---

## 📊 Monitoring Checklist

### Sentry (Error Tracking)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` sudah di-set
- [ ] `SENTRY_DSN` sudah di-set
- [ ] `SENTRY_AUTH_TOKEN` sudah di-set (untuk source map upload)
- [ ] Test error tracking: buat error → cek Sentry dashboard

### Health Endpoint
- [ ] `/api/health` bisa diakses
- [ ] Response JSON menunjukkan `status: "healthy"`
- [ ] Uptime monitoring sudah dikonfigurasi (UptimeRobot/Pingdom)
- [ ] Alert sudah diatur untuk downtime > 5 menit

### Log Aggregation (Loki/Grafana)
- [ ] `LOKI_URL` sudah di-set (jika pakai Loki)
- [ ] Docker Compose logging stack sudah jalan (jika self-hosted)
- [ ] Grafana dashboard sudah bisa diakses
- [ ] Log rotation sudah diatur (untuk mencegah disk penuh)

---

## 🌐 Web Server Checklist

### Nginx/Reverse Proxy
```nginx
server {
    listen 443 ssl http2;
    server_name sdn-mongisidi1.sch.id;

    ssl_certificate /etc/letsencrypt/live/sdn-mongisidi1.sch.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sdn-mongisidi1.sch.id/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] SSL certificate sudah terinstall (Let's Encrypt)
- [ ] Nginx/reverse proxy sudah dikonfigurasi
- [ ] HTTP → HTTPS redirect sudah aktif
- [ ] HSTS header sudah aktif
- [ ] CSP header sudah aktif

---

## 🚀 Deployment Options

### Option 1: Docker (Recommended)

```bash
# 1. Build image
docker build -t cms-monsa .

# 2. Run with docker-compose
docker compose up -d

# 3. Check logs
docker compose logs -f app
```

### Option 2: Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod

# 3. Set environment variables di Vercel dashboard
```

### Option 3: Self-Hosted (PM2)

```bash
# 1. Install PM2
npm install -g pm2

# 2. Start application
pm2 start npm --name "cms-monsa" -- start

# 3. Save PM2 config
pm2 save

# 4. Setup auto-start
pm2 startup
```

---

## ✅ Post-Deployment Verification

### Smoke Tests
- [ ] Homepage bisa diakses
- [ ] Login page bisa diakses
- [ ] Dashboard bisa diakses (setelah login)
- [ ] Public pages bisa diakses (news, teachers, gallery)
- [ ] Contact form bisa dikirim
- [ ] Complaint form bisa dikirim
- [ ] File upload bisa dilakukan (admin)
- [ ] Export CSV bisa dilakukan (admin)
- [ ] Export PDF bisa dilakukan (admin)

### API Tests
- [ ] `GET /api/health` → 200 OK
- [ ] `POST /api/auth/login` → 200 OK (valid credentials)
- [ ] `GET /api/news?scope=public` → 200 OK
- [ ] `GET /api/teachers?scope=public` → 200 OK
- [ ] `POST /api/complaints` → 200 OK (with valid data)
- [ ] `POST /api/contact` → 200 OK (with valid data)

### Security Tests
- [ ] Rate limiting aktif (try 20+ requests cepat)
- [ ] CSRF protection aktif (try POST tanpa token)
- [ ] RBAC aktif (try access admin page tanpa login)
- [ ] Session expiry aktif (try akses setelah 7 hari)

---

## 🔄 Rollback Plan

Jika ada masalah setelah deployment:

```bash
# 1. Stop current version
pm2 stop cms-monsa

# 2. Checkout previous version
git checkout <previous-commit-hash>

# 3. Rebuild
bun install
bun run build

# 4. Restart
pm2 start cms-monsa

# 5. Verify
curl https://sdn-mongisidi1.sch.id/api/health
```

---

## 📞 Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Developer | [Nama] | [Telepon/Email] |
| Admin | [Nama] | [Telepon/Email] |
| Hosting | [Provider] | [Support URL] |

---

## 📝 Notes

- **Backup**: Jalankan backup database setiap hari
- **Update**: Update dependencies setiap minggu (bun update)
- **Monitoring**: Cek Sentry dashboard setiap hari
- **Logs**: Cek Grafana dashboard setiap minggu
- **SSL**: Pastikan SSL certificate auto-renew aktif

---

*Checklist ini dibuat pada 22 Agustus 2026 untuk CMS MONSA v1.0.0*
