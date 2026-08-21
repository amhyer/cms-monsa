# 📋 CMS MONSA — Improvement Plan

> Dibuat: 21 Agustus 2026
> Status: **In Progress**

---

## 🔴 Prioritas Tinggi (Impact Langsung)

### 1. Security Hardening

#### 1.1 Rate Limiter Tuning
- [x] Naikkan public form rate limit dari 10 ke 20 ✅ req/10min untuk form pengaduan
- [x] Tambahkan rate limiting ke /api/students/showcase (publik) — max 30 req/menit ✅
- [x] Tambahkan rate limiting ke /api/bos-expenditures publik GET — max 60 req/menit ✅
- [x] Dokumentasikan semua rate limit (6 public GET + 3 form) ✅

**File terkait:**
- src/lib/rate-limit.ts (line 139: max = 10)
- src/app/api/students/showcase/route.ts (belum ada rate limit)
- src/app/api/complaints/route.ts (sudah pakai rateLimitPublicForm)

#### 1.2 Session Cookie Hardening
- [x] Session cookies sudah httpOnly: true + secure: true ✅
- [x] sameSite: lax di production ✅
- [x] Tambahkan __Host- prefix untuk session cookie di production ✅
- [x] Audit CSRF token cookie — httpOnly: false (intentional, JS reads token) ✅

**File terkait:**
- src/lib/auth.ts (line 121-129)
- src/lib/csrf.ts (line 18: httpOnly: false)

#### 1.3 NIS/NISN Scraping Protection
- [x] Tambahkan rate limiting ke /api/students/showcase (publik) — max 30 req/menit ✅
- [x] Rate limiting 30-60 req/menit sebagai anti-scraping (lebih baik dari CAPTCHA) ✅
- [x] Scraper detection: warn log saat IP exceeds limit di rate limiter ✅
- [x] Audit: 3 public endpoints return NIS/NISN (students/showcase, achievements, org-structure profile) ✅

---

### 2. Performance: Database Query Optimization

#### 2.1 Cursor-based Pagination
- [ ] Implement cursor-based pagination di /api/users
- [ ] Implement cursor-based pagination di /api/students
- [ ] Implement cursor-based pagination di /api/bos-expenditures
- [ ] Update frontend pagination components
- [ ] Benchmark: ukur waktu response sebelum vs sesudah

**File terkait:**
- src/app/api/users/route.ts
- src/app/api/students/route.ts
- src/app/api/bos-expenditures/route.ts

#### 2.2 Debounced Search
- [ ] Tambahkan debounce 250ms di StudentTypeahead component
- [ ] Tambahkan debounce 250ms di Manajemen Akun search box
- [ ] Pastikan debounce cleanup saat component unmount

**File terkait:**
- src/components/dashboard/student-typeahead.tsx
- src/components/dashboard/modules/users-manager.tsx

---

### 3. Error Handling di Public Pages

#### 3.1 Graceful Fallback
- [ ] Tambahkan try-catch di /api/org-structure GET
- [ ] Tambahkan try-catch di /api/teachers GET
- [ ] Tambahkan error boundary di public OrgStructureView
- [ ] Tambahkan error boundary di public TeachersView
- [ ] Tambahkan loading skeleton untuk public pages

---

## 🟡 Prioritas Sedang (Kualitas Hidup)

### 4. Testing Coverage

#### 4.1 Unit Tests Baru
- [ ] Test upload flow: magic bytes validation
- [ ] Test upload flow: oversize file rejection (15MB)
- [ ] Test upload flow: non-PDF file rejection
- [ ] Test Dapodik sync scheduler
- [ ] Test Redis rate limiter fallback
- [ ] Test session cookie expiry
- [ ] Test CSRF token rotation

**Target: tambah 50+ unit tests**

#### 4.2 E2E Spec Refactoring (Scale-Independent)
- [ ] Refactor academic-check.spec.ts
- [ ] Refactor org-structure.spec.ts (public)
- [ ] Refactor students-showcase.spec.ts
- [ ] Refactor teachers-manager.spec.ts
- [ ] Refactor students-manager.spec.ts (quick action)
- [x] Refactor transparansi-year-filter.spec.ts (page.evaluate) ✅
- [ ] Refactor bos-document-cycle.spec.ts

**Target: semua 88 tests hijau di skala Dapodik**

---

### 5. Accessibility (a11y)

#### 5.1 ARIA Improvements
- [ ] Tambahkan role=dialog + aria-modal=true di org-structure profile modal
- [ ] Tambahkan aria-label=Tutup profil di modal close button
- [ ] Tambahkan aria-selected di tab Manajemen Akun
- [ ] Tambahkan aria-current=page di sidebar navigation

#### 5.2 Keyboard Navigation
- [ ] Tab navigation — support arrow keys untuk tab switching
- [ ] Modal profile — support Escape untuk close
- [ ] Typeahead — support arrow keys (sudah ada di achievements)
- [ ] Skip-to-content link di public pages

#### 5.3 Color Contrast
- [ ] Audit badge Guru — pastikan WCAG AA 4.5:1
- [ ] Audit badge Orang Tua — pastikan WCAG AA 4.5:1
- [ ] Audit badge Admin — pastikan WCAG AA 4.5:1
- [ ] Audit text di dark mode

---

### 6. Mobile Responsiveness

#### 6.1 Table Improvements
- [ ] Manajemen Akun — sticky column untuk Nama di mobile
- [ ] Transparansi — card view untuk mobile
- [ ] Semua tables — smooth horizontal scroll di iOS Safari

#### 6.2 Card Layout
- [ ] Org structure — compact mode untuk mobile
- [ ] Student showcase — responsive grid
- [ ] Achievement cards — responsive layout

---

## 🟢 Prioritas Rendah (Nice-to-Have)

### 7. Feature Gaps

#### 7.1 Bulk Actions
- [ ] Checkbox selection di Manajemen Akun
- [ ] Bulk delete (dengan confirmation)
- [ ] Bulk activate/deactivate
- [ ] Bulk role change

#### 7.2 Export Data
- [ ] Export siswa ke CSV/Excel
- [ ] Export guru ke CSV/Excel
- [ ] Export transparansi ke CSV/Excel
- [ ] Export pengumuman ke PDF

#### 7.3 Audit Log
- [ ] Log semua CRUD operations
- [ ] Tampilkan di admin dashboard
- [ ] Filter by user, action, date
- [ ] Export ke CSV

#### 7.4 Two-Factor Auth
- [ ] TOTP-based 2FA untuk SUPER_ADMIN
- [ ] QR code setup flow
- [ ] Backup codes generation

#### 7.5 Webhook Notifications
- [ ] Push ke WhatsApp saat pengaduan baru
- [ ] Push ke Telegram
- [ ] Email notification untuk admin

---

### 8. DevEx Improvements

#### 8.1 Build Artifacts
- [x] tsconfig.json auto-modified — sudah di-gitignore ✅
- [x] dapodik-client/node_modules/ sudah dihapus (37 MB) ✅
- [ ] Pastikan .next-gate/ tidak muncul di production
- [ ] Pre-commit hook untuk cek stray build artifacts

#### 8.2 Documentation
- [ ] Update CONTRIBUTING.md dengan path absolut DATABASE_URL
- [ ] Update README.md dengan security guarantee
- [ ] Document rate limiting policy
- [ ] Document backup/restore procedure

---

### 9. Monitoring & Observability

#### 9.1 APM Integration
- [ ] Setup Sentry untuk error tracking
- [ ] Setup performance monitoring
- [ ] Setup alerting untuk error rate > 1%

#### 9.2 Health Check
- [x] Buat /api/health endpoint (DB + Redis status) ✅
- [ ] Tambahkan uptime monitoring
- [ ] Tambahkan response time monitoring

#### 9.3 Structured Logging
- [ ] Ganti console.log dengan pino
- [ ] Setup log aggregation
- [ ] Tambahkan request ID tracking

---

## 📊 Progress Tracker

| Kategori | Total | Selesai | Progress |
|---|---|---|---|
| 🔴 Security | 15 | 3 | 20% |
| 🔴 Performance | 12 | 0 | 0% |
| 🔴 Error Handling | 5 | 0 | 0% |
| 🟡 Testing | 14 | 0 | 0% |
| 🟡 Accessibility | 12 | 0 | 0% |
| 🟡 Mobile | 6 | 0 | 0% |
| 🟢 Features | 15 | 0 | 0% |
| 🟢 DevEx | 6 | 3 | 50% |
| 🟢 Monitoring | 6 | 0 | 0% |
| **TOTAL** | **91** | **6** | **7%** |

---

## 📅 Timeline

| Minggu | Fokus | Target |
|---|---|---|
| Minggu 1 | Security hardening | Semua Prioritas Tinggi selesai |
| Minggu 2 | E2E refactoring | 88 tests hijau di Dapodik scale |
| Minggu 3 | Accessibility + Mobile | WCAG AA compliance |
| Minggu 4 | Monitoring + Docs | Sentry + health check |
| Minggu 5+ | Features | Bulk actions, export, audit log |

---

## 📝 Catatan

- **Identity no-leak contract** sudah sangat baik
- **Session cookies** sudah aman (httpOnly, secure, sameSite)
- **CSRF protection** sudah aktif di semua mutation endpoints
- **Rate limiting** sudah aktif di public forms, perlu ditambah ke students showcase

---

*Plan ini akan di-update setiap kali ada perubahan signifikan.*
