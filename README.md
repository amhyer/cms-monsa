# CMS MONSA — UPT SPF SD Negeri Unggulan Mongisidi 1

Sistem Manajemen Konten (CMS) untuk website sekolah UPT SPF SD Negeri Unggulan Mongisidi 1, Makassar.

> **Kontributor?** Gate validasi (pre-commit/pre-push) & alur E2E
> dikonsolidasi di [CONTRIBUTING.md](CONTRIBUTING.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, standalone output) |
| Language | TypeScript (strict mode) |
| UI | React 19 + shadcn/ui (New York style) |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Animation | Framer Motion |
| Database | Prisma ORM + SQLite (dev) / PostgreSQL (produksi via [schema.postgres.prisma](prisma/schema.postgres.prisma)) |
| Auth | Custom HMAC-signed cookie sessions |
| Package Manager | bun (lockfile: `bun.lock`) |

## Features

### Public Website
- Beranda dengan hero carousel & statistik
- Profil sekolah (sejarah, visi, misi)
- Berita & artikel dengan pencarian
- Galeri foto & video
- Prestasi siswa
- Agenda sekolah
- Form pengaduan (complaint)
- Form kontak
- Informasi SPMB/PPDB
- Dark mode toggle
- RSS feed

### Admin Dashboard
- Ringkasan statistik
- Manajemen berita (CRUD)
- Manajemen pengumuman
- Manajemen agenda
- Manajemen galeri
- Manajemen prestasi
- Manajemen guru & staf
- Manajemen pengaduan
- Pesan masuk
- Manajemen operator (super admin only)
- Pengaturan sekolah (super admin only)
- Log aktivitas

## Routing (App Router murni)

Seluruh aplikasi memakai **Next.js App Router** — tidak ada hash router
(`#/dashboard/...`) maupun routing store. Setiap halaman punya URL bersih yang
bisa di-index, di-deep-link, dan didukung penuh oleh back/forward browser.

### Halaman Publik

- `/` — Beranda
- `/profile` — Profil sekolah
- `/academic` — Akademik
- `/news` dan `/news/:slug` — Berita & artikel
- `/gallery` — Galeri
- `/transparansi` — Transparansi Anggaran (ARKAS / Dana BOS)
- `/complaint` — Form pengaduan
- `/contact` — Kontak
- `/login` / `/admin-login` — Autentikasi

### Dashboard — satu route App Router per modul

| Route | Modul | Akses |
|-------|-------|-------|
| `/dashboard` | Ringkasan | Semua role |
| `/dashboard/news` | Berita & Artikel | Super Admin / Operator |
| `/dashboard/announcements` | Pengumuman | Super Admin / Operator |
| `/dashboard/agenda` | Agenda Sekolah | Super Admin / Operator |
| `/dashboard/gallery` | Galeri Media | Super Admin / Operator |
| `/dashboard/achievements` | Data Prestasi | Super Admin / Operator |
| `/dashboard/teachers` | Guru & Staf | Super Admin / Operator |
| `/dashboard/students` | Data Siswa | Super Admin / Operator |
| `/dashboard/classes` | Kelas | Super Admin / Operator |
| `/dashboard/attendance` | Kehadiran Siswa | Semua role (GURU hanya kelas wali) |
| `/dashboard/transparansi` | Transparansi Anggaran (ARKAS / Dana BOS) | **Super Admin only** |
| `/dashboard/reports` | Laporan | Super Admin / Operator |
| `/dashboard/complaints` | Pengaduan | Super Admin / Operator |
| `/dashboard/messages` | Pesan Masuk | Super Admin / Operator |
| `/dashboard/users` | Manajemen Operator | **Super Admin only** |
| `/dashboard/settings` | Pengaturan Sekolah | **Super Admin only** |
| `/dashboard/logs` | Log Aktivitas | **Super Admin only** |

Guard akses diterapkan **satu kali** di `src/app/dashboard/layout.tsx` untuk
semua route dashboard: GURU hanya dapat membuka `/dashboard` (exact-match,
bukan prefix — lihat [REFACTOR_PLAN.md](REFACTOR_PLAN.md) bagian #1) dan area
`/dashboard/attendance` (termasuk sub-halamannya), sedangkan route admin
(`users` / `settings` / `logs`) khusus Super Admin.

## Prerequisites

- Node.js >= 20.9.0
- bun (package manager kanonik — lockfile `bun.lock`)
- Git

## Installation

> Panduan lengkap menjalankan project dari nol (instalasi, env, database,
> dev, deploy, backup, troubleshooting): [docs/RUNNING.md](docs/RUNNING.md).

```bash
# Clone repository
git clone <repository-url>
cd "CMS MONSA"

# Install dependencies
bun install

# Setup database
bun run db:push

# Seed data (opsional)
bunx tsx prisma/seed.ts

# Jalankan development server
bun run dev
```

Buka http://localhost:3000 di browser.

## Security

CMS MONSA menerapkan security hardening di semua lapisan:

| Layer | Implementasi |
|-------|-------------|
| **Authentication** | HMAC-signed session cookies (httpOnly, secure, sameSite: lax) |
| **Authorization** | RBAC — SUPER_ADMIN > OPERATOR > GURU > ORANG_TUA/SISWA |
| **CSRF** | Double-submit cookie pattern (x-csrf-token header + monsa_csrf cookie) |
| **Input Validation** | Zod schemas di semua mutation endpoints |
| **Rate Limiting** | Login brute-force (5 attempts → 15min lock), public form anti-spam, GET anti-scraping |
| **SQL Injection** | Prisma ORM parameterized queries (tidak ada raw SQL) |
| **XSS** | React auto-escaping + CSP headers |
| **Secrets** | AUTH_SECRET wajib di-production, pre-commit hook memblokir .env commit |
| **Session Expiry** | Server-side 7 hari (H3: token decode menolak session expired) |
| **Audit Trail** | Semua CRUD operations logged ke activity_log |
| **Database Indexes** | @@index di role, isActive, date, category untuk query performance |

Untuk detail implementasi, lihat [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Configuration

Buat file `.env` di root project (template: [.env.example](.env.example)):

```env
# Database
DATABASE_URL="file:./db/custom.db"

# Authentication (WAJIB untuk production)
# Generate secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET="your-random-secret-here"

# Site URL (untuk SEO dan email)
NEXT_PUBLIC_SITE_URL="https://sdn-mongisidi1.sch.id"

# Email (opsional, untuk notifikasi)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="CMS MONSA <noreply@sdn-mongisidi1.sch.id>"
ADMIN_EMAIL="admin@sdn-mongisidi1.sch.id"
```

## Database

```bash
# Push schema ke database
bun run db:push

# Generate Prisma client
bun run db:generate

# Seed data contoh (database kosong saja — seed dilewati jika sudah berisi data)
bun run db:seed
```

## Scripts

```bash
bun run dev           # Development server (port 3000)
bun run build         # Production build
bun run start         # Production server
bun run lint          # ESLint
bun run lint:md       # Markdown lint (fence seimbang, tautan tidak rusak)
bun run typecheck     # TypeScript type checking (tsc --noEmit)
bun run check:schema  # Cek sinkronisasi schema.prisma ↔ schema.postgres.prisma
bun run check         # Gerbang validasi: typecheck + lint + lint:md + check:schema + test
bun run test          # Unit & integration tests (Vitest)
bun run test:watch    # Tests dalam mode watch
bun run test:coverage # Tests dengan coverage report
bun run test:e2e      # End-to-end tests (Playwright)
bun run test:e2e:local # test:e2e untuk dev server lokal — E2E_SERVER_LOG otomatis ke .zscripts/dev.log
bun run e2e:warmup    # Panaskan rute utama dev server secara manual (tanpa suite)
bun run check:warmup-declarations # Cek deklarasi // warmup: spec sesuai mutasi aktual
bun run check:non2xx  # Cek tren non-2xx antar run (alert regresi diam-diam)
bun run triage:e2e    # Diagnosa kegagalan E2E dari log server + laporan Playwright
bun run hooks:install # Aktifkan pre-commit hook (core.hooksPath)
bun run hooks:check  # Jalankan gate pre-commit tanpa commit (dry-run)
bun run db:push       # Push schema ke database
bun run db:generate   # Generate Prisma client
bun run db:seed       # Seed data contoh (database kosong saja)
```

## Development

### Script Validasi

Sebelum commit, jalankan gerbang validasi untuk memastikan kode sehat:

```bash
bun run typecheck   # TypeScript: tsc --noEmit (0 error)
bun run lint        # ESLint (0 error)
bun run lint:md     # Markdown lint (markdownlint-cli2 + custom rules)
bun run check:schema # Cek sinkronisasi skema Prisma (dev ↔ postgres)
bun run test        # Vitest — unit & integration tests
bun run check       # Semua di atas sekaligus (typecheck && lint && lint:md && check:schema && test)
```

`bun run check` adalah gerbang tunggal yang dipakai oleh pre-commit hook.
Perintah ini berhenti (short-circuit) di kegagalan pertama dan mengembalikan
exit code non-zero — cocok untuk pipeline CI maupun pre-commit. CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) menjalankan typecheck, lint, lint:md, check:schema, dan test
sebagai step terpisah agar setiap kegagalan terlihat jelas di laporan GitHub
Actions.

`lint:md` menggunakan `markdownlint-cli2` (config [.markdownlint-cli2.cjs](.markdownlint-cli2.cjs))
dengan rule core MD042/MD055/MD056 plus dua custom rule di
`scripts/markdownlint/`:

- **CUSTOM001** — tautan relatif `[text](file.md)` harus menunjuk ke file yang
  benar-benar ada di disk (mencegah "tautan rusak" ter-commit).
- **CUSTOM002** — fence kode (` ``` ` / ` ~~~ `) harus ditutup; parser
  markdown menutup fence yang tak tertutup secara diam-diam, jadi dicek
  eksplisit.

### Pre-commit Hook

Gate validasi ter-versi di [.githooks/run-checks.sh](.githooks/run-checks.sh) adalah
**satu sumber kebenaran** — dipakai oleh tiga jalur identik (tidak bisa drift):

- **`git commit`** — hook [.githooks/pre-commit](.githooks/pre-commit)
  mendelegasi ke gate yang sama secara otomatis.
- **`bun run hooks:check`** — dry-run manual, TANPA commit.
- **CI** — job `hooks-gate` [reusable workflow
  hooks-gate.yml](.github/workflows/hooks-gate.yml), dipanggil ci.yml —
  menjalankan gate yang sama persis di setiap PR & push main. Satu pemanggil
  saja (ci.yml & playwright.yml jalan di event yang sama; dua pemanggil
  akan menggandakan checkout + install + gate). Jalankan manual dari Actions
  sidebar (`workflow_dispatch` di hooks-gate.yml) atau `bun run hooks:check`
  lokal.

Gate berjalan berurutan dalam tiga lapis:

1. **Guard repository** (gagal seketika, sebelum validasi kode):
   - **File `.db` / `.db-journal` / `.env*` ter-stage** (kecuali
     [.env.example](.env.example)) — mencegah database/secret ter-commit secara
     tidak sengaja (lihat [REPO_HEALTH_AUDIT.md](REPO_HEALTH_AUDIT.md) C.9).
   - **Penghapusan [src/app/api/upload/route.ts](src/app/api/upload/route.ts) /
     [src/proxy.ts](src/proxy.ts)** — file kritikal yang wajib selalu ada.
2. **Warm-up rute dev server** (non-blocking) — bila dev server sedang
   berjalan, rute utama di-panaskan agar test:e2e setelahnya tidak kena stall
   cold-compile Turbopack; server mati → dilewati (`--if-up`).
3. **`bun run check`** — typecheck + lint + lint:md + check:schema + test.

Aktifkan hook sekali per clone:

```bash
bun run hooks:install  # set git config core.hooksPath .githooks
```

**Referensi cepat (hooks):**

| Perintah | Fungsi | Dipakai oleh |
|----------|--------|--------------|
| `bun run hooks:install` | Aktifkan hooks sekali per clone (`git config core.hooksPath .githooks`) | manual |
| `git commit` | Jalankan gate penuh otomatis | pre-commit |
| `bun run hooks:check` | Dry-run gate **PENUH** (typecheck + lint + lint:md + check:schema + vitest) tanpa commit | manual, CI `hooks-gate` |
| `bun run hooks:check -- --quick` | Ringan: guard + lint seluruh repo (tanpa tsc/vitest/schema-sync) | pre-push **default** |
| `bun run hooks:check -- --staged` | Guard + lint HANYA file JS/TS ter-stage (non-JS dicantumkan, tidak di-lint) | manual |
| `bun run hooks:check -- --staged-push` | Guard + lint HANYA file pada commit yang di-push (daftar via `HOOKS_PUSH_FILES`) | pre-push `PUSH_GATE=staged` |
| `bun run hooks:check -- --json` | Output machine-readable (SATU baris JSON); gabung dengan mode mana pun | CI / bot |
| `PUSH_GATE=full git push` | Push menjalankan gate **PENUH** (bukan `--quick`) | pre-push |
| `PUSH_GATE=staged git push` | Push lint HANYA file commit yang di-push (diff remote..local; branch baru = semua file) | pre-push |
| `git config pre-push.gate full\|staged` | Default **persisten** per clone (berlaku semua push; env `PUSH_GATE` tetap menang) | pre-push |
| `PUSH_JSON=1 git push` | Push output SATU baris JSON (push tag-only → `{"tool":"pre-push","mode":"skip-tag","ok":true}`) | CI / bot |
| `git commit --no-verify` / `git push --no-verify` | Lewati gate sepenuhnya — **tidak disarankan** | manual |

Catatan: `--staged --quick` sama dengan `--staged` (scope menang), dan `--json`
bisa digabung dengan `--quick`/`--staged`/`--staged-push` mana pun.

#### Dry-run tanpa commit

```bash
bun run hooks:check              # gate penuh, persis seperti pre-commit
bun run hooks:check -- --staged  # ringan: guard + lint HANYA file ter-stage
bun run hooks:check -- --quick   # ringan: guard + lint seluruh repo
```

Mode `--staged` / `--quick` melewati bagian lambat (typecheck, vitest,
warm-up) — cocok sebagai sanity check cepat; guard repository tetap berlaku
(pelanggaran langsung exit 1). Untuk jaminan penuh jalankan `hooks:check`
tanpa flag, atau commit biasa.

#### Output scope ter-stage (`--staged` / `--staged-push`)

Kedua mode scope mencetak **jumlah file di baris header**, lalu daftar file
**terurut abjad** (hasil `sort -u` — stabil & ter-dedupe apa pun urutan `git
diff`):

```text
🔍 [hooks] (--staged) lint 2 file ter-stage (tanpa gate penuh):
   - a.ts
   - b.ts
✅ [hooks] Semua validasi (mode --staged) lulus.
```

**Transparansi scope**: file non-JS/TS dalam scope ikut dilaporkan (baris
`ℹ️` abu-abu) meski tidak di-lint — jadi jelas apa yang benar-benar dalam
scope vs apa yang hanya di-lint. Berlaku di `--staged` (daftar ter-stage)
dan `--staged-push` (daftar commit yang di-push, dikirim pre-push lewat
`HOOKS_PUSH_NON_JS`):

```text
ℹ️  [hooks] (--staged) 1 file non-JS/TS ter-stage (tidak di-lint):
   - README.md
```

Bila tidak ada file JS/TS dalam scope, mode mencetak pesan "hanya guard" dan
tetap lulus (guard repo masih berlaku):

```text
🔍 [hooks] (--staged-push) tidak ada file JS/TS pada commit yang di-push — hanya guard.
✅ [hooks] Semua validasi (mode --staged-push) lulus.
```

Saat dijalankan lewat pre-push (`PUSH_GATE=staged`), baris scope muncul
dua lapis — pre-push melaporkan hitungan **mentah vs ter-filter** (total file
yang disentuh commit yang di-push vs file JS/TS yang akan di-lint), lalu
`run-checks.sh` mencetak daftar lint-nya sendiri:

```text
🔍 [pre-push] Lint 2 file JS/TS dari 3 file yang disentuh commit yang di-push (PUSH_GATE=staged)...
🔍 [hooks] (--staged-push) lint 2 file pada commit yang di-push (tanpa gate penuh):
   - a.ts
   - b.ts
✅ [hooks] Semua validasi (mode --staged-push) lulus.
✅ [pre-push] Gate lulus — push diizinkan.
```

Konsumen mesin tidak perlu mem-parse baris teks ini — gunakan `--json`
(payload `lint.files` = daftar yang di-lint, `pushScope.total` = hitungan
mentah, lihat tabel di bawah).

#### Output JSON (`--json`) untuk tooling

Mode `--json` mengarahkan **SATU baris JSON** ke stdout (detail manusia
langsung dipindah ke stderr) untuk konsumsi CI / bot / tooling. Exit code
tetap bermakna: `0` lulus, `1` gagal, `2` argumen salah.

```bash
bun run hooks:check -- --json           # mode penuh (check)
bun run hooks:check -- --staged --json  # mode ringan (lint)
```

Skema baris JSON:

| Field | Tipe | Selalu ada | Isi |
|---|---|---|---|
| `tool` | `string` | ✅ | `"hooks:check"` |
| `mode` | `string` | ✅ | `"full"` \| `"quick"` \| `"staged"` \| `"staged-push"` |
| `ok` | `boolean` | ✅ | `true` = semua validasi lulus |
| `blocked` | `boolean` | ✅ | `true` = guard repo memblokir (exit selalu `1`) |
| `guardViolations` | `string[]` | ✅ | file yang melanggar guard (kosong bila bersih) |
| `check` | `object` | mode `full` | `{ "ok": boolean }` — hasil `bun run check` |
| `lint` | `object` | mode ringan | `{ "ok": boolean, "count": number, "files": string[], "fileDisplay": string[] }` |
| `pushScope` | `object` | mode `staged-push` | `{ "total": number, "js": number }` — total file yang disentuh commit push (dari pre-push, sebelum filter JS/TS) vs file JS/TS yang di-lint |
| `skippedSteps` | `string[]` | mode ringan | step yang dilewati: `typecheck`, `vitest`, `markdownlint`, `schema-sync`, `warmup` |
| `error` | `string` | hanya saat gagal | pesan penyebab kegagalan (bila ada) |

`files` berisi **full path** (untuk mesin, mis. operasi git); `fileDisplay`
adalah bentuk tampil yang sama dengan output manusia — path panjang
dipotong `head...tail` (default 70 karakter, ujung + induk tetap terlihat):

```json
{"files":["src/app/api/very/deep/nested/directory/structure/this-file-name-is-really-quite-long-indeed.ts"],"fileDisplay":["src/app/api/...structure/this-file-name-is-really-quite-long-indeed.ts"]}
```

Contoh `mode: full` yang lulus:

```json
{"tool":"hooks:check","mode":"full","ok":true,"blocked":false,"guardViolations":[],"check":{"ok":true}}
```

Contoh guard memblokir (mode ringan):

```json
{"tool":"hooks:check","mode":"staged","ok":false,"blocked":true,"guardViolations":["prisma/dev.db"],"lint":{"ok":false,"count":0,"files":[]},"skippedSteps":["typecheck","vitest","markdownlint","schema-sync","warmup"],"error":"Guard repository memblokir perubahan."}
```

Konsumen mesin cukup membaca `ok` (plus `error` bila `false`) — `blocked` dan
`guardViolations` menjelaskan *kenapa*. CI memakai mode ini di job
`hooks-gate` (reusable workflow
[hooks-gate.yml](.github/workflows/hooks-gate.yml)) untuk merender step
summary dari `hooks-check.json`.

#### Pre-push (sanity check cepat)

Saat `hooks:install` aktif, push branch juga menjalankan gate **ringan**
(`--quick`: guard + lint seluruh repo, tanpa typecheck/vitest) — karena
pre-commit sudah menjalankan gate penuh. Push tag dilewati.

Opsi `PUSH_GATE` per push (env) atau `git config pre-push.gate` (per-clone,
persisten):

```bash
PUSH_GATE=full   git push  # gate PENUH: seluruh bun run check (typecheck + lint + lint:md + check:schema + vitest)
PUSH_GATE=staged git push  # lint HANYA file yang disentuh commit yang di-push (diff remote..local; branch baru = semua file)
PUSH_JSON=1      git push  # output machine-readable: stdout = SATU baris JSON (lihat di bawah)

git config pre-push.gate full    # default persisten per clone: gate PENUH di semua push
git config pre-push.gate staged  # default persisten: lint scope push
```

**Precedence:** `PUSH_GATE` (env, per push) menang atas `git config
pre-push.gate` (per-clone, persistent); keduanya kosong → default `--quick`
(lint seluruh repo). Env cocok untuk override satu kali; git config untuk
default yang menetap (mis. repo strict → `full`, repo dev → `staged`). Pesan
pre-push mencantumkan asal mode (`env=staged` / `config=full` / `default
--quick`) agar selalu jelas sumbernya; nilai config yang tak dikenal
memunculkan peringatan lalu fallback `--quick`. `PUSH_JSON=1` bisa digabung
dengan mode mana pun — stdout membawa SATU baris JSON (payload gate
[run-checks.sh](.githooks/run-checks.sh) `--json` diteruskan apa adanya,
termasuk exit code `0`/`1`/`2`); semua detail manusia dipindah ke stderr.
Push tag-only menghasilkan `{"tool":"pre-push","mode":"skip-tag","ok":true}`.
Skema payload gate sama dengan `hooks:check -- --json` (lihat tabel di atas).

Lewati sementara (tidak disarankan):

```bash
git push --no-verify
```

#### Lewati gate penuh (tidak disarankan — melewati SEMUA guard & validasi)

```bash
git commit --no-verify
```

### E2E Troubleshooting (Playwright)

`bun run test:e2e` menjalankan wrapper [scripts/run-e2e.ts](scripts/run-e2e.ts)
dengan alur: **tentukan server target → panaskan rute → jalankan
`playwright test` → bersihkan server & tulis artifact log**. Bagian ini
menjelaskan tiap tahap dan cara mendiagnosa kegagalan.

#### Env var (knob E2E)

Semua perilaku wrapper bisa diatur lewat env var — ringkasan cepat (detail
tiap tahap di bawah):

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
| *Catatan CI* | — | **Override CI** (di env level **workflow**, [ci.yml](.github/workflows/ci.yml) & [playwright.yml](.github/workflows/playwright.yml)): `E2E_TAIL_LINES` default `100` → **`200`** (stdout, 2× agar stall cold-compile + query prisma selalu terlihat penuh); `E2E_TAIL_LINES_ERR` default `15` → **`100`** (stderr, dalam agar error context / stack trace tidak hilang). Kedua nilai didefinisikan SATU kali di level workflow agar step `Run E2E tests` dan `Check tail heading matches E2E_TAIL_LINES` memakai definisi yang sama. |

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

#### Server target (urutan prioritas)

1. **`E2E_BASE_URL`** — override eksplisit, menang selalu.
2. **`.zscripts/dev.pid` + `.zscripts/dev.port`** — port dev server developer
   (ditulis `.zscripts/dev.sh`); dipakai otomatis. Bila basi (tidak merespons
   probe), wrapper jatuh ke server baru di `E2E_PORT`.
3. **`http://localhost:E2E_PORT`** (default `3000`) — wrapper memulai
   `E2E_SERVER_CMD` (default `bun run dev`) bila belum ada server di sana.

#### Warm-up rute (cold-compile Turbopack)

Dev mode Next.js meng-compile route **saat pertama diakses** — request pertama
ke handler API (terutama mutasi `DELETE`/`PUT`) bisa stall 5–10 detik. Untuk
menghilangkan kelas flake ini, wrapper memanaskan rute sebelum suite:
[e2e/warmup.ts](e2e/warmup.ts) memuat rute default + rute dari pragma
`// warmup:` di tiap spec + rute API dinamis (`/api/.../__warmup__`) + rute
dari laporan mutasi [e2e/mutation-log.ts](e2e/mutation-log.ts).

Pragma bisa **path-only** (mencakup semua method) atau **method-spesifik**
(menutupi method itu saja), dan bisa banyak dalam satu baris — contoh asli:

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

#### `--if-up` (pakai dev server yang sedang hidup)

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

#### Server log artifact

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

Saat suite gagal, **100 baris terakhir stdout** + **15 baris terakhir
stderr** (ubah lewat `E2E_TAIL_LINES` & `E2E_TAIL_LINES_ERR`) dicetak ke
konsol wrapper dan step summary GitHub (`GITHUB_STEP_SUMMARY`).

#### Tren non-2xx antar run (alert regresi diam-diam)

Setiap run menambahkan **satu baris** ke `e2e-stats.jsonl` (gitignored,
skema di [scripts/e2e-stats.ts](scripts/e2e-stats.ts)): jumlah request &
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

#### Triage kegagalan otomatis

Saat suite gagal, wrapper **otomatis** menjalankan
[scripts/triage-e2e.ts](scripts/triage-e2e.ts) dan mencetak verdict-nya
(konsol + step summary + artifact `server-e2e.log`). Verdict mengelompokkan
kegagalan: **warmup-failed** (section wrapper terlalu kecil / status jauh di
bawah deklarasi — warm-up gagal diam-diam), **stall** (mutasi ≥ 5s =
cold-compile Turbopack), **DNS/network** (`ENOTFOUND`, `fetch failed`, …),
atau **assertion** (timeout, error-context).

**Laporan batas section:** auto-triage men-scan **artifact merged**
(`server-e2e.log` — wrapper + server dalam satu file), bukan log server
mentah, jadi output-nya memuat batas section:

```
[e2e:triage] Section artifact: wrapper L1–8 · separator L9 · server L10–17
[e2e:triage] ⚠️  1 stall mutasi (>= 5s) di server log:
   - [server] L15: POST /api/bos-upload in 8213ms
```

Blok pembuka ber-prefix `[e2e] ` (status warm-up `✓/◇/✗` per rute, alur
wrapper) = section **wrapper**, sisanya = section **server**. Tiap temuan
di-tag dengan section asalnya + nomor baris, jadi langsung terlihat apakah
masalahnya di warm-up (wrapper) atau runtime server. Log mentah tanpa
bagian wrapper (reuse `dev.log` tanpa artifact) dilaporkan sebagai
`Section artifact: log mentah (tanpa bagian wrapper — bukan artifact merged)`.

**Peringatan kesehatan section wrapper (`WARM-UP WARNING:`):** triage juga
memeriksa section wrapper artifact merged untuk warm-up yang **gagal
diam-diam** — dua heuristik `warnWrapperHealth` di
[scripts/triage-e2e.ts](scripts/triage-e2e.ts):

1. **Section wrapper sangat kecil** (< 5 baris non-kosong) — warm-up
   sepertinya tidak berjalan atau outputnya hilang.
2. **Status rute jauh di bawah deklarasi** — jumlah `✓/◇/✗` kurang dari
   `memanaskan N rute` (warm-up gagal sebagian).

Bila terdeteksi, warning di-surface di semua permukaan:

```
[e2e] WARM-UP WARNING: section wrapper sangat kecil (2 baris non-kosong) — warm-up mungkin GAGAL diam-diam.
```

- Wrapper auto-triage mencetak baris greppable `WARM-UP WARNING: <teks>`
  tepat di samping `VERDICT:` (konsol + artifact merged + step summary).
- Triage menulis `⚠️ <teks>` di laporan manusia dan field `wrapperWarning`
  di payload `--json`; komentar PR menampilkan `- **⚠️ Warm-up warning:**
  <teks>` (atau sebagai reason verdict `warmup-failed` — lihat bawah).
- Verdict menjadi **`warmup-failed`** dan **menang** atas counts: warm-up
  yang gagal membuat status pemanasan tidak bisa dipercaya, jadi stall yang
  terlihat kemungkinan besar efek sampingnya. Exit code 1 / `ok: false`, dan
  step CI `Flag cache-flake (cold-compile / warmup-failed)` gagal dengan
  exit 42 — perlakukan seperti cache-flake: rerun dulu sebelum menyelidiki.

Wrapper section yang sehat tidak memicu warning — tanpa `wrapperWarning`,
tidak ada baris `WARM-UP WARNING:` (tanpa noise di run normal).

#### Diagnosa manual: `bun run triage:e2e`

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
tidak bisa dipercaya dan stall yang terlihat kemungkinan besar efek
sampingnya — verdict jadi `warmup-failed` (reason = teks `wrapperWarning`)
walau ada stall, dan exit code/`ok` ikut merah.

**Filter section (`--section wrapper|server`):** batasi analisa ke SATU
section artifact merged — temuan di section lain dan dari laporan Playwright
(yang tidak punya section) **tidak dihitung**; `verdict`, `counts`, dan exit
code ikut scoped, dan payload `--json` membawa field `section`. Berguna
untuk menjawab "apakah warm-up yang bermasalah?" vs "apakah server runtime
yang stall?":

```bash
bun run triage:e2e -- --section wrapper   # hanya temuan di section wrapper
bun run triage:e2e -- --section server    # hanya temuan di section server
```

Contoh: run yang satu-satunya stall-nya ada di section server akan
melaporkan `clean` (exit 0) dengan `--section wrapper` — section itu bersih,
masalahnya di server. Log mentah menandai semua baris sebagai `server`, jadi
`--section wrapper` pada log mentah menghasilkan nol temuan.

Contoh konsumsi dari **step GitHub Actions** (pola yang dipakai workflow
sendiri): jalankan triage `--json` terhadap log merged `./server-e2e.log`,
simpan payload ke file, lalu baca di step berikutnya:

```yaml
      # triage exit 1 = ADA temuan (itu justru yang ditampilkan) — jangan
      # menggagalkan step; continue-on-error + `|| true` menjaga file tetap
      # ditulis walau scan menemukan pola.
      - name: Triage verdict (JSON)
        if: failure()
        continue-on-error: true
        run: bun run triage:e2e -- --json > triage-verdict.json 2>/dev/null || true
        env:
          E2E_SERVER_LOG: ./server-e2e.log

      - name: Consume verdict
        if: failure() && hashFiles('triage-verdict.json') != ''
        run: |
          node -e "
            const v = JSON.parse(require('fs').readFileSync('triage-verdict.json', 'utf8'));
            console.log('verdict:', v.verdict);   // warmup-failed | cold-compile | network | assertion | clean
            console.log('counts :', JSON.stringify(v.counts));   // stalls/slow/dns/timeouts/errors
            console.log('stalls :', v.stalls.length, '· dns:', v.dns.length, '· timeouts:', v.timeouts.length);
            console.log('warning:', v.wrapperWarning);   // warm-up gagal diam-diam?
          "
```

Catatan: `E2E_SERVER_LOG` harus menunjuk log merged hasil run (di CI:
`./server-e2e.log` — ditulis wrapper saat selesai, lalu di-upload sebagai
artifact `server-log`). Tanpa env itu triage memakai fallback log e2e
terdekat di `%TEMP%` — tidak berguna di runner CI yang bersih. Verdict
`cold-compile` berarti cache-flake: rerun dulu sebelum menyelidiki (lihat
*Alur kegagalan di CI* di bawah).

#### Analisa post-hoc: workflow `triage.yml`

Run yang sudah lewat bisa dianalisa ulang **tanpa menjalankan ulang suite**
lewat workflow [triage.yml](.github/workflows/triage.yml) (E2E Triage
(post-hoc)). Workflow mengunduh artifact `server-log` dari run yang dituju,
lalu menjalankan `bun run triage:e2e` di atasnya — verdict
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

#### Alur kegagalan di CI (PR comment, artifacts, step summary)

Bila suite e2e gagal di GitHub Actions ([ci.yml](.github/workflows/ci.yml) —
jobs dev mode `e2e` & gate; [playwright.yml](.github/workflows/playwright.yml)
— `e2e-prod` di atas `next build` + `next start`), diagnostik berjalan
berlapis otomatis:

1. **Wrapper `test:e2e`** mencetak tail log server stdout (`E2E_TAIL_LINES` baris,
   default 100; CI meng-override ke 200 agar stall cold-compile + query
   prisma selalu terlihat) + stderr (`E2E_TAIL_LINES_ERR` baris, default 15;
   CI meng-override ke 100 agar error context / stack trace terekam dalam —
   tidak ada konteks stderr yang hilang) ke konsol step, lalu menulis step
   summary — SATU section `##` yang menggabungkan
   tail log DAN verdict triage (bukan dua blok terpisah): heading
   `## ⚠️ E2E failed — server log tail (N baris stdout · M baris stderr)`,
   lalu sub-blok `### stderr`, `### 🔎 Triage kegagalan (otomatis)`
   (laporan manusia), dan `### 🔎 Triage payload (JSON — untuk bot/CI)`
   (payload `--json` mentah untuk konsumen mesin) — semuanya di bawah
   heading yang sama. Baris `VERDICT: <severity> (… counts …)` dicetak
   persis satu kali di konsol + artifact merged. Heading TIDAK memuat link
   report (dobel dengan blok post-upload) — setiap permukaan punya persis
   SATU link report.
2. **Artifact** di-upload **setiap** run: `server-log` (`server-e2e.log`
   merged: wrapper + server + `*.err`) retention **30 hari**; plus
   `playwright-report` (report + `test-results/`) saat gagal saja, retention
   **7 hari**. Workflow produksi memakai nama `-prod`
   (`server-log-prod`, `playwright-report-prod`). Setelah upload, step
   `Link playwright-report artifact in step summary` menempelkan link
   **langsung** ke artifact (`### 🔗 Playwright report (artifact langsung)`,
   URL dari output `artifact-url` upload-artifact) di bawah section `##`
   failure yang sama — SATU-SATUNYA link report di step summary: satu klik
   menuju report asli, bukan hanya halaman artifacts. Fallback ke halaman
   artifacts bila output kosong. (Link report di komentar PR memakai pola
   URL yang sama — lihat poin 3 — jadi tidak ada dobel antar-permukaan.)
3. **PR comment** (gagal + `pull_request`): komentar sticky ber-marker
   (`<!-- e2e-failure-summary -->` / `…-prod`), di-update di tempat, duplikat
   historis dibersihkan sekali. Isinya verdict triage lengkap — baris
   `🔎 **Triage**` memuat kategori + counts + **teks reason aksi** (mis.
   "kemungkinan cold-compile Turbopack — jalankan ulang dengan cache
   panas", dari field `reason` payload JSON triage — satu sumber kebenaran
   dengan baris `VERDICT:` konsol wrapper), ditambah temuan per-kategori
   (stall/DNS/timeout/error, dipotong 5 per kategori dengan catatan "+N
   lainnya") + warning warm-up bila ada — plus link langsung ke Playwright
   report, server log merged, dan run.
   Link report/log memakai **pola URL run-artifacts yang sama dengan step
   summary** (output `artifact-url` upload-artifact, fallback ke halaman
   artifacts) — satu sumber kebenaran, jadi komentar dan step summary selalu
   menautkan URL yang identik (tidak di-resolve ulang via API).
4. **Flag cache-flake**: saat verdict `cold-compile` **atau** `warmup-failed`,
   step `Flag cache-flake (cold-compile / warmup-failed)` sengaja GAGAL
   dengan **exit 42** + pesan `::error::` khas — rerun karena cache dingin
   terlihat terpisah dari kegagalan nyata (network/assertion).
5. **Post-hoc**: run lama bisa dianalisa ulang tanpa rerun lewat workflow
   `triage.yml` (lihat *Analisa post-hoc* di atas) atau manual setelah
   mengunduh artifact: `bun run triage:e2e`.

## Default Credentials

> **PENTING:** Ganti password setelah login pertama kali!

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@mongisidi1.sch.id | admin123 |
| Operator | operator@mongisidi1.sch.id | operator123 |

## Deployment

### Development
```bash
bun run dev
```

### Production (Standalone)

```bash
# Build
bun run build

# Start
bun run start
```

### Production dengan Caddy (Reverse Proxy)

```bash
# Build
bun run build

# Jalankan Next.js standalone + Caddy
bunx caddy run --config Caddyfile
```

Caddyfile akan reverse proxy dari port 8080 ke port 3000.

## Folder Structure

```
CMS MONSA/
├── .github/
│   └── workflows/
│       └── ci.yml            # CI pipeline (typecheck, lint, test, build)
├── .githooks/
│   └── pre-commit            # Pre-commit hook (bun run check + guard repo)
├── .env.example              # Environment template (copy to .env)
├── .markdownlint-cli2.cjs    # Markdownlint config (lint:md)
├── prisma/
│   ├── schema.prisma          # Database schema (SQLite)
│   ├── schema.postgres.prisma # PostgreSQL variant
│   └── seed.ts                # Seed data
├── public/
│   ├── uploads/               # User-uploaded files
│   └── ...
├── scripts/
│   └── markdownlint/          # Custom markdownlint rules (CUSTOM001/002)
├── src/
│   ├── app/
│   │   ├── api/               # REST API routes
│   │   ├── dashboard/         # Admin panel — 17 modul, satu route App Router per modul
│   │   ├── page.tsx           # Home page (public site)
│   │   └── layout.tsx         # Root layout
│   ├── components/
│   │   ├── auth/              # Login views
│   │   ├── dashboard/         # Admin panel
│   │   ├── public/            # Public website views
│   │   ├── shared/            # Reusable components
│   │   └── ui/                # shadcn/ui components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities & helpers
│   └── store/                 # Zustand store
├── e2e/                       # Playwright E2E tests
├── vitest.config.ts           # Vitest configuration
├── playwright.config.ts       # Playwright configuration
└── package.json
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | - | Login |
| POST | `/api/auth/logout` | - | Logout |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/news` | - | List news (public) |
| POST | `/api/news` | Operator | Create news |
| GET | `/api/announcements` | - | List announcements |
| POST | `/api/announcements` | Operator | Create announcement |
| GET | `/api/gallery` | - | List gallery items |
| POST | `/api/gallery` | Operator | Create gallery item |
| GET | `/api/teachers` | - | List teachers |
| POST | `/api/teachers` | Operator | Create teacher |
| GET | `/api/achievements` | - | List achievements |
| POST | `/api/achievements` | Operator | Create achievement |
| POST | `/api/complaints` | - | Submit complaint |
| GET | `/api/complaints` | Operator | List complaints |
| POST | `/api/contact` | - | Submit contact form |
| GET | `/api/site-settings` | - | Get site settings |
| GET | `/api/activity-logs` | Admin | Get activity logs |
| POST | `/api/upload` | Operator | Upload file |

## License

Private — UPT SPF SD Negeri Unggulan Mongisidi 1
