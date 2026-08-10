# Panduan Menjalankan Project — CMS MONSA

Panduan praktis untuk menjalankan **CMS MONSA** (UPT SPF SD Negeri Unggulan
Mongisidi 1) dari nol: instalasi, konfigurasi, database, development, hingga
deploy & backup.

> Selengkapnya: [README.md](../README.md) (arsitektur & fitur),
> [docs/ARCHITECTURE.md](ARCHITECTURE.md) (arsitektur internal),
> [DEPLOYMENT.md](../DEPLOYMENT.md) (deploy produksi).

---

## 1. Prasyarat

Tabel (Node >= 20.9.0 — paket `engines`), **bun** (paket kanonik, lockfile
`bun.lock`), Git. opsional:

| Alat | Kebutuhan |
|------|-----------|
| Node.js | >= 20.9.0 |
| bun | package manager (wajib per lockfile) |
| Git | menclone repository |
| Docker | opsional — deploy container |

Periksa versi:

```bash
node -v   # >= v20.9.0
bun --version
```

Catatan: semua perintah `bun run ...` setara dengan `npm run ...` — tetapi
sebaiknya tetap memakai bun agar hasil sama dengan `bun.lock`.

---

## 2. Instalasi

```bash
# 1) Clone repository
git clone <repository-url>
cd "CMS MONSA"

# 2) Pasang dependencies
bun install

# 3) Aktifkan pre-commit hook (sekali per clone)
bun run hooks:install
```

`bun install` otomatis menjalankan `prisma generate` (postinstall).

---

## 3. Konfigurasi Environment

Salin template lalu isi nilai yang diperlukan:

```bash
copy .env.example .env   # Windows (CMD)
# atau: powershell Copy-Item .env.example .env
# atau: cp .env.example .env (Linux/macOS)
```

Minimal isi di `.env`:

| Variable | Contoh (dev) | Keterangan |
|----------|--------------|------------|
| `DATABASE_URL` | `file:./db/custom.db` | SQLite lokal (mudah untuk dev) |
| `AUTH_SECRET` | *random 64 hex* | wajib — logout/sesi tidak aman tanpa ini |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | SEO & email |

Generate secret aman:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Untuk **produksi** pakai PostgreSQL, contoh:

```env
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/cms_mongisidi?schema=public"
```

Jangan pernah commit `.env` — sudah diblokir oleh pre-commit hook.

---

## 4. Siapkan Database

### Development (SQLite — paling mudah)

```bash
bun run db:push      # push schema.prisma ke db/kustom.db
bun run db:generate  # generate Prisma client (biasanya otomatis)
bun run db:seed      # seed contoh (dilewati bila DB sudah terisi)
```

### Produksi (PostgreSQL)

```bash
bun run db:generate
bun run db:migrate:deploy   # prisma migrate deploy -schema postgres
```

> Ada **dua** file schema: `prisma/schema.prisma` (SQLite/dev) dan
> `prisma/schema.postgres.prisma` (PostgreSQL). Keduanya harus tetap
> sinkron — dicek otomatis dengan `bun run check:schema`.

---

## 5. Menjalankan Development Server

```bash
bun run dev
```

Buka **http://localhost:3000**.

- Website publik: `/` (beranda), `news`, `gallery`, `academic`, ...
- Dashboard admin: **/dashboard** (login dulu)

Ganti port jika 3000 terpakai: `next dev -p 3100`.

---

## 6. Akun Login Default (hasil seed)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@mongisidi1.sch.id` | `admin123` |
| Operator | `operator@mongisidi1.sch.id` | `operator123` |

> **Ganti password segera setelah login pertama** (menu Pengaturan/Users).

---

## 7. Sinkronisasi Dapodik (fitur penarikan data)

CMS bisa menarik data guru/staf & siswa langsung dari server Dapodik sekolah:

1. Login ke dashboard (`/dashboard`).
2. Buka menu **Dapodik** → **Sinkronisasi / Penarikan Data**.
3. Isi URL server Dapodik (mis. `http://ip-server:5774`) & kredensial.
4. Opsi: aktifkan retry/timeout (default aktif), opsi *jangan nonaktifkan
   data yang tidak ada di Dapodik* (disarankan aktif).
5. Bila Web Service Dapodik diakses lewat HTTP (localhost / jaringan
   sekolah / VPN) pada *deployment production*, nyalakan toggle
   **Izinkan HTTP di production** di kartu Konfigurasi. Tanpa ini guard
   HTTPS-only memblokir semua koneksi HTTP di production. Aktifkan hanya
   untuk jaringan lokal/VPN yang sudah aman — untuk akses internet
   publik gunakan HTTPS.
6. Klik **Sinkronkan Sekarang**. Setelah selesai, data guru/staf aktif & siswa terisi.
7. Kepala Sekolah & jabatan lainnya langsung terbaca dari
   `jabatan_ptk_id_str` — termasuk pada kartu **Data Guru**.

Detail pemetaan field: [DAPODIK_SYNC_MAPPING.md](../DAPODIK_SYNC_MAPPING.md).

Catatan masalah: bila sinkronisasi gagal padahal server Dapodik online,
pastikan migrasi DB sudah jalan — kolom baru seperti `dapodikId` dan
`allowInsecureInProduction` (tabel `DapodikConfig`) harus ada di database:

- SQLite (development): `bun run db:push`
- PostgreSQL (produksi): `bun run db:migrate:deploy`
  (migrasi `prisma/migrations/*_add_dapodik_allow_insecure/` menambahkan
  kolom `allowInsecureInProduction` dengan default `false`)

Bila migrasi sudah jalan tapi penarikan tetap gagal, cek log error di
dashboard — umumnya kredensial/token salah, IP belum di-whitelist, atau
server Dapodik sedang "tidak terhubung dengan database".

---

## 8. Validasi Kode (before push)

Gerbang tunggal:

```bash
bun run check
```

Menjalankan berurutan: `typecheck` → `lint` → `lint:md` → `check:schema` → `test`.
Perintah terpisah bila ingin langkah spesifik:

```bash
bun run typecheck    # tsc --noEmit
bun run lint         # ESLint
bun run lint:md      # markdownlint (fence & tautan relatif)
bun run check:schema # schema.prisma vs schema.postgres.prisma
bun run test         # Vitest (unit/integration)
bun run test:e2e     # Playwright (bila diinginkan)
```

---

## 9. Production Build & Jalankan

### Standalone (tanpa Docker)

```bash
bun run build
bun run start        # listen port 3000
```

Atau dengan reverse proxy (Caddy):

```bash
bunx caddy run --config Caddyfile   # proxy :8080 → :3000
```

### Docker Compose (termasuk PostgreSQL)

```bash
# Production dasar (app + postgres)
docker compose up -d --build

# + SSL (Caddy)            : docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d
# + Cron backup harian 02:00: docker compose -f docker-compose.yml -f docker-compose.cron.yml up -d

docker compose logs -f
docker compose down        # stop
docker compose down -v     # stop + hapus volume DB (HATI-HATI)
```

Dengan Docker, migrasi PostgreSQL dijalankan otomatis oleh container
(`prisma migrate deploy`) sebelum aplikasi start. Detail: [DEPLOYMENT.md](../DEPLOYMENT.md),
[DEPLOYMENT_SSL.md](../DEPLOYMENT_SSL.md), [VERCEL_DEPLOYMENT.md](../VERCEL_DEPLOYMENT.md).

---

## 10. Backup & Restore

Backup otomatis (14 hari rotasi), jalankan manual:

```bash
# Windows PowerShell
powershell.exe -ExecutionPolicy Bypass -File scripts\backup-db.ps1

# Linux/macOS
./scripts/backup-db.sh

# Di dalam container
docker compose exec cron /app/scripts/backup-db.sh
```

Hasil di folder `backups/`: dump database (`db-*.sql` / `db-*.db`) +
arsip `public/uploads/`. Cara restore — lihat [scripts/BACKUP.md](../scripts/BACKUP.md).
Backup PostgreSQL memakai `pg_dump`, sehingga kompatibel antar environment.

---

## 11. Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| `prisma generate` error **EPERM** di Windows | `next dev` sedang berjalan dan mengunci engine — stop dev server, generate, lalu jalankan lagi |
| Port 3000 sudah terpakai | pakai port lain: `bun run dev -- -p 3100` atau ubah di `package.json` |
| Data Dapodik tidak muncul namanya | pastikan langkah sinkronisasi selesai penuh & `db:push` sudah jalan; cek `logs` dashboard |
| Penarikan Dapodik error *"HTTP tidak diizinkan di production"* | nyalakan toggle **Izinkan HTTP di production** di menu Dapodik → Konfigurasi (khusus jaringan lokal/VPN aman), simpan, lalu coba lagi |
| Status server Dapodik "tidak terhubung database" | Itu pesan dari server Dapodik sendiri — pastikan server Dapodik punya DB & trik & kredensial benar |
| Skema error *undefined* `nik`/`dapodikId` | Client prisma belum di-generate: `bun run db:generate` |
| Login gagal / versi app lama | `bun run check` lalu ulangi build |
| Dokumen markdown ditolak (commit) | `bun run lint:md` punya rule khusus: tautan relatif harus ada & fence harus seimbang |

---

## Referensi Cepat

| Aksi | Perintah |
|------|----------|
| Dev server | `bun run dev` |
| Build produksi | `bun run build` |
| Generate Prisma | `bun run db:generate` |
| Migrasi dev (SQLite) | `bun run db:push` |
| Jalankan produksi | `bun run start` |
| Validasi lengkap | `bun run check` |
| Test unit | `bun run test` |
| Backup DB | `bun run backup:db` |