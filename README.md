# CMS MONSA — UPT SPF SD Negeri Unggulan Mongisidi 1

Sistem Manajemen Konten (CMS) untuk website sekolah UPT SPF SD Negeri Unggulan Mongisidi 1, Makassar.

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
| `/dashboard/payments` | Pembayaran (SPP) | Super Admin / Operator |
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
bun run hooks:install # Aktifkan pre-commit hook (core.hooksPath)
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

`npm run check` adalah gerbang tunggal yang dipakai oleh pre-commit hook.
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

Hook ter-versi di [.githooks/pre-commit](.githooks/pre-commit) otomatis menjalankan
`npm run check` (typecheck + lint + test) **sebelum setiap commit**. Hook
memakai `npm run check` (bukan `bun run check`) agar tetap berjalan di mesin
developer yang belum menginstal bun — kedua perintah mengeksekusi script
`package.json` yang sama. Jika salah satu gagal, commit ditolak dan error
ditampilkan.

Aktifkan sekali per clone:

```bash
bun run hooks:install  # set git config core.hooksPath .githooks
```

Selain validasi kode, hook juga **menolak commit** yang melanggar aturan
repository (lihat [REPO_HEALTH_AUDIT.md](REPO_HEALTH_AUDIT.md) bagian C.9):

- **File `.db` / `.db-journal` / `.env*` ter-stage** (kecuali
  [.env.example](.env.example)) — mencegah database/secret ter-commit secara tidak sengaja.
- **Penghapusan [src/app/api/upload/route.ts](src/app/api/upload/route.ts) /
  [src/proxy.ts](src/proxy.ts)** — file
  kritikal yang wajib selalu ada di repository.

Guard ini berjalan **sebelum** validasi kode, jadi pelanggaran aturan
langsung ditolak tanpa menunggu typecheck/lint/test.

Lewati sementara (tidak disarankan):

```bash
git commit --no-verify
```

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
│   └── pre-commit            # Pre-commit hook (npm run check + guard repo)
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
