# 🚚 Migrasi Vercel + Neon → Self-host (Docker + Caddy) tanpa downtime

> Dokumen rencana langkah-demi-langkah memindahkan CMS MONSA dari **Vercel
> (Hobby) + Neon (free tier)** ke server sendiri (VPS) dengan
> **Docker + Caddy**, tanpa jeda layanan untuk pengunjung.
>
> Terakhir diperbarui: 2026-09-08. Berlaku untuk repo CMS MONSA skema
> PostgreSQL tunggal (dev = produksi).

---

## Ringkasan strategi

Migrasi dilakukan dengan pola **dual-run + DNS flip**:

```
FASE 0-3    Vercel + Neon TETAP melayani publik  ──▶  server baru di-bootstrap
            (tidak ada perubahan apa pun)              paralel, data di-restore,
                                                       app diverifikasi via tunnel

FASE 4      Cutover: DNS dipindah ke VPS (TTL rendah)  ──▶  Caddy ambil alih TLS
            Pengunjung tidak pernah kehilangan akses

FASE 5      Vercel dibiarkan hidup beberapa hari sebagai rollback, lalu
            dinonaktifkan
```

Yang membuat cutover mulus (sudah tertanam di kode repo ini):

| Aspek | Kenapa mulus |
|-------|--------------|
| **Session** | Cookie session di-sign dengan `AUTH_SECRET`. **Pakai nilai yang sama** di self-host → semua user tetap login, tanpa re-login. |
| **Upload** | Backend storage dipilih otomatis (`src/lib/file-storage.ts`): self-host → disk (`public/uploads` volume), tapi `loadUpload` tetap fallback ke tabel `UploadedFile` — upload lama yang tersimpan di Neon tetap terlayani tanpa perubahan. |
| **Kunci pairing Jembatan** | `bridgeTokenHash` ikut termigrasi → aplikasi Jembatan di PC sekolah tetap terhubung, tanpa re-pairing. |
| **Domain** | `NEXT_PUBLIC_SITE_URL`/`SITE_DOMAIN` sama → email, sitemap, dan SEO tidak berubah. |
| **Migrasi DB** | Skema tunggal PostgreSQL; `pg_dump`/`pg_restore` antara Neon dan `postgres:16-alpine` kompatibel; migrasi skema dijalankan otomatis oleh entrypoint container. |

> **Jujur soal "tanpa downtime" data:** layanan (situs) tidak pernah mati,
> tetapi ada **jendela delta data** — data yang ditulis antara *dump terakhir*
> dan *DNS flip* tidak ikut serta serta-merta. Mitigasi: dump ulang final
> sesaat sebelum flip + lakukan cutover di jam sepi (mis. malam/akhir pekan).
> Untuk CMS sekolah, jendela ini praktis hanya beberapa entri formulir.

---

## Prasyarat

1. **VPS** (min. 1 vCPU / 1-2 GB RAM / 20 GB SSD — CMS sekolah kecil muat).
   Pilih region dekat sekolah (mis. Jakarta/Singapore) untuk latency Dapodik &
   pengunjung. Ubuntu 22.04/24.04 direkomendasikan.
2. **Docker + Docker Compose plugin** terinstall di VPS (langkah 3 di bawah).
3. **Domain** yang sudah dipakai di Vercel (`sdn-mongisidi1.sch.id`),
   dengan akses ke DNS provider (untuk pindah A record).
4. **Akses terminal** ke Vercel: `vercel env ls` (inventaris env) dan CLI
   `vercel` login.
5. **Neon**: connection string **direct (non-pooling)** — env
   `DATABASE_URL_DIRECT` di Vercel. `pg_dump` TIDAK boleh lewat pooled URL.
6. Port firewall VPS: **22, 80, 443** (80/443 untuk Caddy/Let's Encrypt).

---

## Fase 0 — Persiapan & inventaris (di mesin kerja, ±30–60 menit)

### 0.1 Cek ukuran data saat ini

```bash
# Jumlah upload & pemakaian storage (route monitoring — SUPER_ADMIN)
curl -H "Authorization: Bearer $CRON_SECRET" ... # atau
# buka https://<domain>/api/storage-usage setelah login admin, atau:
#   NEON_STORAGE_QUOTA_MB=512 bun run storage:usage  (dengan DATABASE_URL direct Neon)

# Ukuran dump kasar dari console Neon (Branching → ...) atau:
docker run --rm postgres:16-alpine \
  pg_dump "$NEON_DIRECT_URL" -F c -f - | wc -c   # perkiraan ukuran dump
```

Angka ini menentukan durasi Fase 2. CMS sekolah biasanya < 100 MB total.

### 0.2 Inventaris environment variables Vercel

```bash
vercel env ls            # lihat semua variabel Production/Preview
vercel env pull .env.vercel --environment=production   # unduh nilai (jangan di-commit!)
```

Bandingkan dengan template `.env.example`. Variabel yang harus **disalin
nilainya** ke server baru:

| Variabel | Catatan |
|----------|---------|
| `AUTH_SECRET` | **WAJIB sama persis** — menjaga session tetap valid |
| `NEXT_PUBLIC_SITE_URL` | Tetap `https://sdn-mongisidi1.sch.id` |
| `SMTP_*`, `ADMIN_EMAIL` | Salin; dipakai notifikasi & Let's Encrypt |
| `FONNTE_TOKEN`, `TELEGRAM_*` | Salin (opsional) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | Salin (opsional) |
| `ALLOWED_ORIGINS` | Sesuaikan — self-host tidak butuh kecuali ada frontend terpisah |
| `DATABASE_URL_DIRECT` | Hanya dipakai sementara untuk pg_dump (Fase 2), **bukan** di server |

Variabel yang **tidak perlu dipindah**: `NEON_API_KEY`, `NEON_PROJECT_ID`
(hanya untuk cron backup Neon), `REDIS_URL` (bisa di-set baru di Fase 5).

### 0.3 Siapkan nilai baru

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 24)   # kuat, wajib (compose menolak kosong)
```

### 0.4 Turunkan TTL DNS sebelum cutover (penting!)

Di DNS provider, set TTL record `sdn-mongisidi1.sch.id` menjadi **300 detik
(5 menit)** minimal 24 jam sebelum Fase 4 — agar flip DNS cepat propagasi.

---

## Fase 1 — Bootstrap server (di VPS, ±30 menit — tidak mengganggu Vercel)

### 1.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER    # logout/login agar berlaku
# Compose plugin sudah termasuk; cek:
docker compose version
```

### 1.2 Clone repo & buat .env

```bash
sudo mkdir -p /srv/cms-monsa && sudo chown $USER /srv/cms-monsa
git clone https://github.com/amhyer/cms-monsa.git /srv/cms-monsa
cd /srv/cms-monsa
cp .env.example .env
```

Isi `.env` (nilai dari Fase 0). **`POSTGRES_PASSWORD` tidak ada di
`.env.example`** (hanya dipakai `docker-compose.yml`) — tambahkan manual:

```bash
# Wajib (compose GAGAL tanpa ini)
POSTGRES_PASSWORD="<dari 0.3>"
AUTH_SECRET="<SAMA dengan Vercel — kunci session>"

# Domain & Let's Encrypt
SITE_DOMAIN="sdn-mongisidi1.sch.id"
NEXT_PUBLIC_SITE_URL="https://sdn-mongisidi1.sch.id"
ADMIN_EMAIL="admin@contoh.sch.id"

# Opsional: SMTP, WhatsApp/Telegram, Sentry, Loki, ALLOWED_ORIGINS, MAX_UPLOAD_MB
```

> `DATABASE_URL` **tidak** perlu diisi manual — `docker-compose.yml`
> menyusunnya dari `POSTGRES_PASSWORD` + service `postgres`.

### 1.3 Start database saja dulu

```bash
docker compose up -d postgres
docker compose ps postgres          # tunggu status healthy
```

---

## Fase 2 — Migrasi data (Neon → Postgres lokal, ±30–60 menit; Vercel tetap jalan)

### 2.1 Dump dari Neon (menggunakan koneksi DIRECT)

Gunakan container `postgres:16-alpine` agar versi `pg_dump` cocok dengan
server lokal. **Cek versi Postgres Neon dulu** (console Neon → Settings);
kalau Neon 17, ganti image ke `postgres:17-alpine`.

```bash
mkdir -p /tmp/migrate
# Ganti $NEON_DIRECT_URL dengan nilai DATABASE_URL_DIRECT dari Vercel
docker run --rm -v /tmp/migrate:/dump postgres:16-alpine \
  pg_dump "$NEON_DIRECT_URL" -F c -f /dump/cms.dump
ls -lh /tmp/migrate/cms.dump
```

> Jangan pakai pooled URL Neon untuk pg_dump — koneksi pooling tidak cocok
> untuk session panjang `pg_dump`.

### 2.2 Restore ke Postgres lokal

```bash
docker compose exec -T postgres \
  pg_restore -U postgres -d cms_mongisidi --no-owner --no-privileges \
  - < /tmp/migrate/cms.dump
```

> `--no-owner/--no-privileges`: mengabaikan owner/role dari Neon (user lokal
> `postgres` dipakai untuk semua).

### 2.3 Verifikasi data

```bash
docker compose exec postgres psql -U postgres -d cms_mongisidi -c \
  'SELECT (SELECT count(*) FROM "News") AS news, (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "UploadedFile") AS uploads;'
```

Bandingkan dengan angka di Vercel/Neon. Tabel penting: `User`, `News`,
`UploadedFile`, `DapodikConfig` (berisi `bridgeTokenHash` — kunci pairing
jembatan), `SiteSetting`, `BosDocument`, `ActivityLog`.

---

## Fase 3 — Jalankan app + verifikasi pra-cutover (±1–2 jam; Vercel tetap melayani)

### 3.1 Start app (base compose dulu, tanpa Caddy)

```bash
# Bind app ke localhost saja untuk pengujian via SSH tunnel
APP_PORT=127.0.0.1:3000 docker compose up -d app
docker compose ps
docker compose logs -f app    # tunggu "Ready" (entrypoint menjalankan prisma migrate deploy dulu)
```

### 3.2 Verifikasi via SSH tunnel (tanpa menyentuh DNS)

Dari mesin kerja:

```bash
ssh -L 3000:127.0.0.1:3000 user@<VPS-IP>
# lalu di browser: http://localhost:3000
```

Checklist uji (semua harus lolos **sebelum** cutover):

- [ ] `http://localhost:3000/api/health` → `{ status:"healthy", checks:{ db:{ ok:true, ... } } }`
- [ ] `/login` → login dengan akun SUPER_ADMIN lama (session valid karena
      `AUTH_SECRET` sama; coba juga akun OPERATOR/GURU)
- [ ] Halaman publik: `/`, `/berita`, `/guru`, `/transparansi` (data hasil
      restore tampil)
- [ ] **Upload**: unggah gambar → cek file muncul di
      `public/uploads` volume (`docker compose exec app ls /app/public/uploads`)
- [ ] **Upload lama masih terlayani**: buka salah satu URL `/uploads/<file>` yang
      ada di tabel `UploadedFile` (fallback DB bekerja)
- [ ] Dapodik: dashboard → Penarikan Dapodik → kunci pairing masih tampil
      (tidak perlu regenerate)

### 3.3 Simpulkan stack produksi (belum di-up, hanya disiapkan)

```bash
# Validasi Caddyfile dulu (tanpa start)
docker compose -f docker-compose.yml -f docker-compose.ssl.yml config > /dev/null && echo OK
```

---

## Fase 4 — Cutover (DNS flip, ±10–15 menit layanan; tanpa jeda bagi pengunjung)

> Jam sepi disarankan (malam hari / akhir pekan). Siapkan `rollback` di
> bagian akhir dokumen ini sebelum mulai.

### 4.1 Dump + restore final (delta terakhir)

```bash
# Ulangi 2.1 + 2.2 — menggantikan snapshot lama dengan data ~sekarang
docker run --rm -v /tmp/migrate:/dump postgres:16-alpine \
  pg_dump "$NEON_DIRECT_URL" -F c -f /dump/cms-final.dump
docker compose exec -T postgres \
  pg_restore -U postgres -d cms_mongisidi --clean --if-exists --no-owner --no-privileges \
  - < /tmp/migrate/cms-final.dump
```

> `--clean --if-exists`: drop objek lama dulu agar tidak duplikat. Jendela
> delta = waktu antara dump ini dan DNS flip (menit) — minimal karena CMS
> sekolah volume tulisnya kecil.

### 4.2 Start stack penuh (Caddy + app)

```bash
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d
docker compose ps
docker compose logs -f caddy    # tunggu "certificate obtained successfully"
```

### 4.3 Pindah DNS

1. Di DNS provider, ubah **A record** `sdn-mongisidi1.sch.id` (dan `www`
   bila ada) → **IP VPS**.
2. Tunggu propagasi: cek di beberapa resolver
   ([dnschecker.org](https://dnschecker.org)) sampai mayoritas menunjuk IP baru.
3. Verifikasi live:

```bash
curl -I https://sdn-mongisidi1.sch.id/api/health
curl -fs https://sdn-mongisidi1.sch.id/api/health
# cek sertifikat Let's Encrypt otomatis
echo | openssl s_client -connect sdn-mongisidi1.sch.id:443 -servername sdn-mongisidi1.sch.id 2>/dev/null | grep -i "subject=\|issuer="
```

4. Uji end-to-end dari HP/PC lain (cache DNS bersih): login, buka berita,
   upload 1 file, cek `/uploads/...` lama.

### 4.4 Kembalikan TTL ke nilai normal (mis. 3600) setelah stabil

---

## Fase 5 — Operasi pasca-cutover (±1 jam + observasi 1–2 minggu)

### 5.1 Aktifkan cron backup (pg_dump + uploads)

```bash
docker compose -f docker-compose.yml -f docker-compose.ssl.yml -f docker-compose.cron.yml up -d
docker compose ps cron
```

Container `cron` menjalankan `scripts/backup-db.sh` tiap **02.00 Asia/Makassar**
(`TZ` dari env), rotasi 14 backup, menyimpan `db-*.sql` + `uploads-*.tar.gz`
ke volume `backups-data`.

> **Ganti cron Vercel:** cron `/api/cron/backup` (Neon branch) tidak relevan
> lagi — hapus dari `vercel.json` di repo bila Vercel dipertahankan sebagai
> rollback, atau nonaktifkan project Vercel (Fase 5.4).

### 5.2 (Opsional) Pembersihan upload lama di self-host

> ⚠️ **Penting**: di Vercel, upload lama hanya ada di tabel `UploadedFile`.
> Di self-host, file baru masuk ke disk, tapi **file lama tetap dilayani via
> fallback DB** (`loadUpload`). Jangan menyalakan `UPLOAD_RETENTION_DAYS`
> sebelum file-file lama diekspor ke disk atau dinyatakan boleh dihapus —
> kalau tidak, konten lama akan 404.

Dua pilihan:
- **Pertahankan fallback DB** (tanpa kerja): biarkan `UPLOAD_RETENTION_DAYS`
  kosong/`0` di self-host. Upload lama tetap tampil; hanya menyita storage
  DB lokal (murah).
- **Pindah penuh ke disk** (disarankan untuk jangka panjang): tulis script
  sekali-jalan yang membaca `UploadedFile` → tulis ke `public/uploads`
  (menggunakan `size`/`data`), lalu boleh aktifkan cleanup. (Script belum
  tersedia di repo — gap yang bisa ditambahkan.)

### 5.3 (Opsional) Redis untuk rate limiting persisten

Self-host default memakai rate limiter in-memory (reset saat restart).
Aktifkan profil Redis:

```bash
# .env
REDIS_URL="redis://redis:6379"

docker compose -f docker-compose.yml -f docker-compose.ssl.yml --profile with-redis up -d redis
```

### 5.4 Observasi & matikan Vercel

1. Biarkan Vercel hidup **1–2 minggu** sebagai rollback (tidak ada biaya di
   Hobby selama tidak melebihi kuota).
2. Pantau: `docker compose logs -f app` (error 5xx), `/api/health`,
   uptime monitor eksternal (UptimeRobot/dll), storage disk VPS
   (`df -h`, `docker system df`).
3. Setelah stabil: hapus project Vercel + branch Neon (atau downgrade), dan
   hapus cron dari `vercel.json`.

### 5.5 Keuntungan self-host yang kini aktif

- **Auto-sync Dapodik scheduler** (`src/instrumentation.ts`) berjalan
  andal — proses server selalu hidup (di Vercel serverless tidak bisa
  diandalkan). Aktifkan di dashboard: Dapodik → Konfigurasi → Auto-sync.
- Upload tidak lagi makan kuota Neon; tidak ada batas 4 MB Vercel
  (bisa naik via `MAX_UPLOAD_MB`).
- Satu "paket" penuh: DB + backup + cron di satu server.

---

## Rollback (kapan pun sebelum Vercel dinonaktifkan)

```bash
# 1. Balikkan DNS A record ke Vercel (IP/alias dari dashboard Vercel Domains)
#    → Caddy berhenti menerima traffic, Vercel melayani lagi (≤ TTL menit)

# 2. Opsional: matikan stack
docker compose -f docker-compose.yml -f docker-compose.ssl.yml down
```

**Keterbatasan rollback:** data yang ditulis di self-host sejak cutover tidak
otomatis kembali ke Neon — mitos "rollback instan" tidak berlaku untuk data.
Mitigasi: backup harian sudah jalan (Fase 5.1); bila perlu, restore dump
terakhir ke Neon sebelum mengembalikan DNS.

---

## Checklist ringkas per fase

| Fase | Selesai bila ... |
|------|------------------|
| 0 | Env terinventaris, TTL sudah 300s ≥ 24 jam, `AUTH_SECRET` dicatat |
| 1 | `docker compose ps postgres` → healthy |
| 2 | Jumlah baris `User`/`News`/`UploadedFile` lokal = Neon |
| 3 | Semua checklist uji 3.2 lolos via SSH tunnel |
| 4 | `curl -I https://domain/api/health` → 200 + sertifikat valid |
| 5 | Backup cron jalan, observasi 1–2 minggu, Vercel nonaktif |

## Troubleshooting cepat

| Gejala | Solusi |
|--------|--------|
| `pg_restore: error: role "xxx" does not exist` | Wajar — pakai `--no-owner --no-privileges` |
| Caddy tidak dapat sertifikat | DNS belum menunjuk VPS / port 80 tertutup / TTL lama masih cache → `docker compose logs caddy` |
| Login admin gagal setelah cutover | `AUTH_SECRET` berbeda dari Vercel — samakan |
| Upload baru 404 | Cek volume: `docker compose exec app ls /app/public/uploads` |
| `/api/health` → `checks.db.ok:false` | `docker compose logs postgres`; pastikan `POSTGRES_PASSWORD` sama dengan saat init volume (bila volume sudah dibuat dengan password lain, hapus volume: `docker compose down -v` lalu ulang Fase 1.3+2) |
| Banyak 5xx saat beban | Naikkan resource VPS; pastikan `MAX_UPLOAD_MB`/`APP_PORT` sesuai; aktifkan Redis (5.3) |

---

## Lampiran — env `.env` lengkap yang direkomendasikan di server

```bash
# ── Wajib ──────────────────────────────────────────────
POSTGRES_PASSWORD="<random-kuat>"
AUTH_SECRET="<SAMA dengan Vercel>"
SITE_DOMAIN="sdn-mongisidi1.sch.id"
NEXT_PUBLIC_SITE_URL="https://sdn-mongisidi1.sch.id"
ADMIN_EMAIL="admin@contoh.sch.id"

# ── Opsional (salin dari Vercel) ──────────────────────
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="CMS MONSA <noreply@sdn-mongisidi1.sch.id>"
FONNTE_TOKEN=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...
LOKI_URL=...
ALLOWED_ORIGINS=""

# ── Khusus self-host ───────────────────────────────────
# REDIS_URL="redis://redis:6379"          # kalau pakai --profile with-redis
# MAX_UPLOAD_MB=15                        # opsional, naikkan dari 5/15 default
# UPLOAD_RETENTION_DAYS=0                 # JANGAN nyalakan dulu — lihat 5.2
# RUN_MIGRATIONS=true                     # default; false bila multi-instance app
# TZ=Asia/Makassar                        # dipakai container cron
```