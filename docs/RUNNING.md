# Panduan Menjalankan Project — CMS MONSA

Panduan praktis untuk menjalankan **CMS MONSA** (UPT SPF SD Negeri Unggulan
Mongisidi 1) dari nol: instalasi, konfigurasi, database, development, hingga
deploy & backup.

> Selengkapnya: [README.md](../README.md) (arsitektur & fitur),
> [docs/ARCHITECTURE.md](ARCHITECTURE.md) (arsitektur internal),
> [DEPLOYMENT.md](DEPLOYMENT.md) (deploy produksi).

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

# 3b) (Opsional) Cek gate pre-commit tanpa commit — dry-run
bun run hooks:check            # gate penuh
bun run hooks:check -- --quick # ringan: guard + lint saja

# 3c) Push branch ikut menjalankan sanity check ringan (--quick: guard +
#     lint seluruh repo, tanpa typecheck/vitest) — tag dilewati. Repo ketat
#     bisa memaksa gate PENUH per push, atau lint HANYA file commit yang
#     di-push:
#     PUSH_GATE=full   git push  (gate penuh)
#     PUSH_GATE=staged git push  (lint file commit yang di-push saja)
#     Default persisten per clone (berlaku semua push; env PUSH_GATE tetap
#     menang): git config pre-push.gate full|staged
#     Output machine-readable (CI/bot): PUSH_JSON=1 git push → stdout =
#     SATU baris JSON (payload gate --json), detail manusia ke stderr.
```

`bun install` otomatis menjalankan `prisma generate` (postinstall).

Push yang terlalu lama bisa dilewati dengan `git push --no-verify` (sama
seperti `git commit --no-verify` untuk pre-commit) — tidak disarankan.
Detail gate pre-commit & pre-push: [../README.md](../README.md#pre-commit-hook)
→ "Pre-commit Hook".

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

Detail pemetaan field: [DAPODIK_SYNC_MAPPING.md](DAPODIK_SYNC_MAPPING.md).

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
bun run test:e2e:local # test:e2e untuk dev server lokal — E2E_SERVER_LOG otomatis ke .zscripts/dev.log
```

### Gate CI: job `hooks-gate` (reusable workflow)

Setiap PR dan push ke main, CI menjalankan gate yang **SAMA persis** dengan
`git commit` lokal — lewat job `hooks-gate` di [reusable workflow
hooks-gate.yml](../.github/workflows/hooks-gate.yml), dipanggil oleh ci.yml
(**satu** pemanggil: ci.yml & playwright.yml jalan di event yang sama, dua
pemanggil hanya menggandakan checkout + install + gate tanpa menambah
cakupan). Alur job:

**Tingkat gate (`gate_mode` — paritas `PUSH_GATE` lokal):** job menerima
input `gate_mode` dengan nilai **`full`** (default) atau **`quick`** —
mirror dari toggle push lokal `PUSH_GATE=full git push` /
`hooks:check -- --quick`. Panggilan dari ci.yml tidak mengoper input, jadi
selalu memakai default **`full`**: gate PENUH, identik dengan `git commit`
lokal. Jalankan manual dari Actions sidebar (`workflow_dispatch` di
hooks-gate.yml) bisa memilih **`quick`** (guard + lint seluruh repo saja —
tanpa typecheck/vitest/schema-sync) untuk sanity check cepat. Ringkasan
step menampilkan mode gate yang dipakai (`gate: full` / `gate: quick`).

1. **`setup-repo`** — checkout + Node + Bun + install (composite action yang
   sama dengan job e2e).
2. **`bun run hooks:check -- --json > hooks-check.json`** (dengan
   `gate_mode: quick` menjadi `-- --quick --json`) — gate identik dengan
   pre-commit lokal (guard repo + warm-up non-blocking + `bun run check`:
   typecheck · lint · markdownlint · schema-sync · vitest; mode `quick`
   hanya guard + lint). Di CI, guard env/cookie/lockfile memindai working
   tree ter-track (`git ls-files`) alih-alih index git — menangkap file
   terlarang yang lolos lewat `git commit --no-verify` lalu di-push;
   guard penghapusan file kritikal tetap index-only; warm-up dilewati
   (`--if-up`, tanpa server).
3. **Step summary** dirender dari JSON (`hooks-check.json`): heading ✅/❌,
   `mode`/`ok`/`blocked`, guard violations, hasil check — tetap tertulis
   walau gate GAGAL (summary tampil juga untuk step merah). Exit code asli
   dipertahankan agar status step/job tetap benar.

Bisa juga dijalankan **manual** dari Actions sidebar (`workflow_dispatch` di
hooks-gate.yml) — mis. sebelum merge tanpa PR. Dry-run lokal yang setara:
`bun run hooks:check`.

Baca juga: [../README.md](../README.md#pre-commit-hook) → **Pre-commit Hook**
— rincian guard repository, mode `--staged`/`--quick`/`--staged-push`, output
JSON (`--json`), dan pre-push (`PUSH_GATE=full`/`staged`, `PUSH_JSON=1`).

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
(`prisma migrate deploy`) sebelum aplikasi start. Detail: [DEPLOYMENT.md](DEPLOYMENT.md),
[DEPLOYMENT_SSL.md](DEPLOYMENT_SSL.md), [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).

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

## 12. E2E Troubleshooting (Playwright)

`bun run test:e2e` menjalankan wrapper [scripts/run-e2e.ts](../scripts/run-e2e.ts)
dengan alur: **tentukan server target → panaskan rute → jalankan
`playwright test` → bersihkan server & tulis artifact log**. Bagian ini
menjelaskan tiap tahap dan cara mendiagnosa kegagalan (versi ringkas; detail
lengkap ada di [README.md](../README.md) → *E2E Troubleshooting*).

### Env var (knob E2E)

Semua perilaku wrapper bisa diatur lewat env var — ringkasan cepat:

| Env var | Default | Fungsi |
|---------|---------|--------|
| `E2E_BASE_URL` | — (kosong) | Override URL server penuh, menang selalu (mis. `http://localhost:3200`). |
| `E2E_PORT` | `3000` | Port target saat tidak ada `E2E_BASE_URL` / pidfile dev server. |
| `E2E_SERVER_CMD` | `bun run dev` | Perintah memulai server; saat `E2E_PORT ≠ 3000` sesuaikan (mis. `bunx next dev -p 3200`). |
| `E2E_SERVER_LOG` | — (kosong) | Path tujuan log merged (wrapper + server + `*.err`); CI memakai `./server-e2e.log` (di-upload tiap run). Di reuse mode juga jadi sumber tail bila menunjuk log server yang hidup. |
| `E2E_TAIL_LINES` | `100` | Panjang tail log server **stdout** saat suite gagal (diklem 1..1000). |
| `E2E_TAIL_LINES_ERR` | `15` | Panjang tail log server **stderr** saat suite gagal (diklem 1..1000). |
| `E2E_STATS_FILE` | `e2e-stats.jsonl` | File riwayat statistik per run (SATU baris JSON per run) untuk cek tren non-2xx. |
| `E2E_PREV_STATS` | — (kosong) | Path `e2e-stats.jsonl` run SEBELUMNYA (di CI: artifact `e2e-stats` yang diunduh) sebagai baseline `check:non2xx`. Kosong → fallback ke baris sebelumnya di `E2E_STATS_FILE` (riwayat lokal). |
| `E2E_NON2XX_ALERT_DELTA` | `5` | Ambang delta non-2xx (atau ADA entri baru) untuk memicu alert tren non-2xx. |
| `E2E_NON2XX_FAIL` | `false` | `true` → `check:non2xx` exit 1 (gate) saat alert; default hanya warning di step summary. |
| `GITHUB_STEP_SUMMARY` | — (diisi GitHub Actions) | File step summary; tail log + verdict triage di-append saat suite gagal. |
| *Catatan CI* | — | **Override CI** (di env level **workflow**, [ci.yml](../.github/workflows/ci.yml) & [playwright.yml](../.github/workflows/playwright.yml)): `E2E_TAIL_LINES` default `100` → **`200`** (stdout, 2× agar stall cold-compile + query prisma selalu terlihat penuh); `E2E_TAIL_LINES_ERR` default `15` → **`100`** (stderr, dalam agar error context / stack trace tidak hilang). Kedua nilai didefinisikan SATU kali di level workflow agar step `Run E2E tests` dan `Check tail heading matches E2E_TAIL_LINES` memakai definisi yang sama. |

Contoh menjalankan suite terhadap server di port lain:

```bash
E2E_PORT=3200 E2E_SERVER_CMD="bunx next dev -p 3200" bun run test:e2e
```

**DB e2e terpisah (disarankan agar suite tidak mengotori DB dev):**
`DATABASE_URL` harus **path absolut** — Prisma meresolve path relatif
terhadap direktori schema, jadi `file:./prisma/e2e-gate.db` membuat file di
`prisma/prisma/e2e-gate.db` (bukan `prisma/e2e-gate.db`) dan DB lama di sana
tidak pernah di-wipe → seed terlewati padahal seharusnya kosong:

```bash
# reseed DB e2e (path absolut — ganti dengan path worktree Anda)
rm -f <worktree>/prisma/e2e-gate.db*
DATABASE_URL="file:<worktree>/prisma/e2e-gate.db" bunx prisma db push
DATABASE_URL="file:<worktree>/prisma/e2e-gate.db" bun run db:seed

# jalankan suite dengan DB e2e
E2E_PORT=3200 E2E_SERVER_CMD="bunx next dev -p 3200" \
  DATABASE_URL="file:<worktree>/prisma/e2e-gate.db" bun run test:e2e
```

### Server target (urutan prioritas)

1. **`E2E_BASE_URL`** — override eksplisit, menang selalu.
2. **`.zscripts/dev.pid` + `.zscripts/dev.port`** — port dev server developer
   (ditulis `.zscripts/dev.sh`); dipakai otomatis. Bila basi (tidak merespons
   probe), wrapper jatuh ke server baru di `E2E_PORT`.
3. **`http://localhost:E2E_PORT`** (default `3000`) — wrapper memulai
   `E2E_SERVER_CMD` (default `bun run dev`) bila belum ada server di sana.

### Warm-up rute (cold-compile Turbopack)

Dev mode Next.js meng-compile route **saat pertama diakses** — request pertama
ke handler API (terutama mutasi `DELETE`/`PUT`) bisa stall 5–10 detik. Untuk
menghilangkan kelas flake ini, wrapper memanaskan rute sebelum suite:
[e2e/warmup.ts](../e2e/warmup.ts) memuat rute default + rute dari pragma
`// warmup:` di tiap spec + rute API dinamis (`/api/.../__warmup__`) + rute
dari laporan mutasi [e2e/mutation-log.ts](../e2e/mutation-log.ts).

Pragma bisa **path-only** (mencakup semua method) atau **method-spesifik**
(menutupi method itu saja), dan bisa banyak dalam satu baris:

```ts
// e2e/news-crud.spec.ts — path-only
// warmup: /api/news /api/auth/login

// e2e/login.spec.ts — method-spesifik
// warmup: POST /api/auth/login POST /api/auth/logout
```

CI memverifikasi deklarasi tetap jujur via `bun run check:warmup-declarations`
— spec yang memutasi route API tanpa pragma membuat job gagal. Panaskan
manual tanpa suite: `bun run e2e:warmup` (tambahkan `--if-up` bila hanya
ingin memanaskan server yang sedang hidup).

**Tail kegagalan warm-up:** bila ada rute yang gagal dipanaskan (✗ — mis.
cold-compile timeout atau 500), CLI `e2e:warmup` men-tail log server
developer (sumber sama dengan reuse mode wrapper: `E2E_SERVER_LOG` →
`.zscripts/dev.log`) agar penyebabnya langsung terlihat di terminal. Wrapper
`test:e2e` melakukan hal yang sama sebelum suite dimulai (tail via
`readServerLogTail`: log spawn milik wrapper, `E2E_SERVER_LOG`, atau
`.zscripts/dev.log`). Tanpa sumber log, keduanya mencetak petunjuk untuk
menyetel `E2E_SERVER_LOG`.

### `--if-up` (pakai dev server yang sedang hidup)

`bun run test:e2e -- --if-up` menjalankan suite terhadap server yang **sudah
berjalan**; bila tidak ada, suite dilewati dengan exit 0 (tidak memulai
server baru). Dipakai pre-commit hook (warm-up non-blocking) dan untuk run
lokal di atas dev server developer.

**Tail kegagalan di reuse mode:** saat suite gagal, wrapper tidak memiliki
log server sendiri (server milik developer), jadi sumber tail dicari
berurutan:

1. `E2E_SERVER_LOG` yang menunjuk ke log server developer yang sedang hidup
   — tail diambil dari file itu. Set env ini ke path log dev server Anda
   (mis. `E2E_SERVER_LOG="$PWD/.zscripts/dev.log" bun run test:e2e -- --if-up`)
   agar local failure mendapat diagnosa yang sama dengan CI.
2. `.zscripts/dev.log` — log server developer yang ditulis `.zscripts/dev.sh`
   (stdout+stderr); **di-auto-discover** tanpa env apa pun, selama server
   target berasal dari pidfile (`.zscripts/dev.pid`/`.port`) atau
   `--if-up` memakai server yang hidup. Catatan: `dev.sh --no-log` mematikan
   penulisan log ini (output server live di terminal) — dengan flag itu,
   set `E2E_SERVER_LOG` ke log terminal Anda bila ingin tail reuse mode
   tetap lengkap.

Tanpa keduanya, tail reuse mode kosong — wrapper tidak bisa menebak di mana
server eksternal menulis lognya.

### Server log artifact

Selesai run, wrapper menyalin log ke `E2E_SERVER_LOG` (di CI:
`./server-e2e.log`) — **satu file merged**: log wrapper (status warm-up
`✓/◇/✗` per rute, alur test:e2e) di atas + output server di bawah, plus
pasangan `*.err` (stderr). CI meng-upload artifact ini di **setiap** run
(sukses maupun gagal).

**Retensi artifact:** ada dua artifact dengan masa simpan BERBEDA —
`server-log` (merged `server-e2e.log` + `*.err`) di-upload tiap run dengan
retensi **30 hari** (jejak post-mortem diagnosa bertahan lama), sedangkan
`playwright-report` (report + `test-results/`) hanya saat gagal dengan
retensi **7 hari** (file besar, jarang dibuka). Workflow produksi memakai
nama `-prod` (`server-log-prod`, `playwright-report-prod`). Post-hoc
`triage:e2e` harus dipakai dalam masa retensi 30 hari.

**Reuse mode juga menghasilkan artifact:** bila wrapper memakai dev server
yang sedang hidup (reuse via pidfile atau `--if-up`), `.zscripts/dev.log`
(hasil auto-discovery di atas) ikut **digabung** ke artifact yang sama —
target `E2E_SERVER_LOG` bila diset, default `./server-e2e.log`. Jadi local
reuse run meninggalkan artifact merged ala CI (tanpa pasangan `*.err`,
karena `dev.log` sudah stdout+stderr `2>&1`), dan `bun run triage:e2e`
post-run langsung bisa discan tanpa env. Guard: bila `E2E_SERVER_LOG`
menunjuk `.zscripts/dev.log` itu sendiri, artifact tidak dibuat (tidak
menimpa sumber hidup).

Saat suite gagal, 100 baris terakhir log (ubah lewat `E2E_TAIL_LINES`)
dicetak ke konsol wrapper dan step summary GitHub (`GITHUB_STEP_SUMMARY`).

### Tren non-2xx antar run (alert regresi diam-diam)

Setiap run menambahkan **satu baris** ke `e2e-stats.jsonl` (gitignored,
skema di [scripts/e2e-stats.ts](../scripts/e2e-stats.ts)): jumlah request &
non-2xx + daftar entri non-2xx dengan **atribusi spec** (via laporan mutasi
fixture `e2e/mutation-log.ts`) — jadi kenaikan 4xx/5xx bisa dilacak ke spec
penyebabnya. Di CI file ini di-upload sebagai artifact `e2e-stats`
(`e2e-stats-prod` di workflow produksi) di **setiap** run (retensi 30 hari),
menjadi baseline run berikutnya.

Step **`Check non-2xx trend`** (ci.yml & playwright.yml) membandingkan run
ini vs run sebelumnya (workflow sama, run lain — diunduh lewat
`download-artifact` dengan `run-id`): alert `## ⚠️ Non-2xx naik` ditulis ke
step summary bila delta non-2xx ≥ `E2E_NON2XX_ALERT_DELTA` (default `5`)
ATAU ada entri non-2xx **baru** (method+path+status yang belum pernah
ada — biasanya datang dari spec baru). Entri baru ditampilkan dengan tag
spec bila teratribusi. Manual: `bun run check:non2xx` — baseline dari
`E2E_PREV_STATS` atau riwayat lokal (baris kedua-terakhir `e2e-stats.jsonl`).
Run pertama tanpa baseline hanya dicatat sebagai BASELINE.

> Alert default bersifat **warning** (step summary + konsol) agar suite
> hijau tidak patah karena kenaikan yang disengaja (mis. spec baru yang
> memang menguji 404). Repo ketat bisa mengubahnya jadi gate dengan
> `E2E_NON2XX_FAIL=true` (exit 1) di step env.

### Triage kegagalan otomatis

Saat suite gagal, wrapper **otomatis** menjalankan
[scripts/triage-e2e.ts](../scripts/triage-e2e.ts) dan mencetak verdict-nya
(konsol + step summary + artifact `server-e2e.log`). Verdict mengelompokkan
kegagalan: **stall** (mutasi ≥ 5s = cold-compile Turbopack), **DNS/network**
(`ENOTFOUND`, `fetch failed`, …), atau **assertion** (timeout, error-context).

### Diagnosa manual: `bun run triage:e2e`

Jalankan setelah run gagal — lokal langsung, atau di CI setelah mengunduh
artifact `server-log`:

```bash
bun run triage:e2e             # scan log + laporan, verdict manusia
bun run triage:e2e -- --json   # SATU baris JSON untuk CI / bot
```

Sumber yang discan: `E2E_SERVER_LOG` (default `./server-e2e.log`, lalu
fallback ke log e2e terbaru di `%TEMP%`) + `./test-results` &
`./playwright-report`. Ambang: `TRIAGE_STALL_MS` (default `5000`) untuk
mutasi, `TRIAGE_SLOW_MS` (default `10000`) untuk method lain (info saja).
Exit code: `0` tidak ada pola dikenal, `1` ada temuan, `2` error. Pada mode
`--json`, `verdict` bernilai `warmup-failed` | `cold-compile` | `network` |
`assertion` | `clean`. Kategori `warmup-failed` **menang** atas counts: saat
section wrapper terlalu kecil (warm-up gagal diam-diam), data pemanasan
tidak bisa dipercaya — verdict jadi `warmup-failed` walau ada stall, dan
exit code/`ok` ikut merah.

### Analisa post-hoc: workflow `triage.yml`

Run yang sudah lewat bisa dianalisa ulang **tanpa menjalankan ulang suite**
lewat workflow
[../.github/workflows/triage.yml](../.github/workflows/triage.yml) (E2E
Triage (post-hoc)). Workflow mengunduh artifact `server-log` dari run yang
dituju, lalu menjalankan `bun run triage:e2e` di atasnya — verdict
stall/DNS/timeout langsung terlihat di konsol job.

Pemakaian (Actions → E2E Triage (post-hoc) → Run workflow):

- **run_id** — ID run yang mau dianalisa, dari URL Actions (bagian
  `/actions/runs/<id>`). Wajib; artifact hanya tersedia selama retensinya
  (server-log: 30 hari).
- **artifact_name** — `server-log` (ci.yml) atau `server-log-prod`
  (playwright.yml), sesuai run sumber. Default `server-log`.
- **report_name** (opsional) — artifact Playwright report
  (`playwright-report` / `playwright-report-prod`) untuk ikut diunduh &
  discan: triage lalu membaca error-context (`test-results/**/*.md`) +
  `index.html`, jadi verdict assertion/timeout lebih akurat daripada
  analisa berbasis log server saja. Kosongkan untuk analisa log-only.

Alur job: `setup-repo` → validasi `run_id` → `download-artifact@v4` dengan
`run-id` (bisa menarik artifact dari run LAIN) → triage dengan
`E2E_SERVER_LOG=./artifacts/server-e2e.log` (+ `E2E_TEST_RESULTS` &
`E2E_PLAYWRIGHT_REPORT` saat report ikut diunduh; direktori yang tidak ada
diabaikan triage). **Exit code 1 dengan verdict di konsol adalah hasil yang
DIINGINKAN** — job merah berarti menemukan pola dikenal
(stall/DNS/timeout), bukan error workflow.

Bila run sumber terkait PR (event `pull_request`), verdict triage juga
**diposting sebagai komentar sticky di PR itu** (marker
`<!-- e2e-triage-posthoc -->`, diperbarui di tempat pada analisa ulang)
— diagnosa terlihat langsung di thread PR tanpa membuka run. Run tanpa PR
(mis. push ke main) melewati komentar dengan notice di konsol job.

**Run hijau ikut diringkas:** payload triage kini memuat `summary`
(warm-up ✓/◇/✗ + request per method & non-2xx, dihitung ulang dari log
merged dengan regex & aritmetika yang sama dengan `writeSuccessSummary`
wrapper). Bila log memuat marker `ringkasan sukses:` (ditulis wrapper
hanya saat exit 0), analisa menulis section `## ✅ E2E passed — server log
summary (post-hoc)` ke step summary GitHub — dan memuatnya di komentar PR
— jadi run hijau mendapat ringkasan yang sama dengan CI. Penanda
`runSucceeded` (bukan verdict `clean`) yang jadi gate: verdict clean bisa
berasal dari run gagal tanpa pola dikenal, jadi tidak pernah dilabeli
hijau keliru.

---

## 13. Rate Limiting Policy

CMS MONSA menerapkan rate limiting di beberapa endpoint untuk melindungi
aplikasi dari abuse, brute-force, dan scraping. Semua implementasi ada di
`src/lib/rate-limit.ts`.

### Public GET Endpoints (Anti-Scraping)

| Endpoint | Default Limit | Window | Catatan |
|----------|--------------|--------|----------|
| `GET /api/students/showcase` | 30 req | 1 menit | Anti-scraping NIS/NISN |
| `GET /api/bos-expenditures` | 60 req | 1 menit | Public transparansi |
| `GET /api/org-structure` | 30 req | 1 menit | Anti-scraping |
| `GET /api/achievements` | 30 req | 1 menit | Anti-scraping |
| `GET /api/teachers` | 30 req | 1 menit | Anti-scraping |
| `GET /api/news` | 30 req | 1 menit | Anti-scraping |

Saat IP melampaui limit, sistem akan:
1. Mengembalikan HTTP 429 (Too Many Requests) dengan header `Retry-After`.
2. Mencatat warning log untuk deteksi scraper (`[rate-limit] SCRAPER DETECTED`).

### Public Form Endpoints (Anti-Spam)

| Endpoint | Default Limit | Window |
|----------|--------------|--------|
| `POST /api/complaints` | 20 req | 10 menit |
| `POST /api/contact` | 20 req | 10 menit |

### Login Endpoint (Anti-Brute-Force)

| Mekanisme | Threshold | Durasi Lock |
|-----------|-----------|-------------|
| Per email+IP | 5 kegagalan | 15 menit |
| Per IP | 20 percobaan | 15 menit |

### Redis vs In-Memory

- **Tanpa `REDIS_URL`** (default dev): rate limiter menggunakan in-memory `Map`.
  Cukup untuk single-instance deployment.
- **Dengan `REDIS_URL`** (production multi-instance): rate limiter menggunakan
  Redis dengan TTL otomatis. Cocok untuk horizontal scaling.

### Konfigurasi

Rate limit values bisa dikonfigurasi per endpoint melalui parameter fungsi.
Untuk perubahan global, edit `src/lib/rate-limit.ts`.

---

## 14. Uptime Monitoring & Health Checks

### Health Endpoint

`GET /api/health` mengembalikan status JSON dengan informasi:

```json
{
  "status": "healthy",
  "timestamp": "2026-08-22T10:00:00.000Z",
  "uptime": 3600,
  "totalLatencyMs": 12,
  "checks": {
    "db": { "ok": true, "latencyMs": 5 },
    "redis": { "ok": true, "latencyMs": 3 }
  },
  "process": {
    "heapUsedMB": 85,
    "heapTotalMB": 120,
    "rssMB": 200
  }
}
```

- **status**: `healthy` (200) atau `degraded` (503)
- **uptime**: detik sejak process start
- **totalLatencyMs**: waktu respons total
- **checks.db / checks.redis**: status masing-masing dependency
- **process**: penggunaan memori Node.js

### Self-Monitoring Script

```bash
# Jalankan health check dari command line
bun run health:check

# Atau dengan URL custom
HEALTH_URL=https://sdn-mongisidi1.sch.id/api/health bun run health:check
```

Script akan exit code 0 jika healthy, 1 jika unhealthy — cocok untuk cron:

```bash
# Contoh cron (setiap 5 menit)
*/5 * * * * cd /path/to/cms && HEALTH_URL=https://sdn-mongisidi1.sch.id/api/health bun run health:check >> logs/health-check.log 2>&1
```

### Rekomendasi External Monitoring

Untuk produksi, gunakan layanan monitoring eksternal yang mem-*ping* endpoint
health secara berkala:

| Layanan | Gratis? | Fitur Utama |
|---------|---------|-------------|
| **[UptimeRobot](https://uptimerobot.com)** | ✅ 50 monitor gratis | HTTP(s), keyword, port, heartbeat. Notifikasi email/Telegram/Webhook. |
| **[Better Uptime](https://betterstack.com)** | ✅ 10 monitor gratis | Incident management, status page, notifikasi multi-channel. |
| **[Freshping](https://freshping.io)** | ✅ 50 check gratis | HTTP, TCP, DNS checks. Integrasi Freshdesk. |
| **[Grafana Cloud](https://grafana.com/products/cloud/)** | ✅ 10k metrics | Full APM + uptime + logs dalam satu platform. |

**Setup UptimeRobot (recommended):**

1. Buat akun gratis di [uptimerobot.com](https://uptimerobot.com)
2. Tambah monitor baru → **HTTP(s)**
3. URL: `https://sdn-mongisidi1.sch.id/api/health`
4. Interval: 5 menit
5. Alert contacts: email admin + Telegram webhook
6. Pasca-insiden: cek `response-text` untuk melihat field `status` dan `checks`

**Threshold yang direkomendasikan:**

| Metric | Threshold | Aksi |
|--------|-----------|------|
| Response time | > 3 detik | Warning (latency tinggi) |
| HTTP status | != 200 | Critical (service down/degraded) |
| Uptime < 99.9% | Bulanan | Review infrastructure |

### Log Aggregation (Loki + Grafana)

CMS MONSA mendukung log aggregation menggunakan Grafana Loki untuk
menyimpan, mencari, dan menganalisis logs secara terpusat.

**Quick Start:**

```bash
# 1. Jalankan stack logging (Loki + Grafana + Promtail)
docker compose -f docker-compose.logging.yml up -d

# 2. Set LOKI_URL di .env
LOKI_URL="http://localhost:3100/loki/api/v1/push"

# 3. Restart aplikasi
bun run dev

# 4. Buka Grafana
dashboard: http://localhost:3001 (admin/admin)
```

**Architecture:**

```
┌─────────────┐    ┌──────────┐    ┌─────────┐
│ CMS MONSA   │───▶│ Promtail │───▶│  Loki   │
│ (pino-loki) │    │  (tail)  │    │ (store) │
└─────────────┘    └──────────┘    └─────────┘
                                          │
                                     ┌────▼────┐
                                     │ Grafana │
                                     │ (query) │
                                     └─────────┘
```

**Log Labels:**

| Label | Value | Keterangan |
|-------|-------|------------|
| `service` | `cms-monsa` | Nama aplikasi |
| `environment` | `production` / `development` | Lingkungan |
| `level` | `debug`, `info`, `warn`, `error`, `fatal` | Level log pino |
| `requestId` | UUID per request | Tracking permintaan |
| `userId` | User ID | Siapa yang melakukan aksi |

**Grafana Dashboard:**

Dashboard `CMS MONSA — Logs` menyediakan:
- Log volume by level (bar chart)
- Error/warning count (24h)
- Log stream dengan filter (errors, warnings, login, 2FA)
- Template variables untuk quick filter

**Environment Variables:**

| Variable | Default | Keterangan |
|----------|---------|------------|
| `LOKI_URL` | `""` | URL endpoint Loki push API |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Minimum log level |

**Tanpa Docker:**

Jika tidak menggunakan Docker, logs tetap ditulis ke stdout dalam format
JSON. Gunakan tool seperti `jq` untuk filtering:

```bash
bun run dev 2>&1 | jq 'select(.level == "error")'
```

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
| Warm-up rute (tanpa suite) | `bun run e2e:warmup` |
| Triage kegagalan E2E | `bun run triage:e2e` |
| Cek tren non-2xx | `bun run check:non2xx` |
| Health check (self-monitoring) | `bun run health:check` |