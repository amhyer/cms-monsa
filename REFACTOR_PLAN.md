# Tech Debt & Rencana Refactor — CMS MONSA

> Tanggal: 2026-08-01 · Tujuan: identifikasi utang teknis, usulan penyederhanaan, dan rencana refactor bertahap yang aman.

## Ringkasan Eksekutif

| # | Area | Keparahan | Estimasi usaha | Risiko refactor |
|---|------|-----------|----------------|-----------------|
| 1 | **Routing hybrid: hash router + App Router** | 🔴 Tinggi | 2–3 hari | Sedang (uji e2e) |
| 2 | **Campuran bun/npm** | 🟡 Sedang | 0.5 hari | Rendah |
| 3 | **`build.sh` path hardcoded + patch `.env`** | 🟠 Tinggi* | 0.5 hari | Rendah |
| 4 | **Dual database path (`db/` vs `prisma/db/`)** | 🟠 Tinggi* | 0.5 hari | Sedang |
| 5 | **Wrapper i18n custom (`use-i18n.ts`) di atas next-intl** | 🟡 Sedang | 0.5 hari | Rendah |
| 6 | **Duplikasi toast (`toast.tsx`/`toaster.tsx` + `sonner`)** | 🟢 Rendah | 0.25 hari | Rendah |
| 7 | **`switch-role` mock di produksi** | 🟠 Tinggi* | 0.25 hari | Rendah |
| 8 | **Kebiasaan repo (super-commit, file hilang)** | 🟠 Tinggi* | lihat REPO_HEALTH_AUDIT | — |

\* Sudah diidentifikasi di `REPO_HEALTH_AUDIT.md` / `SECURITY_AUDIT.md` — dimasukkan di sini karena menyatu dengan refactor.

---

## 1. 🔴 Routing Hybrid: Hash Router + App Router (prioritas utama)

### Kondisi saat ini

Dua sistem routing berjalan bersamaan:

```
App Router (SSR):  /  /login  /admin-login  /news  /news/:slug  /gallery  ...
Hash router (SPA): /dashboard → #/dashboard/news  #/dashboard/payments  dst.
```

- `src/store/app.ts` — `navigate()`, `isAppPageRoute()`, `APP_PAGE_ROUTES`, `initHashRouter()`, `currentHashRoute()`.
- `src/components/route-sync.tsx` — mount `initHashRouter()` + CSRF interceptor di root layout.
- `src/components/dashboard/dashboard-shell.tsx` — **giant `switch (route)` 17-case** (`renderModule`) + `currentTitle()`.
- `seo-manager.tsx`, `site-header.tsx`, `public-site.tsx`, `news-detail-view.tsx` membaca `useAppStore((s) => s.route)`.
- `error.tsx`, `not-found.tsx`, `error-boundary.tsx` melakukan `window.location.hash = "/"` manual.

### Kenapa ini utang

1. **Dua sistem navigasi** — setiap klik harus memutuskan "App Router atau hash?" (`isAppPageRoute`) → kompleksitas mental tinggi.
2. **Store Zustand mengatur routing** — routing seharusnya jadi tanggung jawab framework, bukan state manager. Ini menciptakan coupling: semua komponen butuh `useAppStore(s => s.route)` untuk tahu halaman aktif.
3. **Tidak ada SEO/SSR untuk sub-halaman dashboard** — `#/dashboard/news` tidak bisa di-render server, tidak bisa di-index, tidak punya URL bersih.
4. **Semantik browser rusak** — back/forward tidak natural, scroll position bermasalah, deep-link manual.
5. **Kode hacks**: `window.location.hash = "/"` di error/not-found; `APP_PAGE_ROUTES` harus di-maintain manual setiap tambah halaman.

### Rencana refactor: migrasi dashboard ke App Router murni

**Target akhir:** hapus hash router + routing store sepenuhnya; setiap modul dashboard jadi route App Router.

```
Sebelum:  /dashboard  (SPA, hash #/dashboard/news)
Sesudah:  /dashboard              → overview (ringkasan)
          /dashboard/news         → NewsManager
          /dashboard/announcements→ AnnouncementsManager
          ... (17 route App Router, satu per modul)
```

**Langkah bertahap (setiap tahap = commit terpisah + test hijau):**

| Tahap | Aksi | Detail |
|-------|------|--------|
| 1A | Buat layout dashboard bersama | `src/app/dashboard/layout.tsx` (client) memindahkan shell/topbar/sidebar dari `dashboard-shell.tsx`; buang `renderModule` & `currentTitle`. **Pindahkan juga `fetchMe()` + `fetchSettings()` + guard unauth → `/login` ke layout ini** (bukan per-page) agar tidak diduplikasi 17×. Judul topbar aktif kini dihitung dari `usePathname()` ↔ `DASHBOARD_NAV` (menggantikan `currentTitle`). |
| 1A' | Pertahankan proteksi akses di layout | Pindahkan `ADMIN_PATHS` → `<AccessDenied />` (users/settings/logs = SUPER_ADMIN only) + filter menu GURU dari shell ke `layout.tsx` memakai `usePathname()`. **Satu guard di layout melindungi semua 17 route** — tanpa ini, route admin bisa terbuka diam-diam setelah refactor. |
| 1B | Buat 17 `page.tsx` | `src/app/dashboard/news/page.tsx` → `<NewsManager />`, dst. **Tanpa** `useEffect` fetch (sudah di layout 1A) — setiap page hanya render modulnya. |
| 1C | Ganti `navigate()` dengan `next/link`/`useRouter` | Di sidebar, dashboard-search, dan semua modul dashboard. Hapus `switch (route)` di shell. |
| 1D | Hapus routing store | Buang `APP_PAGE_ROUTES`, `isAppPageRoute`, `initHashRouter`, `currentHashRoute`, `setRoute`; ganti `route` store dengan `usePathname()` di komponen yang butuh (seo-manager, header). |
| 1E | Bersihkan `window.location.hash` hacks | `error.tsx`, `not-found.tsx`, `error-boundary.tsx` → pakai `router.push("/")` / `<Link>`. |
| 1F | Hapus `route-sync.tsx` hash bagian | Pertahankan hanya CSRF interceptor (`setupCsrfInterceptor`) — bisa dipindah ke komponen terpisah `CsrfProvider`. |

**Catatan penting:** URL lama `#/dashboard/news` akan patah. Tambahkan redirect di `dashboard/page.tsx` (baca hash lama → `redirect()` ke route baru) selama 1–2 rilis transisi.

### Validasi per tahap

- `npm run lint` (0 error), `npm run test` (110 tests hijau), `npx tsc --noEmit`.
- E2E Playwright: `login`, `news-crud`, `rbac`, `announcements-crud`, `agenda-crud`, `gallery-crud` — semua harus tetap lulus; tambahkan spec `dashboard-navigation` yang mengeklik tiap menu sidebar dan memastikan URL benar.
- Manual smoke: login sebagai SUPER_ADMIN, OPERATOR, GURU → sidebar menampilkan menu sesuai role; deep-link `#/dashboard/news` → redirect.

---

## 2. 🟡 Campuran bun/npm

### Kondisi

- Lockfile kanonik: **`bun.lock`** (di-track). `package-lock.json` sempat muncul 3× di history (sudah dihapus).
- `.zscripts/*.sh` semua pakai `bun install` / `bun run`.
- `README.md` menulis `bun run db:push` **dan** `npx tsx prisma/seed.ts`; `DEPLOYMENT.md` & `PROGRESS_LOG.md` menulis `npm ci`, `npm run db:*`.
- `package.json` `db:seed` = `node prisma/seed.ts` — **tidak akan jalan**: `seed.ts` meng-import `../src/lib/format.ts` (TypeScript) yang tidak bisa dijalankan `node` polos.

### Keputusan & aksi

**Standarisasi ke bun** (karena lockfile bun.lock dan seluruh script infra memakainya):

1. `README.md`: seragamkan semua contoh ke `bun run` / `bunx tsx`.
2. `DEPLOYMENT.md`: `npm ci` → `bun install --frozen-lockfile`; `npm run db:migrate:prod` → `bun run db:migrate:prod`.
3. `package.json db:seed`: ganti `node prisma/seed.ts` → `bunx tsx prisma/seed.ts` (wajib — yang sekarang rusak karena import `.ts`).
4. Tambah `.gitignore`: `package-lock.json` (agar tidak pernah masuk lagi).
5. **Alternatif (jika tim lebih nyaman npm):** hapus `bun.lock`, generate `package-lock.json`, ubah semua `.zscripts`. — Pilih SATU, jangan dua-duanya.

---

## 3. 🟠 `build.sh` path hardcoded + patch `.env`

### Kondisi (sudah ada di REPO_HEALTH_AUDIT)

- `build.sh` baris `NEXTJS_PROJECT_DIR="/home/z/my-project"` — path sandbox spesifik → rusak di mesin lain.
- `dev.sh` & `build.sh` punya blok "auto-correct" `.env` (`if grep -q "file:/home" .env; then echo ... > .env`) — menimpa `.env` secara destruktif.

### Aksi refactor

1. `build.sh`: ganti hardcoded path dengan relative-ke-script:
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
   NEXTJS_PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
   ```
2. Hapus blok auto-correct `.env` dari `dev.sh` & `build.sh` (setelah `.env` benar-benar untracked — langkah REPO_HEALTH). `.env` yang hilang → error Prisma yang jelas, bukan korup diam-diam.
3. `dev.sh` pakai `export DATABASE_URL` saja, jangan menulis file.

---

## 4. 🟠 Dual database path (`db/` vs `prisma/db/`)

### Kondisi

- `DATABASE_URL="file:./db/custom.db"` → Prisma me-resolve relatif ke lokasi **schema** (`prisma/schema.prisma`) → sebenarnya `prisma/db/custom.db`.
- Tapi `build.sh` menyalin `./db/.` → `$BUILD_DIR/db/` (path root). Backup script cek keduanya.

### Aksi

1. Tetapkan **satu** lokasi kanonik: `prisma/db/custom.db` (sesuai resolusi Prisma).
2. `build.sh`: salin dari `prisma/db/`; update `README`, `scripts/backup-db.*` (hapus fallback ganda).
3. Hapus `db/custom.db` root yang usang (setelah backup diverifikasi).

---

## 5. 🟡 Wrapper i18n custom (`use-i18n.ts`) di atas next-intl

### Kondisi (terverifikasi)

- next-intl v4 aktif (`request.ts`, `locales.ts`, `messages/{id,en}.json`, `NextIntlClientProvider`).
- `src/i18n/use-i18n.ts` **BUKAN dead code** — dipakai `language-switcher.tsx` (`import { useI18n }`).
- Namun ia adalah **wrapper tipis** yang hanya membungkus API next-intl: `useLocale()` + `useRouter()` + `useTranslations` re-export, dengan `switchLocale()` yang set cookie + `router.refresh()`.
- Indirection ini membuat dua cara mengakses i18n: `useI18n()` (custom) vs next-intl langsung (`useTranslations` dipakai di komponen lain).

### Aksi

1. **Hapus wrapper**: ganti pemakaian di `language-switcher.tsx` dengan next-intl langsung (`useLocale`, `useRouter`) — logika `switchLocale` (set cookie `NEXT_LOCALE` + `router.refresh()`) pindah ke komponen itu.
2. Hapus `src/i18n/use-i18n.ts` (≈30 baris indirection) + re-export `useTranslations` (impor langsung dari `next-intl`).
3. Pertahankan `locales.ts` & `request.ts` (masih diperlukan next-intl).
4. Hapus komentar/baris yang merujuk `i18n/config.ts` (tidak ada di repo — yang ada `request.ts`).
5. **Catatan (menguntungkan)**: adopsi i18n saat ini masih minimal — hanya `language-switcher.tsx` yang memanggil terjemahan (`useTranslations` belum dipakai komponen lain). Artinya menghapus wrapper ini berisiko sangat rendah, dan menambah penerjemahan penuh bisa jadi PR terpisah.

---

## 6. 🟢 Duplikasi toast: shadcn toast vs sonner

### Kondisi

- `src/components/ui/toast.tsx` + `toaster.tsx` (Radix Toast) **dan** `src/components/ui/sonner.tsx` (sonner).
- Root layout me-mount **keduanya** (`<Toaster />` + `<SonnerToaster />`).
- Dashboard memakai `sonner` (`import { toast } from "sonner"`); sebagian UI lain mungkin masih Radix toast.

### Aksi (terverifikasi via grep)

1. **Konfirmasi pemakaian**: `toast.tsx`/`toaster.tsx`/`use-toast.ts` hanya direferensikan di `layout.tsx` (mount `<Toaster />`) + dirinya sendiri; **tidak ada komponen lain** yang pakai `useToast`. Sementara `sonner` dipakai di 10+ komponen (auth, dashboard-shell, semua manager).
2. **Hapus** `toast.tsx`, `toaster.tsx`, `hooks/use-toast.ts` + mount `<Toaster />` di `layout.tsx` — sisakan sonner saja.
3. Verifikasi final: `grep -rn "useToast\|@/components/ui/toast" src/` → harus kosong setelah hapus.

---

## 7. 🟠 `switch-role` mock aktif di produksi

### Kondisi (dari SECURITY_AUDIT H4)

- `POST /api/auth/switch-role` + tombol "Switch Role (Mock)" di dashboard — fitur uji coba yang tidak di-gate `NODE_ENV`.

### Aksi

1. Di produksi: endpoint return 404/403; tombol UI disembunyikan saat `NODE_ENV === "production"`.
2. Jangka panjang: hapus fitur ini dari UI admin (hanya berguna untuk dev testing RBAC).

---

## 8. Kebiasaan repo & cleanup kecil

- Super-commit & file hilang → ikuti rencana `REPO_HEALTH_AUDIT.md` (commit logis, pre-commit hook).
- `src/lib/db.ts`: `log: ["query"]` — verbose di produksi; jadikan kondisional `NODE_ENV !== "production"`.
- Bersihkan `upload/pasted_image_*.png` dari history (sudah di-ignore; opsional rewrite history dengan filter-repo).
- Sinkronkan `schema.prisma` ↔ `schema.postgres.prisma` (jaga agar fitur baru tidak tertinggal di varian Postgres).

---

## 9. Urutan Eksekusi (roadmap)

| Fase | Isi | Estimasi | Risiko |
|------|-----|----------|--------|
| **Fase 1** (aman, cepat) | #7 switch-role gate · #3 build.sh path · #6 toast dedup · #2 bun/npm docs · #5 wrapper i18n | 1–1.5 hari | Rendah |
| **Fase 2** (perlu hati-hati) | #4 dual DB path standarisasi | 0.5 hari | Sedang |
| **Fase 3** (besar) | #1 migrasi dashboard ke App Router murni (tahap 1A–1F) | 2–3 hari | Sedang |
| **Fase 4** (berkelanjutan) | #8 kebiasaan repo + cleanup berkala | on-going | Rendah |

**Aturan emas tiap fase:** satu commit per tahap, `lint` + `tsc` + `npm test` + e2e hijau sebelum lanjut, dan setiap fase dikerjakan di branch terpisah (bukan di main langsung).

---

## 10. Manfaat Setelah Refactor

- **Hapus ±70–100 baris** routing store & hash hacks (navigate, initHashRouter, isAppPageRoute, currentHashRoute, setRoute + hash hacks di error/not-found); `navigate()` → `next/link`.
- URL dashboard bersih & bisa di-index; back/forward browser normal.
- Satu sistem routing (App Router) → lebih sedikit bug, lebih mudah on-boarding developer baru.
- Konsisten satu package manager & satu path DB → tidak ada lagi "file hilang"/"DB salah".
- Bundle lebih kecil (buang komponen tak terpakai), log DB lebih bersih di prod.
