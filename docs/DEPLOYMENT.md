# Checklist Deployment Produksi — CMS MONSA

Dokumen ini adalah versi teknis dari checklist keamanan & produksi. Item yang
"Sudah tertanam di kode" tidak perlu dikerjakan manual, hanya dipastikan
konfigurasinya benar saat deploy.

## 🔴 WAJIB sebelum deploy

| No | Item | Status di kode | Langkah di server |
|----|------|----------------|-------------------|
| 1 | Debug / stack trace | Sudah aman. Kode tidak punya `APP_DEBUG`; Next.js produksi tidak menampilkan stack trace. | Set `APP_DEBUG="false"` di `.env.production` sebagai penanda. |
| 2 | Database PostgreSQL | `prisma/schema.postgres.prisma` siap. | Buat DB, isi `DATABASE_URL` di `.env.production`, jalankan `bun run db:migrate:prod`. |
| 3 | Session secret kuat | Sudah: `auth.ts` melempar error di produksi jika `AUTH_SECRET` kosong/default. | Set `AUTH_SECRET` random 64-hex (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). |
| 4 | HTTPS | HSTS `max-age=63072000; includeSubDomains; preload` sudah di `next.config.ts`; `Caddyfile` tersedia. | Pastikan Caddy/nginx dengan sertifikat valid; situs hanya bisa diakses via `https://`. |
| 5 | Backup database | Script: `bun run backup:db` (`scripts/backup-db.ps1` untuk Windows, `scripts/backup-db.sh` untuk Linux). | Pasang cron setiap 02.00 (contoh di bawah). |
| 6 | CORS `/api/*` | `src/proxy.ts` (`handleApiCors`, matcher `/api/:path*`): origin yang tidak dikenal → 403; allowlist via `ALLOWED_ORIGINS`. | Set `ALLOWED_ORIGINS` hanya jika ada frontend terpisah; default kosong = hanya same-origin. |
| 7 | Hapus kelas hanya SUPER_ADMIN | Sudah: `DELETE /api/classes/[id]` memakai `requireRole("SUPER_ADMIN")` + proteksi kelas berisi siswa. | Tidak perlu langkah tambahan. |
| 8 | Dapodik via HTTP di production | Guard HTTPS-only di `DapodikClient` + toggle `allowInsecureInProduction` (kolom baru di tabel `DapodikConfig`). | Setelah deploy: dashboard → **Dapodik → Konfigurasi → nyalakan "Izinkan HTTP di production"** bila Web Service Dapodik hanya diakses lewat HTTP lokal/VPN aman. Detail: bagian "Dapodik di produksi" di bawah. |

## Langkah deploy (ringkas)

```bash
# 1. Klon & install
bun install --frozen-lockfile
bunx prisma generate

# 2. Siapkan .env.production (lihat template di .env.example / .env.production)
#    - DATABASE_URL PostgreSQL
#    - AUTH_SECRET random
#    - ALLOWED_ORIGINS sesuai kebutuhan

# 3. Migrasi skema ke PostgreSQL
bun run db:migrate:prod
#    (migrasi prisma/migrations/*_add_dapodik_allow_insecure/ menambahkan
#     kolom allowInsecureInProduction di tabel DapodikConfig)

# 4. Seed akun awal (idempotent — hanya dijalankan sekali di DB kosong)
bun run db:seed

# 5. Build & start
bun run build
bun run start      # atau jalankan via pm2/systemd dengan output standalone: .next/standalone

# 6. HTTPS — Caddyfile sudah disediakan; sesuaikan domain.
```

## Dapodik di produksi: toggle "Izinkan HTTP" & migrasi kolom baru

Fitur penarikan data Dapodik memblokir koneksi HTTP di *production* secara
otomatis (guard HTTPS-only di `DapodikClient`). Karena Web Service Dapodik
hampir selalu diakses lewat HTTP (localhost / jaringan sekolah / VPN),
aktifkan eksplisit setelah deploy bila hanya diakses dari jaringan aman:

1. Login dashboard → **Dapodik** → **Penarikan Data Dapodik** → **Konfigurasi**.
2. Nyalakan toggle **Izinkan HTTP di production** → **Simpan Konfigurasi**.
3. Uji **Cek Koneksi**, lalu **Tarik Data** (endpoint siswa / guru / rombel).

> Jangan aktifkan bila Dapodik diakses dari internet publik — wajib HTTPS
> (mis. lewat reverse proxy Caddy) agar token & data siswa tidak bocor.

Migrasi kolom `allowInsecureInProduction` (tabel `DapodikConfig`):

- PostgreSQL (Docker / standalone): `bun run db:migrate:prod` — migrasi
  `prisma/migrations/*_add_dapodik_allow_insecure/` ikut diterapkan. Pada
  jalur Docker, migrasi dijalankan otomatis oleh container sebelum app start.
- SQLite (fallback dev): `bun run db:push`.

Verifikasi kolom sudah ada di DB (bukan error "kolom tidak ditemukan"):

```sql
SELECT "allowInsecureInProduction" FROM "DapodikConfig";
```

## Cron backup (contoh, tiap jam 02.00)

```bash
# Linux (crontab -e) — sesuaikan path dan DATABASE_URL
0 2 * * * cd /srv/cms-monsa && ./scripts/backup-db.sh >/dev/null 2>&1

# Windows Task Scheduler — jalankan:
#   powershell.exe -File C:\srv\cms-monsa\scripts\backup-db.ps1
```

Backup menyimpan `custom.db` (SQLite) atau dump `pg_dump` (PostgreSQL) +
`public/uploads/`, dengan rotasi otomatis menyimpan 14 backup terakhir.

## 🟡 Minggu pertama setelah deploy

1. **NIS unik** — sudah `@unique` di model `Student`; API `POST /api/students`
   mengembalikan 409 jika NIS duplikat. Tidak perlu tindakan.
2. **Kinerja absensi** — indeks `@@index([classId, date])` pada `Attendance`
   sudah ada; query GET memakainya. Kelas >50 siswa tetap aman.
3. **Role GURU** — aktif setelah migrasi `add_guru_role_and_guardian_class`:
   - Buat akun guru di Manajemen Operator dengan peran `GURU` dan pilih
     "Wali Kelas".
   - Guru hanya bisa mengisi absensi kelas wali-nya; menu lain disembunyikan.
4. **Laporan** — menu "Laporan" di dashboard: rekap absensi bulanan per siswa
   dan rekap pembayaran tahunan per bulan; siap cetak.
5. **Import CSV siswa** — di menu Data Siswa → "Import CSV" (kolom:
   NIS, Nama, NISN, Kelas, Jenis Kelamin, Orang Tua).

## 🟢 Rencana jangka panjang (belum dikerjakan)

- Modul Nilai & Rapor, Jadwal Pelajaran, Perpustakaan, Kehadiran Pegawai.
- Integrasi Dapodik, PWA, notifikasi email/WA pengingat pembayaran.

## Catatan verifikasi saat deploy

- `bun run test` → semua unit/integration test lulus.
- `bun run lint` → 0 error.
- `bun run build` → sukses (statis/dinamis terdaftar di output).
- Buka `/login` → login admin seed → cek menu baru (Kehadiran, Pembayaran,
  Laporan) dan uji guru: buat akun GURU → login → hanya menu Kehadiran.
