# Panduan Migrasi SQLite → PostgreSQL

Dokumen ini menjelaskan cara beralih dari SQLite (development) ke PostgreSQL (production) untuk website SD Negeri Unggulan Mongisidi 1.

## Kenapa Migrasi?

SQLite cocok untuk development, tapi **tidak ideal untuk production** karena:
- Tidak mendukung concurrent writes dengan baik (operator + admin edit bersamaan bisa lock)
- Tidak ada replication / backup hot
- File-based — hilang saat redeploy di serverless (Vercel, dll)
- Tidak scalable untuk ratusan siswa/data

PostgreSQL menyelesaikan semua ini dan adalah standar industry.

## Prasyarat

- PostgreSQL 14+ terinstall, ATAU akun managed PostgreSQL:
  - **Supabase** (gratis, recommended) — https://supabase.com
  - **Neon** (gratis, serverless) — https://neon.tech
  - **Railway** (gratis $5 credit) — https://railway.app
- Connection string format: `postgresql://user:password@host:port/dbname?schema=public`

## Langkah Migrasi

### 1. Setup Database PostgreSQL

Buat database baru di provider pilihan Anda. Catat connection string.

### 2. Generate AUTH_SECRET

```bash
openssl rand -hex 32
```

Simpan nilai ini — jangan pernah commit ke repo.

### 3. Update Environment Variables

Buat file `.env` (atau set di hosting dashboard):

```env
AUTH_SECRET=<nilai-dari-langkah-2>
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
```

### 4. Switch Schema

```bash
# Backup schema SQLite (jaga-jaga)
cp prisma/schema.prisma prisma/schema.sqlite.bak

# Gunakan schema PostgreSQL
cp prisma/schema.postgres.prisma prisma/schema.prisma
```

### 5. Generate Migration & Push Schema

```bash
# Generate Prisma Client untuk PostgreSQL
bun run db:generate

# Buat migration awal (membuat semua tabel)
bun run db:migrate dev --name init

# ATAU jika database kosong dan mau langsung push:
bun run db:push
```

### 6. Seed Data Awal

```bash
bun run prisma/seed.ts
```

Ini akan mengisi data sekolah, berita contoh, guru, dll.

### 7. Verifikasi

```bash
# Start dev server
bun run dev

# Cek di browser — login sebagai admin:
# Email: admin@mongisidi1.sch.id
# Password: admin123
```

## Migrasi Data Existing (Opsional)

Jika Anda sudah punya data di SQLite yang ingin dipindahkan:

### Opsi A: Export-Import Manual

```bash
# 1. Export dari SQLite (gunakan sqlite3 CLI atau DB browser)
sqlite3 db/custom.db ".dump" > backup.sql

# 2. Konversi format SQLite → PostgreSQL (beberapa syntax beda)
#    - Hapus baris yang tidak kompatibel
#    - Ubah AUTOINCREMENT → SERIAL
#    - Gunakan tools seperti pgloader (https://pgloader.io)

# 3. Import ke PostgreSQL
psql "$DATABASE_URL" < converted_backup.sql
```

### Opsi B: Script Custom (Recommended)

Buat script Node.js yang baca dari SQLite lalu insert ke PostgreSQL:

```typescript
// scripts/migrate-sqlite-to-postgres.ts
import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";

const sqlite = new Database("db/custom.db");
const pg = new PrismaClient();

// Contoh: migrasi User
const users = sqlite.prepare("SELECT * FROM User").all();
for (const u of users) {
  await pg.user.create({ data: u });
}
// Ulangi untuk semua tabel...
```

## Rollback (Jika Ada Masalah)

```bash
# Kembali ke SQLite
cp prisma/schema.sqlite.bak prisma/schema.prisma
bun run db:generate
bun run db:push

# Restore .env DATABASE_URL ke SQLite
# DATABASE_URL="file:./db/custom.db"
```

## Checklist Post-Migration

- [ ] `AUTH_SECRET` sudah set (bukan fallback dev)
- [ ] Database connection string benar
- [ ] `bun run db:migrate dev --name init` berhasil
- [ ] `bun run prisma/seed.ts` berhasil
- [ ] Login admin berfungsi
- [ ] CRUD berita/pengumuman/guru berfungsi
- [ ] Upload gambar berfungsi
- [ ] Backup database terjadwal (pg_dump cron atau managed backup)

## Hosting Recommendations

| Provider | Database | Free Tier | Notes |
|---|---|---|---|
| **Supabase** | PostgreSQL | 500MB, 2 proj | Recommended — dashboard bagus, auto backup |
| **Neon** | PostgreSQL | 3GB, 1 proj | Serverless, branching untuk dev/staging |
| **Railway** | PostgreSQL | $5 credit | Simple, good for small projects |
| **Vercel + Supabase** | PostgreSQL | Combined free | Vercel untuk Next.js, Supabase untuk DB |

## Backup Strategy (Production)

```bash
# Daily backup via cron (tambahkan ke crontab):
0 2 * * * pg_dump "$DATABASE_URL" | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz

# Retain 30 days:
0 3 * * * find /backups -name "db-*.sql.gz" -mtime +30 -delete
```

Atau gunakan managed backup dari provider (Supabase/Neon punya ini built-in).
