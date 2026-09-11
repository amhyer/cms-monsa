# 🛠 Runbook — Baseline Database Neon Produksi (`prisma migrate resolve`)

> Tujuan: menyerahkan skema database **Neon produksi** yang dibangun lewat
> `prisma db push` kepada alur `prisma migrate deploy` — tanpa downtime dan
> tanpa menyentuh data.
>
> Status prosedur: **divalidasi end-to-end terhadap Postgres 16 nyata**
> (simulasi DB db-pushed + data) pada 2026-09-10 — lihat lampiran di bawah.
>
> Dibuat: 10 September 2026

---

## Latar belakang

Database produksi saat ini dibuat dengan `prisma db push` (evolusi skema
langsung dari `schema.prisma`), sedangkan jalur deploy resmi —
`deploy-vercel.yml`, entrypoint Docker, dan panduan migrasi — menjalankan
`prisma migrate deploy`, yang membangun skema dari **file migrasi**.

Akibatnya, `migrate deploy` menolak menyentuh database ini:

```
Error: P3005: The database schema is not empty...
```

`prisma migrate resolve --applied` menandai migrasi sebagai *sudah diterapkan*
(hanya menulis buku besar `_prisma_migrations` — **tidak menjalankan SQL apa
pun**), sehingga `migrate deploy` selanjutnya menjadi no-op yang aman.

> **Fakta penting (terverifikasi):** `migrate resolve` **tidak memvalidasi
> apa pun** — ia berhasil diam-diam bahkan di database kosong. Kesalahan
> baseline di database yang salah tidak terdeteksi sampai `migrate deploy`
> mengabaikan migrasi yang sebenarnya belum jalan. Karena itu Langkah 3
> (paritas) adalah gerbang wajib, bukan opsional.

> **Hubungan dengan drift gate CI** (`bun run check:schema-migrations`):
> keduanya check yang BERBEDA dan tidak saling menggantikan. Drift gate
> membandingkan **file migrasi vs `schema.prisma`** (membebani repo, lolos
> di DB mana pun — terverifikasi lolos di DB db-pushed). Paritas di runbook
> ini membandingkan **database produksi vs `schema.prisma`** (membebani DB
> nyata). Gate CI hijau ≠ database produksi selaras; keduanya harus diperiksa.

## Prasyarat (semua wajib)

1. **Backup**: `pg_dump` database Neon (lihat
   `docs/MIGRATION-VERCEL-TO-SELFHOST.md` §backup, atau
   `scripts/backup-db.sh`). Simpan di luar mesin kerja.
2. **Satu operator** selama jendela kerja — tidak ada `db push`, deploy, atau
   edit skema lain bersamaan.
3. **Repo di state yang benar**: `bun run check:schema-migrations` hijau di
   commit yang dipakai (riwayat migrasi selaras dengan schema.prisma —
   sejak migrasi `20260908000001_reconcile_schema_drift`).
4. **Kredensial**: `DATABASE_URL` produksi Neon (koneksi langsung, bukan
   pooled/PG bouncer untuk prisma migrate resolve).

## Langkah

### Langkah 0 — Identifikasi kondisi awal

```bash
export DATABASE_URL="<connection-string-neon-produksi>"

bunx prisma migrate status
```

**Kondisi yang mengkonfirmasi runbook ini berlaku** (DB db-pushed, belum
pernah di-baseline):

- Ada teks `P3005` ATAU daftar panjang `Following migrations have not yet
  been applied:` yang menyebut seluruh riwayat (dari `20260808000000_init`
  sampai migrasi terakhir di `prisma/migrations/`).
- `bunx prisma db pull` sudah pernah dipakai sebelumnya terhadap DB ini
  tanpa menghasilkan diff (artinya skema DB pernah selaras dengan schema).

Bila `migrate status` justru melapor `Database schema is up to date!`,
database **sudah** dikelola migrasi — berhenti, jangan resolve ulang.

### Langkah 1 — Backup (jangan dilewati)

```bash
pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f neon-prod-$(date +%Y%m%d-%H%M).dump
```

Verifikasi file tidak kosong dan bisa dibaca: `pg_restore --list`.

### Langkah 2 — Bekukan perubahan skema

Selama baseline berlangsung (± 10 menit kerja aktif): tidak ada deploy, tidak
ada `db push`, tidak ada merge yang menyentuh `prisma/`. Kebijakan satu
operator (prasyarat 2).

### Langkah 3 — Gerbang paritas: database vs `schema.prisma` (WAJIB)

Diff **database nyata** terhadap skema. Kosong = DB identik dengan skema =
aman di-baseline.

```bash
bunx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Lulus**: keluaran hanya

```
-- This is an empty migration.
```

**Tidak lulus** (ada DDL lain): database TIDAK identik dengan skema.
Jangan resolve. Simpan keluarannya, lalu:

- Jika selisihnya ADITIF (DB kekurangan objek): jalankan SQL keluaran tersebut
  terhadap database (review dulu, pastikan hanya `CREATE`/`ADD`), ulangi
  Langkah 3 sampai kosong, baru lanjut.
- Jika selisihnya DESTRUKTIF (DB punya objek yang tidak ada di skema — tabel
  sisa eksperimen, kolom lama): jangan jalankan diff-nya sebagai SQL.
  Kumpulkan kasusnya, putuskan satu per satu (drop manual yang aman ATAU
  tambahkan ke `schema.prisma` lewat PR), ulangi Langkah 3.

### Langkah 4 — Hitung daftar migrasi

```bash
ls prisma/migrations | grep -v toml
```

17 direktori migrasi (per 2026-09-11), dari `20260808000000_init` sampai
`20260911000000_add_storage_alert_last_tested`. Angka ini dipakai untuk
verifikasi di Langkah 7 — update bila riwayat sudah bertambah.

### Langkah 5 — Tandai seluruh riwayat sebagai applied

```bash
bunx prisma migrate resolve --applied 20260808000000_init
```

Lalu sisanya (loop aman untuk shell — urutan abjad = urutan timestamp):

```bash
for d in $(ls prisma/migrations | grep -v toml | grep -v 20260808000000_init); do
  bunx prisma migrate resolve --applied "$d"
done
```

Keluaran yang benar per migrasi: `Migration <nama> marked as applied.`
Pada Prisma 6.19 masing-masing perintah membuat koneksi sendiri (± 2–4 detik);
16 migrasi ≈ 1 menit. **Tidak ada SQL skema yang dijalankan** — hanya baris
buku besar.

### Langkah 6 — Verifikasi status

```bash
bunx prisma migrate status
```

**Wajib**: `Database schema is up to date!` — tanpa daftar pending.

### Langkah 7 — Bukti tak ada yang rusak (empat cek)

```bash
# 1. migrate deploy kini NO-OP (keluaran "No pending migrations", exit 0)
bunx prisma migrate deploy; echo "exit=$?"

# 2. Jumlah baris di buku besar = jumlah migrasi (16 per Langkah 4)
psql "$DATABASE_URL" -tAc 'select count(*) from "_prisma_migrations"'
#    dan tidak ada yang gagal/di-rollback:
psql "$DATABASE_URL" -tAc \
  'select count(*) from "_prisma_migrations" where finished_at is null or rolled_back_at is not null'

# 3. Paritas tetap kosong setelah baseline
bunx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# 4. Data utuh (bandingkan dengan catatan sebelum baseline)
psql "$DATABASE_URL" -tAc 'select count(*) from "User"'
```

**Lulus semuanya** = baseline selesai. `migrate deploy` (deploy-vercel.yml,
entrypoint Docker) kini memiliki kendali penuh atas skema database ini.

### Langkah 8 — Catat

Tulis di log operasional: tanggal, commit repo (hash), nilai `count(*)`
`_prisma_migrations`, hasil Langkah 3/7, dan nama file backup.

## Pemulihan bila salah

**Gejala baseline di database yang salah** (misal ter-resolve padahal DB
belum punya skema): `migrate status` dan `migrate deploy` laporan hijau, tetapi
database nyata kekurangan tabel/kolom (cek cepat: `psql -tAc "select count(*)
from information_schema.tables where table_schema='public'"` — DB sehat punya
± 40 tabel; hanya `_prisma_migrations` + satu-dua lainnya = salah baseline).

> **`migrate resolve --rolled-back` TIDAK BISA** membatalkan baseline —
> Prisma 6 menolak dengan `P3012: Migration ... cannot be rolled back because
> it is not in a failed state` (terverifikasi). Pemulihan yang benar:

```bash
# Hapus buku besar baseline → database kembali ke kondisi P3005 (pra-baseline)
psql "$DATABASE_URL" -c 'DELETE FROM "_prisma_migrations"'

# Konfirmasi kondisi kembali (muncul "Following migrations have not yet been applied:")
bunx prisma migrate status

# Ulangi runbook dari Langkah 3 (paritas) dengan DATABASE_URL yang benar
```

DELETE ini hanya menghapus buku besar — tidak menyentuh data aplikasi.

## Setelah baseline: aturan main

- Perubahan skema **hanya** lewat `prisma migrate dev` di PR (bukan `db push`)
  — CI (ci.yml + deploy-vercel.yml) kini mem-blok drift, dan setelah baseline
  ini `db push` juga bisa membuat DB produksi menyimpang dari riwayat migrasi.
- `prisma db pull` ke database produksi **tidak diperlukan lagi** (sebelumnya
  itu satu-satunya cara sinkronisasi skema).
- Cron backup DB tetap wajib — baseline tidak menggantikan backup.

---

## Lampiran — Log validasi prosedur (2026-09-10)

Prosedur di atas dijalankan utuh terhadap simulasi database produksi di
Postgres 16 (Docker lokal), bukan sekadar disusun dari dokumentasi:

| # | Uji | Hasil |
|---|-----|-------|
| 1 | Simulasi: DB kosong + `prisma db push` + data (1 User, 1 News) | DB db-pushed siap |
| 2 | `migrate deploy` pra-baseline | **P3005** (dipersilakan) |
| 3 | Drift gate CI di DB db-pushed | ✅ lolos (membuktikan gate ≠ paritas DB) |
| 4 | `migrate diff` from-url → to-schema-datamodel | `-- This is an empty migration.` |
| 5 | `resolve --applied` init + 15 sisanya | 16× `marked as applied.` |
| 6 | `migrate status` pasca-baseline | `Database schema is up to date!` |
| 7 | `migrate deploy` pasca-baseline | `No pending migrations to apply.`, exit 0 |
| 8 | Data pasca-baseline | 1 User / 1 News — utuh |
| 9 | Paritas pasca-baseline | tetap kosong |
| 10 | Baseline di DB kosong (negatif) | resolve diam-diam berhasil → deploy "hijau" padahal DB 2 tabel (bahaya tervalidasi) |
| 11 | Undo dengan `--rolled-back` | **P3012** — tidak bisa (harus DELETE buku besar) |
| 12 | Pemulihan via `DELETE FROM "_prisma_migrations"` | kembali ke kondisi `Following migrations have not yet been applied:` |

Prisma CLI saat validasi: **6.19.3**. Jalankan ulang uji 2–12 bila versi
Prisma di-upgrade major sebelum runbook ini dipakai.
