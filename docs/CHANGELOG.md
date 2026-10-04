# Changelog

Catatan perubahan terkurasi untuk CMS MONSA (SDN Mongisidi 1). Format mengikuti
kesan [Keep a Changelog](https://keepachangelog.com/); tanggal absolut, referensi
commit `git` agar bisa dilacak.

## [2026-10-01] — Start disamakan dengan `output: standalone`, env & compose

Awal sesi: gate kode hijau (tsc · eslint · markdownlint · 918 test) tetapi
aplikasi mati di runtime — Docker Desktop tidak jalan sehingga Postgres dev
`127.0.0.1:55433` ikut mati (`PrismaClientInitializationError: Can't reach
database server`). Database dihidupkan lagi, lalu tiga inkonsistensi
lingkungan dibersihkan dan gate dijalankan ulang — lulus penuh (`3ca06c8`).

### Diperbaiki

- **`bun run start` menabrak `output: standalone`** (`3ca06c8`) — `next start`
  pada build standalone pernah exit 255 (`.zscripts/dev.log.err`) dan Next
  tetap memperingatinya (`"next start" does not work with "output:
  standalone"`). `start` kini memanggil `scripts/start-standalone.mjs` yang
  menyiapkan lalu menyalakan `.next/standalone/server.js`:
  - link `.next/standalone/.next/static` → `.next/static` dan
    `.next/standalone/public` → `public/` — Next tidak menyalin `static`, dan
    dengan link itu `next dev`, `next start`, serta standalone berbagi SATU
    folder upload (spec `zz-server-restart-persistence` me-restart server
    lewat `next start`);
  - salin `.env*` root → folder standalone (Next memuat env dari dir server,
    bukan dari root repo);
  - sanitasi `HOSTNAME` — di Git Bash/CI nilainya nama mesin yang justru
    dipakai `server.js` sebagai alamat bind → dipaksa `0.0.0.0`;
  - `PORT` default 3000, sinyal dan exit code diteruskan, fallback
    `next start` bila build tanpa standalone, pesan jelas bila belum build.

  README dan `docs/DEPLOYMENT.md` disesuaikan: jangan menjalankan `server.js`
  langsung tanpa launcher — static dan upload tidak terhubung.
- **`bun run check:schema-migrations` selalu exit 1 `DATABASE_URL tidak
  diset`** (`3ca06c8`) — tsx tidak memuat file env apa pun, padahal Prisma CLI
  membaca `.env` sendiri. Skrip kini memuat `.env.local` lalu `.env` (urutan
  Next.js, env eksplisit tetap menang); DB `shadow` lokal dibuat sesuai syarat
  di docstring skrip, sehingga drift check benar-benar berjalan:
  `✅ Migrasi selaras dengan schema.prisma.`
- **`.env`: `DATABASE_URL="127.0.0.1"` (sisa era SQLite) → URL PostgreSQL dev**
  — `.env` gitignored sehingga perbaikan ini lokal dan tidak ikut commit,
  tetapi Prisma CLI hanya membaca `.env`; skema tunggal PostgreSQL sejak
  2026-08-28.
- **`docker compose -f docker-compose.dev.yml up -d` selalu gagal
  `container name is already in use`** (`3ca06c8`) — container
  `monsa-postgres-dev` lama dibuat lewat `docker run` (tanpa label compose) di
  volume `monsa-dev-db-data`, sementara compose menyangka volume miliknya
  `cmsmonsa_postgres-dev-data` yang ternyata kosong. Volume kini diberi
  `name: monsa-dev-db-data` eksplisit → `up -d` idempoten dan data dev tidak
  berpindah; dump pengaman tersimpan di
  `backups/cms_mongisidi_dev-pre-compose-fix-*.dump`.

## [2026-09-23] — Blok pasca-program P3 (ef0a683..c192958)

Program P0–P3 `docs/REKOMENDASI-PERBAIKAN-2026-09.md` sudah tutup di `cc1c7cb`;
blok ini adalah lanjutan lintas dua sesi (termasuk pekerjaan agen paralel yang
direview & diverifikasi manual). CI `c192958` hijau penuh — 8 check riil
termasuk 4 suite Playwright e2e (PR, next start, self-host compose, coexistence).

### Ditambahkan

- **Proteksi error per-handler untuk 7 rute mutasi tersisa** (`ed39387`) —
  `scripts/check-mutation-handlers.ts` kini memindai body tiap `POST/PUT/PATCH/DELETE`
  secara string/comment-aware (sebelumnya cukup ada kata `catch` di mana pun di
  file, sehingga 7 handler lolos tanpa proteksi). Kontrak "500 tersanitasi +
  tepat satu `logger.error`, tanpa bocor detail Prisma" diuji di
  `src/lib/__tests__/api/error-contract-new-routes.test.ts`.

### Diubah

- **32 rute API: `try/catch` inline → `withErrorHandling(X_impl)`** (`c192958`)
  — net −135 baris. `withErrorHandling` dapat opsi `errorMessage` untuk
  mempertahankan pesan 500 spesifik rute lama (22 pemakaian); sisanya kembali
  ke pesan generik tersanitasi.

### Diperbaiki

- **Ikon tab (favicon) lambat berubah setelah ganti logo** (`ef0a683`) —
  TTL `/api/favicon` 24 jam → 5 menit (`stale-while-revalidate` 24 jam).
- **Gambar dari URL eksternal isian admin pecah pasca-migrasi next/image**
  (`67413d6`) — komponen baru `src/components/shared/smart-image.tsx`:
  same-origin + host yang terdaftar di `images.remotePatterns` tetap lewat
  optimizer; host asing, `http:`, protocol-relative, dan `data:` otomatis
  `unoptimized` (URL mentah, perilaku sama seperti `<img>` pra-migrasi).
  Daftar host wrapper dikunci identik dengan `next.config.ts` oleh tes
  regresi. 15 komponen publik (termasuk `home-view.tsx` yang lebih dulu
  bermigrasi) hanya berganti baris import.
- **Selector e2e foto siswa** (`7a0febb`) — `img[src^='http']` tidak cocok
  lagi dengan rewrite `/_next/image`; kini menerima kedua bentuk.

### Optimalisasi

- **Migrasi `<img>` → `next/image` di 14 komponen publik** (`0cbfee9`) —
  format avif/webp, `sizes` responsif, `priority` untuk gambar pertama;
  melengkapi konfigurasi `images.remotePatterns` yang sebelumnya hanya
  terpasang di `next.config.ts`.
