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
| Database | Prisma ORM + SQLite (dev) / PostgreSQL (produksi via `schema.postgres.prisma`) |
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

## Prerequisites

- Node.js >= 20.9.0
- bun (atau npm)
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

Buat file `.env` di root project:

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

# Seed data contoh
npx tsx prisma/seed.ts
```

## Scripts

```bash
bun run dev           # Development server (port 3000)
bun run build         # Production build
bun run start         # Production server
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking (tsc --noEmit)
npm run check         # Gerbang validasi: typecheck + lint + test
npm test              # Unit & integration tests (Vitest)
bun run test:watch    # Tests dalam mode watch
bun run test:coverage # Tests dengan coverage report
bun run test:e2e      # End-to-end tests (Playwright)
npm run hooks:install # Aktifkan pre-commit hook (core.hooksPath)
bun run db:push       # Push schema ke database
bun run db:generate   # Generate Prisma client
```

## Development

### Script Validasi

Sebelum commit, jalankan gerbang validasi untuk memastikan kode sehat:

```bash
npm run typecheck  # TypeScript: tsc --noEmit (0 error)
npm run lint       # ESLint (0 error)
npm run test       # Vitest — unit & integration tests
npm run check      # Semua di atas sekaligus (typecheck && lint && test)
```

`npm run check` adalah gerbang tunggal yang dipakai oleh pre-commit hook.
Perintah ini berhenti (short-circuit) di kegagalan pertama dan mengembalikan
exit code non-zero — cocok untuk pipeline CI maupun pre-commit. CI
(`.github/workflows/ci.yml`) menjalankan typecheck, lint, dan test sebagai
step terpisah agar setiap kegagalan terlihat jelas di laporan GitHub Actions.

### Pre-commit Hook

Hook ter-versi di `.githooks/pre-commit` otomatis menjalankan `npm run check`
(typecheck + lint + test) **sebelum setiap commit**. Jika salah satu gagal,
commit ditolak dan error ditampilkan.

Aktifkan sekali per clone:

```bash
npm run hooks:install  # set git config core.hooksPath .githooks
```

Selain validasi kode, hook juga **menolak commit** yang melanggar aturan
repository (lihat `REPO_HEALTH_AUDIT.md` bagian C.9):

- **File `.db` / `.db-journal` / `.env*` ter-stage** (kecuali
  `.env.example`) — mencegah database/secret ter-commit secara tidak sengaja.
- **Penghapusan `src/app/api/upload/route.ts` / `src/proxy.ts`** — file
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
npx caddy run --config Caddyfile
```

Caddyfile akan reverse proxy dari port 8080 ke port 3000.

## Folder Structure

```
CMS MONSA/
├── prisma/
│   ├── schema.prisma          # Database schema (SQLite)
│   ├── schema.postgres.prisma # PostgreSQL variant
│   └── seed.ts                # Seed data
├── public/
│   ├── uploads/               # User-uploaded files
│   └── ...
├── src/
│   ├── app/
│   │   ├── api/               # REST API routes
│   │   ├── page.tsx           # SPA entry point
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
