# 📋 Changelog — CMS MONSA

> Semua perubahan signifikan pada CMS MONSA akan didokumentasikan di file ini.
> Format berdasarkan [Keep a Changelog](https://keepachangelog.com/).

---

## [1.0.0] - 2026-08-22

### 🎉 Release Highlights

CMS MONSA v1.0.0 adalah release pertama yang lengkap dengan **88/88 items (100%)** dari improvement plan. Release ini mencakup security hardening, performance optimization, accessibility compliance, dan fitur-fitur lengkap untuk manajemen sekolah.

### ✨ Added

#### Security
- Rate limiting untuk 6 public GET endpoints dan 3 form endpoints
- Session cookies dengan `httpOnly`, `secure`, `sameSite: lax`, dan `__Host-` prefix
- NIS/NISN scraping protection dengan rate limiting 30-60 req/menit
- CSRF protection menggunakan double-submit cookie pattern
- RBAC (Role-Based Access Control) dengan hierarchy SUPER_ADMIN > OPERATOR > GURU > ORANG_TUA/SISWA

#### Performance
- Cursor-based pagination untuk `/api/users`, `/api/students`, `/api/bos-expenditures`
- `useCursorPagination` hook dan `CursorPagination` UI component
- Debounced search (200ms) di StudentTypeahead component
- Database indexes untuk role, isActive, date, category

#### Testing
- 562 unit tests across 46 test files
- 87+ E2E tests across 29 spec files
- Tests untuk: upload flow, Dapodik scheduler, Redis rate limiter, CSRF, auth, pagination, export

#### Accessibility (a11y)
- ARIA improvements: `role=dialog`, `aria-modal`, `aria-selected`, `aria-current`
- Keyboard navigation: Tab, Arrow, Escape, Enter/Space
- Skip-to-content link di public pages
- WCAG AA contrast compliance (semua badge pass 4.5:1+)

#### Mobile Responsiveness
- Sticky column untuk Nama di Manajemen Akun (mobile)
- Card view untuk Transparansi (mobile)
- Compact mode untuk Org Structure (mobile)
- Responsive grid untuk Student Showcase dan Achievement cards
- Horizontal scroll untuk semua tables

#### Features
- **Bulk Actions**: Checkbox selection + bulk delete/activate/deactivate/role change
- **Export CSV**: Siswa, guru, transparansi
- **Export PDF**: Pengumuman (jsPDF client-side)
- **Audit Log**: CRUD logging + LogsView + filter + CSV export
- **2FA (TOTP)**: Setup flow + QR code + backup codes + login integration
- **WhatsApp/Telegram Webhooks**: Notifikasi otomatis saat pengaduan/pesan baru
- **Email Notifications**: Admin notifications untuk kontak dan pengaduan

#### DevEx
- Build artifacts cleanup + .gitignore + pre-commit hook
- Documentation: CONTRIBUTING.md, README.md, RUNNING.md
- Docker deployment files: Dockerfile, docker-compose.yml, .dockerignore
- Nginx reverse proxy configuration

#### Monitoring
- **Sentry**: Error tracking (`@sentry/nextjs` + client/server/edge configs)
- **Health Endpoint**: `/api/health` dengan DB, Redis, uptime, latency, memory metrics
- **Uptime Monitoring**: Health check script + UptimeRobot/BetterUptime docs
- **Structured Logging**: Pino + pino-pretty + request ID tracking
- **Log Aggregation**: Loki + Grafana + Promtail (Docker Compose stack)

### 🔧 Changed

- Upgraded to Next.js 16.1.1
- Upgraded to React 19
- Upgraded to Prisma 6.19.2
- Migrated from console.log to pino structured logging
- Migrated error boundaries to capture exceptions via Sentry
- Updated CSP to allow Sentry DSN connections
- Updated `.gitignore` to exclude `.next-gate/` (generated types)

### 🐛 Fixed

- Pino logger argument order (object first, message second)
- Pagination generic type constraint (`T extends { id: string }`)
- Clipboard test mocks (removed unused `@ts-expect-error` directives)
- StudentTypeahead useMemo dependency array (`debouncedQuery` instead of `query`)
- WhatsApp test mocks (spy on `logger` instead of `console`)
- `.next-gate` TypeScript errors (excluded from tsconfig)

### 🔒 Security

- **AUTH_SECRET**: HMAC-signed session cookies
- **CSRF**: Double-submit cookie pattern
- **Rate Limiting**: Login brute-force (5 attempts → 15min lock), public form anti-spam, GET anti-scraping
- **SQL Injection**: Prisma ORM parameterized queries
- **XSS**: React auto-escaping + CSP headers
- **Session Expiry**: Server-side 7 hari
- **2FA**: TOTP-based for SUPER_ADMIN (otpauth + qrcode)

---

## [0.9.0] - 2026-08-21

### ✨ Added

- Initial improvement plan (88 items across 9 categories)
- Security hardening phase (12/12 items)
- E2E spec refactoring for Dapodik scale
- Accessibility improvements (WCAG AA compliance)
- Mobile responsive improvements

### 🔧 Changed

- Refactored E2E specs to be scale-independent
- Updated org-structure spec to use API data (not hardcoded seed)

---

## [0.8.0] - 2026-08-20

### ✨ Added

- Dapodik sync scheduler improvements
- Auto-sync functionality
- Preview mode for Dapodik data
- Test connection endpoint

### 🐛 Fixed

- Dapodik sync pagination for large datasets
- NIS resolution (numeric format)

---

## [0.7.0] - 2026-08-19

### ✨ Added

- Activity logging for all CRUD operations
- LogsView component in admin dashboard
- Entity filter for activity logs
- CSV export for activity logs

### 🔧 Changed

- Migrated 48 route files to use `logActivity`

---

## [0.6.0] - 2026-08-18

### ✨ Added

- Bulk delete endpoint (`POST /api/bulk`)
- RBAC for bulk operations
- Confirmation dialog for bulk actions

### 🔧 Changed

- Updated users-manager with bulk action toolbar

---

## [0.5.0] - 2026-08-17

### ✨ Added

- Export CSV function with BOM UTF-8, escaping, column order
- Export siswa to CSV
- Export guru to CSV
- Export transparansi to CSV

### 🔧 Changed

- Updated students-manager, teachers-manager with export buttons

---

## [0.4.0] - 2026-08-16

### ✨ Added

- Error boundaries for public pages (OrgStructure, Teachers)
- Loading skeletons for public pages
- Graceful fallback for API errors

### 🔧 Changed

- Added try-catch to `/api/org-structure` and `/api/teachers`

---

## [0.3.0] - 2026-08-15

### ✨ Added

- Cursor-based pagination for users, students, bos-expenditures
- `useCursorPagination` hook
- `CursorPagination` UI component
- Debounced search (200ms) in StudentTypeahead

### 🔧 Changed

- Updated 3 manager components to use cursor-based pagination

---

## [0.2.0] - 2026-08-14

### ✨ Added

- Rate limiting for all public endpoints
- Session cookie hardening (__Host- prefix)
- NIS/NISN scraping protection
- CSRF protection for all mutation endpoints

### 🔧 Changed

- Updated auth.ts with __Host- prefix
- Updated csrf.ts with double-submit cookie pattern

---

## [0.1.0] - 2026-08-13

### ✨ Added

- Initial CMS MONSA release
- Next.js 16 + React 19 + Tailwind CSS
- Prisma ORM with SQLite/PostgreSQL support
- RBAC (SUPER_ADMIN, OPERATOR, GURU, ORANG_TUA, SISWA)
- Public pages: Home, News, Teachers, Gallery, Contact
- Admin dashboard with modules
- Dark mode (navy + emas theme)

---

## 📊 Statistics

### Total Changes

| Metric | Value |
|--------|-------|
| **Total Commits** | 50+ |
| **Total Files Changed** | 200+ |
| **Total Insertions** | 15,000+ |
| **Total Deletions** | 2,000+ |
| **Unit Tests** | 562 |
| **E2E Tests** | 87+ |
| **Test Files** | 46 |

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.1 | Framework |
| react | 19.0.0 | UI |
| prisma | 6.19.2 | ORM |
| pino | 10.3.1 | Logging |
| @sentry/nextjs | 10.70.0 | Error tracking |
| otpauth | 9.5.1 | 2FA (TOTP) |
| jspdf | 4.2.1 | PDF export |
| qrcode | 1.5.4 | QR code generation |
| pino-loki | 3.0.0 | Log aggregation |

---

*Changelog ini diupdate setiap kali ada release baru.*
