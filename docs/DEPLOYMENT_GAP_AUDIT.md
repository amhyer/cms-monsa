# Audit Kekurangan untuk Deployment — CMS MONSA

> Audit: 27 Agustus 2026 · Scope: kesiapan deploy jalur **Vercel + Neon** dan **Docker/self-host**.
> Metode: penelusuran konfigurasi (Dockerfile, docker-compose*, vercel.json, next.config.ts,
> .env.example, CI, scripts) + verifikasi silang dokumen vs kode.
>
> **✅ STATUS PERBAIKAN (28 Agustus 2026): SEMUA temuan KRITIKAL (K1–K6) dan
> SEDANG (S1–S5) telah diperbaiki**, plus sebagian besar item minor:
> - **P0 ✅ (permintaan pemilik repo): konsolidasi ke SATU skema PostgreSQL.**
>   SQLite dev dihapus — `prisma/schema.prisma` kini PostgreSQL untuk semua
>   environment (dev lokal via branch Neon `dev` / docker-compose.dev.yml,
>   CI via service container, produksi via Neon main). Dev = produksi,
>   tidak ada lagi dual-schema drift. `schema.postgres.prisma` & guard
>   `check:schema` dihapus.
> - **C0 ✅ (ditemukan saat pembuatan PR — CI rusak sejak commit c92ca77 di
>   main, semua workflow gagal instan)**: composite action lokal
>   `.github/actions/setup-repo` dipakai sebagai step pertama job tanpa
>   checkout — runner me-resolve action lokal dari workspace yang masih
>   kosong → "Can't find 'action.yml' under setup-repo". Fix: checkout
>   eksplisit `actions/checkout@v4` sebelum setiap pemakaian action lokal
>   (7 titik di 5 workflow), checkout internal composite dihapus.
> - K1 ✅ `.dockerignore`/Dockerfile tidak lagi kontradiktif (pola `scripts/*` + pengecualian)
>   **+ bug tambahan ditemukan saat perbaikan: bun tidak ter-install di stage
>   builder** (hanya di stage deps) sehingga `bun run build` gagal — telah diperbaiki.
> - K2 ✅ `docker-compose.ssl.yml` & `docker-compose.cron.yml` ditulis ulang (nama service/volume/network benar, dependensi sirkular dihapus).
> - K3 ✅ Container cron kini memakai image `postgres:16-alpine` (pg_dump + crond tersedia).
> - K4 ✅ Upload persist: volume `uploads-data` di Docker; di Vercel otomatis disimpan ke tabel `UploadedFile` + route serve `/uploads/[...path]` (`src/lib/file-storage.ts`).
> - K5 ✅ Batas upload sadar-platform: 4 MB di Vercel (limit platform 4,5 MB), 5/15 MB self-host (`MAX_UPLOAD_MB` untuk override).
> - K6 ✅ Entrypoint Docker menjalankan `prisma migrate deploy` sebelum start (`RUN_MIGRATIONS`).
> - S1 ✅ Password Postgres wajib (compose gagal tanpa `.env`); port DB/Redis bind 127.0.0.1.
> - S2 ✅ Dockerfile builder kini men-set env dummy build seperti CI.
> - S3 ✅ `vercel.json` dibersihkan (header duplikat/kontradiktif & rewrite no-op dihapus).
> - S4 ✅ Cron Vercel `0 18 * * *` = 02.00 WITA (sebelumnya 02.00 UTC = 09.00 WITA).
> - S5 ✅ `.env.example` tidak lagi meng-carry password seed default.
> - M1 ✅ README Deployment diperbarui; M2 ✅ path SQLite + env backup script;
>   M3/M4 ✅ `.dockerignore` menutup `dapodik-client/` & `public/uploads/`;
>   M5 ✅ dokumentasi upload di VERCEL_DEPLOYMENT/CHECKLIST.
> - Belum dikerjakan (backlog): M6 migrasi `package.json#prisma` → `prisma.config.ts`
>   (Prisma 7), staging/preview env formal.
>
> Verifikasi: 565 unit test lulus + 19 test baru (`file-storage.test.ts`),
> `check:schema` sinkron, typecheck bersih (tanpa error baru), YAML/skrip tervalidasi.

## Ringkasan

Kode aplikasi intinya **sudah matang**: CI lengkap (typecheck → lint → 562 unit test → build),
security headers + CSP, CSRF, RBAC, AUTH_SECRET fail-fast, health endpoint, Sentry, backup
script, env template lengkap, migrasi Prisma PostgreSQL lengkap, deploy script Vercel idempotent.

Kekurangan terkonsentrasi di **lapisan infrastruktur deployment**, bukan di kode aplikasi.
Dua akar masalah terbesar:

1. **Upload file ke filesystem lokal** (`public/uploads`) — rusak di Vercel, dan hilang saat
   container di-recreate di Docker.
2. **Jalur Docker bermasalah di beberapa titik** — `docker build` gagal karena kontradiksi
   `.dockerignore` vs `Dockerfile`, file compose override (SSL & cron) tidak bisa dipakai,
   migrasi tidak otomatis meski dokumen mengklaim begitu.

---

## 🔴 KRITIKAL — bikin deploy gagal atau fitur rusak

### K1. `docker build` gagal: `.dockerignore` mengecualikan `scripts/` tapi Dockerfile men-COPY-nya

- `.dockerignore` memuat `scripts/` (bagian "Scripts (not needed in production)").
- `Dockerfile` (stage runner): `COPY --from=builder /app/scripts ./scripts`.
- Karena `scripts/` tidak masuk build context, folder itu tidak ada di stage builder →
  langkah COPY gagal → **image tidak pernah berhasil dibangun**.

**Fix (pilih salah satu):**
- Hapus baris `scripts/` dari `.dockerignore` (healthcheck di runner tidak butuh scripts,
  jadi baris COPY ini sebenarnya bisa dihapus), ATAU
- Hapus baris `COPY --from=builder /app/scripts ./scripts` dari Dockerfile.

### K2. `docker-compose.ssl.yml` dan `docker-compose.cron.yml` rusak (tidak bisa `up`)

Kedua file override ini mereferensikan nama yang tidak cocok dengan `docker-compose.yml`:

| Referensi di override | Kenyataan di compose utama | Akibat |
|---|---|---|
| `depends_on: db:` (ssl & cron) | Service bernama **`postgres`** | Compose error: service `db` undefined |
| `networks: cms-network` | Tidak ada section `networks:` di file mana pun | Compose error: network undefined |
| Volume `postgres_data` (cron) | Compose utama mendefinisikan **`postgres-data`** | Compose error |
| Volume `uploads_data` (cron) | Tidak didefinisikan di mana pun | Compose error |
| `DATABASE_URL: ...@db:5432...` (cron) | Hostname benar adalah `postgres` | Koneksi DB gagal |
| Mount `postgres_data:/var/lib/postgresql/data` ke container cron | Data dir Postgres aktif dipakai container lain | **Risiko korupsi data** (dua proses di data dir yang sama) |

**Fix:** samakan nama service (`postgres`), volume (`postgres-data`), definisikan top-level
`networks: { cms-network: { driver: bridge } }` di compose utama, hapus mount data-dir Postgres
di container cron (tidak diperlukan untuk `pg_dump` via network).

### K3. Cron backup di Docker tidak akan jalan: `pg_dump` tidak ada di image

`docker-compose.cron.yml` menjalankan `/app/scripts/backup-db.sh` di container yang dibangun
dari Dockerfile app (`node:20-alpine`). Image itu **tidak memuat `pg_dump`**
(postgresql-client tidak di-install). Backup database pasti gagal.

**Fix:** install `postgresql16-client` di image untuk service cron (mis. stage terpisah),
atau bangun container cron dari image `postgres:16-alpine` + mount script.

### K4. Upload file disimpan ke filesystem lokal — rusak di Vercel, rapuh di Docker

`src/app/api/upload/route.ts` dan `src/app/api/bos-documents/route.ts` menulis file ke
`public/uploads` di disk lokal:

```ts
const uploadDir = join(process.cwd(), "public", "uploads");
await writeFile(join(uploadDir, filename), Buffer.from(bytes));
```

URL `/uploads/<file>` lalu disimpan di database dan dirender sebagai konten (galeri, berita,
dokumen transparansi BOS).

- **Di Vercel:** filesystem serverless bersifat ephemeral dan `public/` hanya berisi aset
  hasil build → file yang diunggah **hilang seketika / 404**. Fitur upload galeri/berita/BOS
  secara fundamental tidak berfungsi di Vercel tanpa object storage.
- **Di Docker:** berjalan selama container hidup, TAPI `docker-compose.yml` **tidak
  mem-mount volume untuk `/app/public/uploads`** → seluruh upload (dan record DB yang
  menunjuknya) **hilang setiap kali container di-recreate** (deploy ulang, crash, update).
  DEPLOYMENT_CHECKLIST.md pun tidak menyebut langkah ini.

**Fix:**
- Jalur Docker: tambahkan volume `uploads_data:/app/public/uploads` di service `app`
  (+ sertakan di backup yang sudah ada di `scripts/backup-db.sh` — bagian uploads sudah ada).
- Jalur Vercel: pindahkan storage ke object storage (Vercel Blob / S3 / Cloudflare R2),
  simpan URL publiknya ke DB. Ini perlu refactor kecil di 2 route upload + cara serve URL-nya.

### K5. Vercel: limit body request 4.5 MB vs batas upload 15 MB

`bos-documents` memvalidasi PDF hingga 15 MB dan `next.config.ts` set
`experimental.proxyClientMaxBodySize: "25mb"`. Namun di Vercel, **request body ke Serverless
Function dibatasi 4.5 MB di level platform** dan tidak bisa dinaikkan via config. Upload PDF
>4.5 MB akan ditolak platform sebelum mencapai route handler.

**Fix:** jika tetap di Vercel → gunakan direct upload ke Blob/R2 dari sisi klien (presigned
URL), atau turunkan batas ke <4.5 MB. `proxyClientMaxBodySize` hanya relevan untuk self-host.

### K6. Migrasi database di jalur Docker tidak otomatis — dokumen menyesatkan

`docs/DEPLOYMENT_CHECKLIST.md` menyatakan: "Pada jalur Docker, migrasi dijalankan otomatis
oleh container sebelum app start." **Tidak benar** — Dockerfile langsung
`CMD ["node", "server.js"]` tanpa entrypoint migrasi. Deploy Docker dengan database kosong =
aplikasi jalan tanpa skema → semua query gagal 500. (CI-nya `deploy-vercel.yml` hanya
menangani jalur Vercel/Neon.)

**Fix:** tambahkan entrypoint di Dockerfile yang menjalankan
`npx prisma migrate deploy --schema prisma/schema.postgres.prisma` sebelum `node server.js`
(catatan: prisma CLI sudah ada di node_modules standalone? — perlu dipastikan; cara aman:
copy `prisma` CLI ke runner atau jalankan `docker compose run app npx prisma migrate deploy`
sebagai langkah deploy terdokumentasi), ATAU perbaiki klaim di dokumen dan dokumentasikan
langkah migrasi manual untuk Docker.

---

## 🟡 SEDANG — risiko keamanan / operasional

### S1. Password default Postgres "postgres" + port 5432 di-publish

`docker-compose.yml`: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}` dan
`ports: "5432:5432"` (bind ke semua interface). Jika `.env` lupa diisi, database produksi
berjalan dengan password default dan terekspos ke jaringan. Port Redis 6379 juga dipublish.

**Fix:** hapus fallback default (biarkan compose gagal jika tidak diisi), tidak perlu
publish port DB/Redis (cukup reachable antar-service via network internal), atau bind
`127.0.0.1:5432:5432`.

### S2. Dockerfile builder tidak men-set `DATABASE_URL` saat `bun run build`

CI sendiri men-set `DATABASE_URL: "file:./ci.db"` saat build (komentar ci.yml: "PrismaClient
membaca DATABASE_URL saat konstruksi (sitemap.ts di-prerender saat build)"). Dockerfile builder
tidak men-set env apa pun sebelum `bun run build` → build Docker berjalan di kondisi env yang
berbeda dari CI dan berpotensi gagal di prerender sitemap. Tambahkan dummy `DATABASE_URL`
(mis. postgresql dummy) di stage builder agar konsisten dengan CI.

### S3. `vercel.json` kontradiktif dengan `next.config.ts`

- `next.config.ts` **sengaja** tidak memakai `X-Frame-Options` (ada catatan eksplisit) dan
  menggantinya dengan CSP `frame-ancestors`. `vercel.json` justru menambah
  `X-Frame-Options: DENY` — di Vercel keduanya terkirim, sehingga proteksi frame menjadi lebih
  ketat dari desain (mis. blok skenario embed yang sengaja diizinkan CSP).
- `X-XSS-Protection` sudah deprecated (nilainya negatif di browser modern).
- Rewrite `/api/:path*` → `/api/:path*` adalah no-op.

**Fix:** hapus `headers` dan `rewrites` dari vercel.json — `next.config.ts` sudah mengurus
semuanya (dan lebih lengkap: CSP, HSTS, Permissions-Policy).

### S4. Jadwal Vercel Cron pakai UTC, bukan WIB

`vercel.json`: cron backup `"0 2 * * *"` = 02:00 **UTC** = 09.00 WIB. Dokumen/env example
menulis "tiap 02.00" seolah waktu lokal. Jika maksudnya 02.00 WIB, gunakan `"0 19 * * *"`.
Selain itu, cron hanya berfungsi jika `CRON_SECRET`, `NEON_API_KEY`, `NEON_PROJECT_ID` diset —
pastikan tidak menganggap backup jalan padahal endpoint hanya balas 503.

### S5. Password seed default lemah di `.env.example`

`SEED_ADMIN_PASSWORD="admin123"` dsb. Seed idempotent; jika lupa diganti saat deploy produksi
pertama, akun admin lahir dengan password lemah. Pertimbangkan: kosongkan default di template
dan buat seed generate password random + tampilkan sekali, atau wajibkan env var diisi.

---

## 🟢 MINOR / kebersihan

1. **README "Deployment" terlalu tipis** — hanya `bun run build && bun run start`, tanpa
   migrate/seed/env. `docs/DEPLOYMENT.md` & `DEPLOYMENT_CHECKLIST.md` jauh lebih lengkap;
   README sebaiknya menunjuk ke sana (dan koreksi klaim migrasi otomatis di Docker, lihat K6).
2. **Path SQLite tidak konsisten (dev-only)** — `.env.example`: `file:../db/custom.db`
   (= `db/custom.db` dari root), tapi `scripts/backup-db.sh` fallback ke
   `prisma/db/custom.db`.
3. **Folder `dapodik-client/`** (library referensi PHP+TS, tidak di-import oleh app — app
   memakai `src/lib/dapodik-client.ts`) ikut masuk build context Docker (`COPY . .`) —
   menambah ukuran context; tidak diblokir `.dockerignore`. Kosmetik.
4. **`public/uploads` tidak di-`.dockerignore`** — pola yang diabaikan adalah `upload/` /
   `download/`, bukan `public/uploads/`; upload lokal dev ikut terbawa ke dalam image bila
   ada saat build. Kosmetik + kebocoran data dev ke image prod.
5. **Tidak ada environment staging/preview terdokumentasi** — Vercel Preview + Neon branch
   adalah kombinasi alami untuk ini; belum didokumentasikan.
6. **`package.json#prisma` seed config sudah deprecated** (warning Prisma 7 akan datang) —
   migrasi ke `prisma.config.ts` bisa masuk backlog.

---

## Yang SUDAH bagus (tidak perlu dikerjakan)

- CI pipeline lengkap: typecheck, lint (ESLint + markdownlint), schema-sync guard,
  public-scope guard, 562 unit test, build — berjalan di GitHub Actions.
- Health endpoint `/api/health` dengan cek DB + Redis + metrik proses (dipakai healthcheck
  Docker & bisa untuk uptime monitor).
- Security headers di `next.config.ts`: CSP lengkap, HSTS, Permissions-Policy, nosniff.
- AUTH_SECRET fail-fast di produksi; CSRF double-submit; RBAC; cookie flags.
- Migrasi PostgreSQL lengkap (10 migrasi) + skema ganda SQLite(dev)/Postgres(prod) dengan
  guard sinkronisasi skema.
- `scripts/deploy-vercel.sh` idempotent (migrate + seed) + workflow GitHub-nya.
- Backup multi-jalur: Neon branch snapshot via Vercel Cron, `backup-db.sh/.ps1`,
  systemd timer, dokumen BACKUP.md.
- Observability: Sentry (client/server/edge), pino + Loki stack (`docker-compose.logging.yml`).
- `.env.example` sangat lengkap dan terdokumentasi.

---

## Urutan tindakan yang disarankan

1. **Putuskan target deploy utama** — ini menentukan fix mana yang prioritas:
   - **Vercel + Neon** → K4 & K5 (object storage + batas upload) adalah blocker utama.
   - **Docker self-host** → K1–K4 & K6 adalah blocker utama.
2. Fix jalur Docker (cepat, sebagian besar edit kecil): K1, K2, K3, K6, volume uploads (K4).
3. Fix keamanan compose: S1.
4. Rapikan `vercel.json`: S3, S4.
5. Backlog minor.
