# Dapodik Sync Health & Alerting — Desain

- **Tanggal**: 2026-10-04
- **Status**: Disetujui di sesi brainstorming; menunggu review spec
- **Arus**: #1 dari dekomposisi roadmap (Dapodik sync → Portal orang tua → PPDB online → Engagement)

## Latar belakang

Dapodik sync sudah jalan dan dipakai, tetapi kegagalannya **tidak terpantau**.
Sync gagal diam-diam dan baru disadari berminggu-minggu kemudian — data siswa,
GTK, dan rombel bisa basi tanpa ada yang tahu.

Dua mode kegagalan yang berbeda harus ditutup:

1. **Gagal nyata** — sync berjalan lalu error (timeout, transaksi, payload
   tidak valid). Status terakhir memang tersimpan di `DapodikConfig`
   (`autoSyncLastStatus`, `autoSyncLastError`), tetapi tidak ada yang memberi
   tahu manusia.
2. **Gagal senyap tanpa error** — PC sekolah mati, Aplikasi Dapodik tidak
   dibuka, atau service `cloudflared` berhenti. CMS tidak menerima apa pun,
   tidak ada error yang tercatat; satu-satunya gejala adalah data yang makin
   basi (`lastSyncAt` tidak pernah maju). Mode ini tidak tertangani sama
   sekali hari ini.

## Tujuan

- Setiap kegagalan sync mengirim alert ke admin via **WhatsApp + Telegram +
  Email** (kanal yang dipilih user).
- Data basi melewati ambang terdeteksi oleh cron harian dan menghasilkan alert
  dengan aturan dedupe yang sama.
- Operator bisa memercayai sistem: riwayat sync terlihat di dashboard, dan
  banner "data basi" tampil saat kondisi menyalahi ambang.
- Semua alert memakai pola anti-spam yang sudah terbukti di `storage-alert`
  (lihat [storage-alert.ts](../../../src/lib/storage-alert.ts)): satu alert per
  periode kegagalan, reset saat pulih.

## Non-tujuan (YAGNI)

- Push "sync pulih kembali" saat berhasil setelah gagal — cukup reset state;
  pemulihan terlihat di riwayat.
- Rule alerting Grafana/Loki — bisa menyusul sebagai tambahan, bukan
  pengganti (hanya hidup di stack self-host dan tidak menutup mode data-basi).
- Retry otomatis sync.
- Perubahan apa pun di aplikasi jembatan (`dapodik-jembatan/`) — bridge `.exe`
  tidak perlu diunduh ulang; semua perubahan murni backend CMS.

## Arsitektur

### Komponen baru

1. **Tabel `DapodikSyncLog`** (Prisma, [schema.prisma](../../../prisma/schema.prisma))
   — satu baris per run sinkronisasi:

   | Field | Tipe | Isi |
   |---|---|---|
   | `id` | String @id | cuid |
   | `mode` | String | `AUTO` \| `MANUAL` \| `INGEST` \| `ARCHIVE` |
   | `dataType` | String? | untuk `INGEST` per-modul: `sekolah` \| `gtk` \| `rombel` \| `peserta_didik` \| `archive` |
   | `status` | String | `OK` \| `ERROR` |
   | `actor` | String? | userId, atau `bridge` / `scheduler` / `cron` |
   | `sekolahCount` `gtkCount` `rombelCount` `siswaCount` | Int | jumlah baris yang di-upsert/update per modul; untuk `ARCHIVE`: jumlah yang diarsipkan |
   | `durationMs` | Int? | durasi run |
   | `error` | String? | pesan tersanitasi, dipotong 500 karakter |
   | `createdAt` | DateTime | default now |

   Index: `@@index([createdAt])`, `@@index([status, createdAt])`.

   Pruning: setiap insert, baris di luar **200 terbaru** dihapus (satu
   `deleteMany` murah, tidak butuh cron terpisah).

   Dry-run **tidak** dicatat (tidak menulis DB, konsisten dengan semantik
   dry-run di [docs/dapodik-sync-transactions.md](../../dapodik-sync-transactions.md)).

2. **Tabel `DapodikSyncAlertState`** (singleton, tiruan `StorageAlertState`):

   | Field | Tipe | Isi |
   |---|---|---|
   | `id` | String @id | `"singleton"` |
   | `alertOpen` | Boolean | ada kegagalan/staleness yang belum pulih |
   | `reason` | String? | `sync-error` \| `stale` |
   | `detail` | String? | ringkasan singkat untuk banner |
   | `lastAlertedAt` | DateTime? | kirim alert terakhir |
   | `updatedAt` | DateTime @updatedAt | |

   Singleton tahan cold-start Vercel — dedupe tidak boleh memakai variabel
   in-memory (pola yang sama dianjurkan di `storage-alert.ts`).

3. **Modul `src/lib/dapodik-sync-alert.ts`** — dua fungsi publik:
   - `recordSyncRun(input)` — menulis `DapodikSyncLog`, memangkas lama,
     meng-update field `lastSyncAt` / `lastSyncBy` di `DapodikConfig` saat
     sukses (konsolidasi update yang mungkin selama ini tersebar di beberapa
     route — perilaku akhir identik), dan memicu alert kegagalan saat
     `status = ERROR`.
   - `checkSyncFreshness()` — membaca `DapodikConfig` + state, memutuskan
     kirim/jangan kirim alert staleness; dipakai cron.

### Titik hook (jalur sync yang ada)

- **Sukses**: satu hook di `applyDapodikPayload()` ([dapodik-sync/plan.ts](../../../src/lib/dapodik-sync/plan.ts))
  menutup semua jalur commit (`/api/dapodik/sync`, `pull`, `ingest`,
  `auto-sync`). `mode` diteruskan dari pemanggil; `dataType` diisi untuk jalur
  per-modul. Route `archive` memanggil hook sendiri dengan `mode: ARCHIVE`.
- **Gagal**: `catch` di setiap pemanggil + `catch` scheduler auto-sync
  ([dapodik-scheduler.ts](../../../src/lib/dapodik-scheduler.ts)) memanggil
  `recordSyncRun({ status: "ERROR", error })`.
- `recordSyncRun()` dibungkus try/catch dan **tidak boleh pernah membuat sync
  gagal** — kegagalan pencatatan hanya log error.

### Kanal notifikasi

`notifyAdmin()` ([notifications.ts](../../../src/lib/notifications.ts)) diperluas
dengan kanal **email** (nodemailer + SMTP yang sudah dikonfigurasi, tujuan
`ADMIN_EMAIL`):

- Signature tetap `notifyAdmin(message)`; return bertambah `email: boolean`
  (pemanggil existing tidak berubah perilaku).
- Email kirim paralel dengan WhatsApp/Telegram; gagal kirim hanya warn di log
  (fire-and-forget, konsisten dengan kanal lain).
- Tombol "Uji Kirim Alert" existing (`/api/notifications/test-alert`) otomatis
  ikut menguji kanal email karena kanalnya dibagi — tidak perlu tombol baru.

### Cron staleness harian

- Route baru `GET /api/cron/dapodik-sync-alert`, auth `CRON_SECRET` sama
  dengan cron lain (pola `GET /api/cron/storage-alert` — Vercel Cron mengirim
  `Authorization: Bearer $CRON_SECRET` otomatis; runner self-host
  `scripts/cron-job.sh` memakai semantik yang sama).
- Terdaftar di `vercel.json` sebagai `30 19 * * *` (03.30 WITA, setelah
  `storage-alert`), plus entri curl harian di `docker-compose.cron.yml` untuk
  deployment self-host.
- Logika `checkSyncFreshness()`:

  | Kondisi | Aksi |
  |---|---|
  | Konfigurasi Dapodik kosong (belum ada NPSN/token) | tidak aktif, tidak alert |
  | `DAPODIK_SYNC_ALERT_ENABLED=0` | tidak aktif |
  | `alertOpen = true` | dedupe — tidak kirim ulang |
  | `autoSyncLastStatus = "ERROR"` dan belum ada sync sukses setelahnya | kirim alert (`reason: sync-error`) — backstop bila push langsung gagal terkirim (mis. kanal belum dikonfigurasi) |
  | `lastSyncAt` lebih tua dari ambang staleness | kirim alert (`reason: stale`) |
  | sehat | reset `alertOpen = false` |

- Ambang staleness (jam):
  - `DAPODIK_SYNC_STALE_HOURS` diset → pakai nilai itu.
  - Jika tidak: `autoSyncEnabled` → `max(2 × autoSyncIntervalHours, 48)`.
  - Jika tidak (mode manual-only) → `168` (7 hari).
- Alert staleness menyertakan umur data ("terakhir sinkron N hari lalu") dan
  hint operasional (PC sekolah menyala? Aplikasi Dapodik + Web Service aktif?
  service `cloudflared` berjalan?).

### Dashboard

- **Banner** di beranda dashboard (`/dashboard`), hanya untuk SUPER_ADMIN dan
  OPERATOR (GURU tidak melihat):
  - `alertOpen` dengan `reason: stale` → "⚠️ Data Dapodik basi N hari —
    terakhir sinkron <tanggal>".
  - `reason: sync-error` → "⚠️ Sync Dapodik terakhir gagal — <detail singkat>".
  - Sumber baca: `DapodikSyncAlertState` + `DapodikConfig` (tanpa query baru
    yang berat).
- **Panel riwayat** di halaman Dapodik (`dapodik-manager.tsx`): 20 run
  terakhir (waktu, mode/dataType, status, hitungan, durasi, error ringkas) +
  tombol refresh. API baru `GET /api/dapodik/sync-logs` (auth SUPER_ADMIN/
  OPERATOR, ambil 20 baris terbaru).

## Pesan alert

Format konsisten dengan notifikasi pengaduan yang ada (Bahasa Indonesia,
Markdown ringan yang aman di WhatsApp dan Telegram):

```text
🚨 *Sync Dapodik GAGAL*

Mode   : AUTO (scheduler)
Waktu  : 04/10/2026 03.30 WITA
Error  : <pesan tersanitasi, maks 300 char>

Cek: PC sekolah menyala? Aplikasi Dapodik + Web Service aktif?
Service cloudflared berjalan?

— CMS MONSA
```

Pesan staleness memakai kerangka yang sama dengan baris `Umur data : N hari`.

## Error handling

- Semua pengiriman notifikasi fire-and-forget — kegagalan kanal tidak pernah
  mempengaruhi respons sync maupun cron.
- `error` di log dan pesan alert melalui sanitizer yang sama dengan
  `dapodik-ingest-error.ts`: tanpa stack trace, connection string, token
  Dapodik, atau kunci pairing.
- Cron dan `recordSyncRun()` idempoten — aman dipanggil ulang kapan pun.

## Testing

| Lapis | Yang diuji | Lokasi |
|---|---|---|
| Unit | `recordSyncRun`: log + prune 200 + update `lastSyncAt` saat sukses | `src/lib/__tests__/dapodik-sync-alert.test.ts` |
| Unit | Dedupe: kirim sekali per periode gagal; reset saat sync OK; reason berganti → kirim | idem |
| Unit | Ambang staleness: env override, auto `max(2×interval, 48)`, manual-only 168, config kosong → nonaktif | idem |
| Unit | Kanal email `notifyAdmin` (mock nodemailer; gagal SMTP hanya warn) | `src/lib/__tests__/notifications.test.ts` (diperluas) |
| Unit | Sanitasi error di log & pesan | `dapodik-sync-alert.test.ts` |
| Integration | Cron route: sehat → diam + reset; ERROR → kirim; stale → kirim; dedupe antar-panggilan; auth CRON_SECRET | `src/lib/__tests__/api/cron-dapodik-sync-alert.test.ts` |
| E2E | Banner muncul saat state `stale` (fixture), hilang setelah reset; panel riwayat tampil; `GET /api/dapodik/sync-logs` ber-auth | `e2e/dapodik-sync-health.spec.ts` |

E2E spec baru wajib mengikuti konvensi repo: pragma `// warmup:` untuk rute
API yang dimutasi, protokol CSRF via `GET /api/csrf-token` untuk
`page.request` (lihat [DAPODIK-CREDENTIAL-PROTOCOL.md](../../DAPODIK-CREDENTIAL-PROTOCOL.md)),
dan cleanup `afterEach` yang gagal keras bila restore tidak 2xx.

## Env vars baru

| Var | Wajib? | Default | Fungsi |
|---|---|---|---|
| `DAPODIK_SYNC_STALE_HOURS` | tidak | turunan interval (lihat tabel ambang) | override ambang staleness |
| `DAPODIK_SYNC_ALERT_ENABLED` | tidak | aktif | `0` mematikan alert (mis. environment dev) |

SMTP email memakai var existing (`SMTP_*`, `ADMIN_EMAIL`) — tidak ada var baru
untuk kanal email.

## Migrasi & gate

- Dua model baru masuk `prisma/schema.prisma` (satu skema untuk dev/CI/produksi)
  lewat `prisma migrate` — gate `check:schema-migrations` wajib tetap hijau.
- `bun run check` (typecheck + eslint + markdownlint + mutation-handler guard +
  vitest) adalah gerbang commit; rute cron baru otomatis ikut guard
  `check-mutation-handlers`.

## Kriteria selesai

1. Sync gagal (semua jalur) menghasilkan satu alert WhatsApp + Telegram +
   email; tidak berulang sampai ada sync sukses.
2. Data basi melewati ambang menghasilkan alert dari cron harian.
3. Banner status tampil di dashboard untuk admin/operator dan hilang saat
   sehat.
4. Riwayat 20 run terakhir terlihat di halaman Dapodik.
5. `bun run check` dan suite E2E hijau, termasuk test baru di atas.
6. Jembatan `.exe` tidak berubah — tidak ada yang perlu diunduh ulang di PC
   sekolah.
