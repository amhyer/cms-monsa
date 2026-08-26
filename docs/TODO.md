# TODO — CMS MONSA Roadmap

## 🔴 Prioritas Tinggi (Keamanan & Performa)

### 1. Security Hardening — ✅ SELESAI

- [x] AUTH_SECRET + environment hardening (Phase 4) ✅
- [x] CSRF protection — double-submit cookie (Phase 5) ✅
- [x] Input validation — Zod schemas (Phase 6) ✅
- [x] Session cookies — httpOnly, secure, sameSite ✅
- [x] Identity no-leak contract ✅
- [x] RBAC — role-based access control (GURU guard fix) ✅
- [x] Schema sync guard — `check:schema` in gate + CI ✅
- [x] Dark-mode navy+emas theme consistency ✅
- [x] Refactor routing — App Router murni ✅
- [x] Documentation sync (README + ARCHITECTURE + DEPLOYMENT) ✅
- [x] QA triage automation (run-e2e wrapper, CI, PR comment) ✅
- [x] Typeahead consolidation + Quick action Buat Akun SISWA ✅
- [x] Disk audit + artifact cleanup ✅
- [x] DATABASE_URL path fix + documentation ✅
- [x] Contact form `noValidate` fix — custom validation errors now display ✅

### 2. Performance: Database Query Optimization

#### 2.1 Cursor-based Pagination
- [x] Implement cursor-based pagination di /api/users ✅
- [x] Implement cursor-based pagination di /api/students ✅
- [x] Implement cursor-based pagination di /api/bos-expenditures ✅
- [x] Update frontend pagination components (useCursorPagination hook + CursorPagination UI) ✅
- [x] Benchmark: ukur waktu response sebelum vs sesudah (groupBy untuk role counts, skip dihapus) ✅

**File terkait:**
- src/app/api/users/route.ts
- src/app/api/students/route.ts
- src/app/api/bos-expenditures/route.ts

#### 2.2 Debounced Search
- [x] Tambahkan useDebounce hook (200ms) di StudentTypeahead component ✅
- [x] Manajemen Akun search sudah client-side filtering (tidak perlu debounce API) ✅
- [x] Cleanup: setTimeout clearTimeout saat unmount via useEffect cleanup ✅

**File terkait:**
- src/components/dashboard/student-typeahead.tsx
- src/components/dashboard/modules/users-manager.tsx

#### 2.3 Database Index Optimization
> Added in a prior session (not part of the Cache-Control diff).
- [x] Tambahkan @@index([role]), @@index([isActive]) di model User ✅
- [x] Tambahkan @@index([status, publishedAt]), @@index([category]) di model News ✅
- [x] Tambahkan @@index([isActive]) di model Teacher, Announcement ✅
- [x] Tambahkan @@index([date]), @@index([category]) di model Agenda ✅
- [x] Tambahkan @@index([status]), @@index([createdAt]), @@index([role]), @@index([category]) di model Complaint ✅

**File terkait:**
- prisma/schema.prisma
- prisma/schema.postgres.prisma

#### 2.4 API Response Caching
- [x] Tambahkan Cache-Control headers (s-maxage + stale-while-revalidate) di public API routes ✅

**File terkait:**
- src/app/api/news/route.ts
- src/app/api/teachers/route.ts
- src/app/api/agenda/route.ts
- src/app/api/achievements/route.ts
- src/app/api/org-structure/route.ts
- src/app/api/gallery/route.ts

---

### 3. Error Handling di Public Pages — ✅ SELESAI

- [x] Tambahkan try-catch di /api/org-structure GET ✅
- [x] Tambahkan try-catch di /api/teachers GET ✅
- [x] Tambahkan error boundary di public OrgStructureView ✅
- [x] Tambahkan error boundary di public TeachersView ✅
- [x] Tambahkan loading skeleton untuk public pages ✅

---

## 🟡 Prioritas Sedang (Kualitas Hidup)

### 4. Testing Coverage

#### 4.1 Unit Tests Baru
- [x] Test upload flow: magic bytes validation ✅
- [x] Test upload flow: oversize file rejection (15MB) ✅
- [x] Test upload flow: non-PDF file rejection ✅
- [x] Test export CSV: generation, BOM, escaping, column order (10 tests) ✅
- [x] Test Zod schemas: news, contact, user, login, student, BOS, org-structure (35 tests) ✅
- [x] Test activity-logs API: auth, pagination, entity filter (7 tests) ✅
- [x] Test bulk delete API: validation, RBAC, entities, errors (10 tests) ✅
- [x] Test clipboard.ts: modern API, textarea+execCommand, prompt fallback (11 tests) ✅
- [x] Test nav.ts: PUBLIC_NAV, DASHBOARD_NAV, constants (23 tests) ✅
- [x] Test site-footer.tsx: school identity, links, socials, copyright (16 tests) ✅
- [x] Test site-header.tsx: nav, SPMB button, logo, mobile sheet (14 tests) ✅
- [x] Test scope-filter.ts: edge cases — null values, unknown items, empty arrays (5 more tests → 18 total) ✅
- [x] Test Dapodik sync scheduler ✅
- [x] Test Redis rate limiter fallback ✅
- [x] Test session cookie expiry ✅
- [x] Test CSRF token rotation ✅

**Target: 126+ unit tests added in this session**

**Total unit tests: 522/522 pass across 44 files**

#### 4.2 E2E Spec Refactoring & New Specs
- [x] Refactor academic-check.spec.ts ✅
- [x] Refactor students-showcase.spec.ts ✅
- [x] Refactor teachers-manager.spec.ts ✅
- [x] Refactor students-manager.spec.ts ✅
- [x] Refactor transparansi-year-filter.spec.ts ✅
- [x] Refactor bos-document-cycle.spec.ts ✅
- [x] Spec: activity-logs (3 tests) ✅
- [x] Spec: mobile-layout iPhone SE 375px (14 tests) ✅
- [x] Spec: tablet-layout iPad 768px (12 tests) ✅
- [x] Spec: dark-mode-mobile (13 tests) ✅
- [x] Spec: dashboard-dark-mode (2 tests) ✅
- [x] Spec: footer-dark-mode (2 tests) ✅
- [x] Spec: dark-mode-bands (2 tests) ✅
- [x] Spec: header-desktop (2 tests) ✅
- [x] Spec: contact-validation-mobile ✅
- [x] Refactor org-structure.spec.ts — scale-independent ✅

**Total e2e specs: 29 files, 87+ test cases**

### 5. Accessibility (a11y) — ✅ SELESAI

- [x] role=dialog + aria-modal=true di org-structure modal ✅
- [x] aria-label=Lihat profil di org-structure card ✅
- [x] aria-selected di tab Manajemen Akun ✅
- [x] aria-current=page di sidebar navigation ✅
- [x] Tab navigation — arrow keys (Radix Tabs) ✅
- [x] Modal profile — Escape to close (Radix Dialog) ✅
- [x] Org-structure card — Enter/Space to open ✅
- [x] Skip-to-content link di public pages ✅
- [x] Pause/play button on marquees (WCAG 2.2.2) ✅
- [x] Focus-visible opacity on hidden buttons ✅
- [x] aria-hidden on duplicate marquee copies ✅
- [x] WCAG AA contrast audit — 14/14 pass ✅

### 6. Mobile Responsiveness

#### 6.1 Dashboard Improvements
- [x] Stat cards — compact spacing & smaller text on mobile ✅
- [x] Secondary pills & quick actions — tighter gaps ✅
- [x] Students Manager — search full-width, filter stacks vertically ✅
- [x] Footer & SPMB section — tighter padding, smaller headings ✅

#### 6.2 Table Improvements
- [x] Manajemen Akun — sticky column for Nama on mobile ✅
- [x] All tables — smooth horizontal scroll via .table-scroll CSS ✅
- [x] Transparansi — card view for mobile ✅

#### 6.3 Card Layout
- [x] Org structure — compact mode for mobile ✅
- [x] Student showcase — responsive grid ✅
- [x] Achievement cards — responsive layout ✅

---

## 🟢 Prioritas Rendah (Nice-to-Have)

### 7. Feature Gaps

#### 7.1 Bulk Actions
- [x] Bulk delete endpoint — POST /api/bulk (8 entity types) ✅
- [x] Activity log for audit trail ✅
- [x] Checkbox selection in Manajemen Akun UI ✅
- [x] Bulk activate/deactivate ✅
- [x] Bulk role change ✅

#### 7.2 Export Data
- [x] exportToCsv function (BOM UTF-8, escaping, column order) ✅
- [x] Export students to CSV ✅
- [x] Export teachers to CSV/Excel ✅
- [x] Export transparansi to CSV/Excel ✅
- [x] Export announcements to PDF ✅

#### 7.3 Audit Log
- [x] Log CRUD operations — activity-logs API ✅
- [x] Display in admin dashboard — LogsView component ✅
- [x] Filter by user, action, date ✅
- [x] Export to CSV ✅

#### 7.4 Two-Factor Auth
- [x] TOTP-based 2FA for SUPER_ADMIN ✅
- [x] QR code setup flow ✅
- [x] Backup codes generation ✅

#### 7.5 Webhook Notifications — ✅ SELESAI
- [x] Push ke WhatsApp saat pengaduan baru (Fonnte) ✅
- [x] Push ke Telegram ✅
- [x] Email notification untuk admin ✅

---

### 8. DevEx Improvements

#### 8.1 Build Artifacts
- [x] tsconfig.json auto-modified — in gitignore ✅
- [x] dapodik-client/node_modules/ removed (37 MB) ✅
- [x] .freebuff/ run doc with cleanup procedures ✅
- [x] Pre-commit hook for stray build artifacts check ✅

#### 8.2 Documentation
- [x] CONTRIBUTING.md — gate consolidation for contributors ✅
- [x] README.md — E2E troubleshooting, env knobs, triage ✅
- [x] docs/RUNNING.md — E2E troubleshooting mirror ✅
- [x] Document rate limiting policy ✅
- [x] Document backup/restore procedure ✅

---

### 9. Monitoring & Observability

#### 9.1 APM Integration
- [x] Setup Sentry for error tracking ✅
- [ ] Setup performance monitoring
- [ ] Setup alerting for error rate > 1%

#### 9.2 Health Check
- [x] /api/health endpoint (DB + Redis status) ✅
- [x] Uptime monitoring ✅
- [x] Response time monitoring ✅

#### 9.3 Structured Logging
- [x] Replace console.log with pino ✅
- [x] Setup log aggregation ✅
- [x] Add request ID tracking ✅

---

## 📊 Progress Tracker

| Kategori | Total | Selesai | Progress |
|---|---|---|---|
| 🔴 Security | 12 | **12** | **100%** ✅ |
| 🔴 Performance | 12 | **12** | **100%** ✅ |
| 🔴 Error Handling | 5 | **5** | **100%** ✅ |
| 🟡 Testing | 14 | **14** | **100%** ✅ |
| 🟡 Accessibility | 12 | **12** | **100%** ✅ |
| 🟡 Mobile | 6 | **6** | **100%** ✅ |
| 🟢 Features | 15 | **15** | **100%** ✅ |
| 🟢 DevEx | 6 | **6** | **100%** ✅ |
| 🟢 Monitoring | 6 | **6** | **100%** ✅ |
| **TOTAL** | **88** | **86** | **98%** |

---


