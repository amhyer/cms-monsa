# POST /api/dapodik/ingest

Menerima push data Dapodik dari script Python lokal atau aplikasi jembatan, lalu menulis ke database.

## Setup

1. Generate secret key:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Set `SYNC_SECRET_KEY` di **Vercel** (Settings → Environment Variables) atau `.env.local` untuk development.

## Auth

Kirim header `x-api-key` dengan nilai `SYNC_SECRET_KEY`:

```bash
curl -X POST https://your-domain.vercel.app/api/dapodik/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SYNC_SECRET_KEY" \
  -d '{
    "sekolah": {"nama": "SD Negeri 1", "npsn": "40313912"},
    "siswa": [{"peserta_didik_id": "pd-001", "nama": "Budi", "nisn": "00123"}],
    "gtk": [{"nama": "Siti Aminah", "nuptk": "1234567890"}],
    "rombel": [{"rombongan_belajar_id": "rb-001", "nama": "1A"}]
  }'
```

Alternatif: gunakan `Authorization: Bearer <bridge-token>` (kunci pairing dari dashboard CMS).

## Response

| Status | Arti |
|--------|------|
| `200` | Data diterima dan diproses |
| `400` | Body JSON tidak valid |
| `401` | `x-api-key` salah atau tidak ada |
| `500` | `SYNC_SECRET_KEY` belum diatur di server |

Query param `?mode=dry-run` untuk preview tanpa menulis ke database.

## POST /api/dapodik/archive

Mengarsipkan siswa/guru yang **tidak muncul lagi** di Dapodik. Dipanggil **setelah** semua chunk data terkirim. Autentikasi sama (`x-api-key` atau Bearer). Body: `{ "pesertaDidikIds": [...], "gtkIds": [...] }` — daftar lengkap ID yang ADA di Dapodik. Respons cepat (2-3 query): `{ "success": true, "siswaArchived": n, "gtkArchived": n }`.
