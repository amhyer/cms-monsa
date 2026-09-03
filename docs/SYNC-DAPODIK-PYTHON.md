# Python Dapodik Sync (per-modul)

Script Python untuk menarik data dari Dapodik Web Service lokal dan mengirimkannya ke CMS Vercel **per modul** (sekolah, gtk, rombel, peserta_didik), masing-masing dengan penanda `dataType` — sehingga tiap request kecil (1-2 detik), aman dari batas waktu Vercel Hobby, dan jika satu modul gagal modul lain tetap aman.

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

**Catatan:** `VERCEL_SYNC_URL` menunjuk ke `/api/dapodik/ingest` — **bukan** `/api/dapodik/sync` (endpoint itu dipakai dashboard untuk tarik langsung dengan sesi admin). Arsip otomatis diarahkan ke `/api/dapodik/archive`.

## Penggunaan

```bash
# Sync penuh: sekolah -> gtk -> rombel -> peserta_didik (lalu arsip)
python scripts/sync_dapodik.py

# Preview tanpa menulis ke database
python scripts/sync_dapodik.py --dry-run

# Hanya satu modul (tanpa fase arsip)
python scripts/sync_dapodik.py --module gtk
python scripts/sync_dapodik.py --module peserta_didik
python scripts/sync_dapodik.py --module rombel
python scripts/sync_dapodik.py --module sekolah

# Ukuran batch lebih kecil (jika request masih lama)
python scripts/sync_dapodik.py --batch-size 25

# Lewati pengarsipan
python scripts/sync_dapodik.py --no-archive

# Test koneksi ke CMS
python scripts/sync_dapodik.py --ping
```

## Alur & Keamanan Data

1. **sekolah** dikirim sebagai objek tunggal `{ dataType: "sekolah", payload: {...} }` — satu-satunya modul yang meng-update identitas sekolah.
2. **gtk / rombel / peserta_didik** dikirim per batch (default 50 item).
3. Setiap modul parsial otomatis diproses server dengan `archiveUnlisted: false` — **tidak ada data modul lain yang ikut terarsip**.
4. Setelah semua modul sukses, script memanggil `POST /api/dapodik/archive` dengan daftar ID lengkap untuk mengarsipkan data yang sudah tidak ada di Dapodik.

## Test Endpoint Secara Independen

```bash
# Kirim satu modul (sekolah)
curl -X POST https://your-domain.vercel.app/api/dapodik/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SYNC_SECRET_KEY" \
  -d '{"dataType":"sekolah","payload":{"nama":"SD Negeri 1","npsn":"40313912"}}'

# Kirim satu batch peserta_didik
curl -X POST https://your-domain.vercel.app/api/dapodik/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SYNC_SECRET_KEY" \
  -d '{"dataType":"peserta_didik","payload":[{"peserta_didik_id":"pd-1","nama":"Budi"}]}'

# Test tanpa auth (harus 401)
curl -X POST https://your-domain.vercel.app/api/dapodik/ingest \
  -H "Content-Type: application/json" \
  -d '{"dataType":"sekolah","payload":{"nama":"X","npsn":"1"}}'

# Fase arsip (daftar ID lengkap yang MASIH ADA di Dapodik)
curl -X POST https://your-domain.vercel.app/api/dapodik/archive \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SYNC_SECRET_KEY" \
  -d '{"pesertaDidikIds":["pd-1","pd-2"],"gtkIds":["1234567890"]}'
```

## Troubleshooting

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `Tidak bisa terhubung ke Dapodik WS` | Dapodik tidak berjalan | Buka Aplikasi Dapodik → hidupkan Web Service |
| `HTTP 403 — Token salah` | Aplikasi belum terdaftar | Dapodik → Pengaturan → Web Services → Tambah |
| `Auth gagal (401)` | SYNC_SECRET_KEY salah | Cek `VERCEL_SYNC_URL` dan `SYNC_SECRET_KEY` |
| `SYNC_SECRET_KEY belum diatur` | Env var belum di-set di Vercel | Dashboard Vercel → Settings → Env Variables |
| `HTTP 504 FUNCTION_INVOCATION_TIMEOUT` | Request masih terlalu besar | Turunkan `--batch-size` (mis. 25) |
| `dataType tidak dikenal` | Nama modul salah | Pakai: `sekolah` / `gtk` / `rombel` / `peserta_didik` |
