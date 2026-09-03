# Python Dapodik Sync Bridge

Script Python untuk menarik data dari Dapodik Web Service lokal dan mengirimkannya ke CMS yang di-deploy di Vercel.

## Persiapan

```bash
pip install requests
```

Buat file `.env.local` di root project (atau set via shell):

```env
DAPODIK_BASE_URL=http://localhost:5774/WebService
DAPODIK_TOKEN=token-dari-dapodik
NPSN=40313912
VERCEL_SYNC_URL=https://cms-monsa-l7qg.vercel.app/api/dapodik/ingest
SYNC_SECRET_KEY=sama-dengan-yang-di-vercel
```

## Penggunaan

```bash
# Sync penuh (semua data)
python scripts/sync_dapodik.py

# Preview tanpa menulis ke database
python scripts/sync_dapodik.py --dry-run

# Chunk lebih kecil (jika tetap kena timeout)
python scripts/sync_dapodik.py --batch-size 50

# Lewati pengarsipan data yang tidak muncul lagi
python scripts/sync_dapodik.py --no-archive

# Tarik data tertentu saja
python scripts/sync_dapodik.py --endpoint siswa
python scripts/sync_dapodik.py --endpoint gtk
python scripts/sync_dapodik.py --endpoint rombel
python scripts/sync_dapodik.py --endpoint sekolah

# Test koneksi ke CMS
python scripts/sync_dapodik.py --ping
```

## Kenapa Berchunk?

Fungsi serverless Vercel (plan Hobby) punya batas waktu eksekusi ~10 detik. Payload besar (200+ siswa) bisa kena `HTTP 504 FUNCTION_INVOCATION_TIMEOUT`. Script ini mengirim data dalam beberapa request kecil (default 100 siswa/request), lalu di akhir memanggil `POST /api/dapodik/archive` dengan daftar ID lengkap untuk mengarsipkan data yang sudah tidak ada di Dapodik. Jika tetap kena timeout, kecilkan dengan `--batch-size 50` atau `--batch-size 25`.

## Test Endpoint Secara Independen

```bash
# Test dengan curl (valid)
curl -X POST https://your-domain.vercel.app/api/dapodik/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SYNC_SECRET_KEY" \
  -d '{"sekolah":{"nama":"SD Test","npsn":"40313912"},"siswa":[],"gtk":[],"rombel":[]}'

# Test tanpa auth (harus 401)
curl -X POST https://your-domain.vercel.app/api/dapodik/ingest \
  -H "Content-Type: application/json" \
  -d '{"sekolah":{"nama":"X","npsn":"1"}}'

# Dry run (preview)
curl -X POST "https://your-domain.vercel.app/api/dapodik/ingest?mode=dry-run" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SYNC_SECRET_KEY" \
  -d '{"sekolah":{"nama":"SD Test","npsn":"40313912"},"siswa":[],"gtk":[],"rombel":[]}'
```

## Troubleshooting

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `Tidak bisa terhubung ke Dapodik WS` | Dapodik tidak berjalan | Buka Aplikasi Dapodik → hidupkan Web Service |
| `HTTP 403 — Token salah` | Aplikasi belum terdaftar | Dapodik → Pengaturan → Web Services → Tambah |
| `Auth gagal (401)` | SYNC_SECRET_KEY salah | Cek `VERCEL_SYNC_URL` dan `SYNC_SECRET_KEY` |
| `SYNC_SECRET_KEY belum diatur` | Env var belum di-set di Vercel | Dashboard Vercel → Settings → Env Variables |
| `HTTP 504 FUNCTION_INVOCATION_TIMEOUT` | Payload terlalu besar untuk batas waktu Vercel | Turunkan `--batch-size` (mis. 50) — data otomatis di-chunk |
