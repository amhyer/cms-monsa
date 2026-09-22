# Rekomendasi Perbaikan — CMS MONSA

> Tanggal: 22 September 2026 · Branch: `arena/01a07050-cms-monsa` · Commit: `a3b0d28`
> Metode: setiap temuan diverifikasi terhadap kode saat ini (bukan salinan audit lama).
> Dokumen lama terkait: `AUDIT-PRODUCTION-READINESS.md`, `SECURITY_AUDIT.md`,
> `REPO_HEALTH_AUDIT.md`, `REFACTOR_PLAN.md`, `PROGRESS_LOG_IMPROVEMENTS.md`.

## Status Gerbang Mutu Hari Ini (terverifikasi 22-09-2026)

| Gerbang | Perintah | Hasil |
|---|---|---|
| Typecheck | `bun run typecheck` | ✅ 0 error |
| Lint | `bunx eslint .` | ❌ 5 error — **semuanya dari satu file sisa** (lihat P0-1) |
| Unit test | `bun run test` | ❌ 7 gagal dari 899 — **semuanya dari file sisa yang sama**; 74 file tes asli = 892 tes hijau |
| E2E | suite Playwright | ⚠️ Tidak dijalankan sesi ini (butuh dev server; infra warmup dikenal rapuh — lihat AGENTS.md) |

Kesimpulan: proyek dalam kondisi sehat; satu file sampah membuat repo tampak "bererror"
padahal kode produksi bersih. Setelah P0-1 dilakukan, seluruh gerbang non-E2E hijau.

## Verifikasi Ulang Temuan Audit Lama

| Temuan lama | Status sekarang (verifikasi 22-09) |
|---|---|
| 13 halaman tanpa `loading.tsx` | ✅ Selesai — 36 file `loading.tsx`, semua rute publik + 21 segmen dashboard tercakup |
| Redis/rate limiter in-memory (M4) | ✅ Selesai — ioredis + fallback in-memory terdokumentasi (`src/lib/redis.ts`, `rate-limit.ts`) |
| Middleware auth guard (audit #5) | ✅ Selesai — `src/proxy.ts` menjaga `/dashboard/*` + CORS `/api/*` |
| Cache-busting `Date.now()` di home-view | ✅ Selesai |
| ThemeToggle tersembunyi di mobile | ✅ Selesai |
| Sanitizer, magic-bytes upload, Caddyfile open proxy, switch-role gate, escapeHtml email, scrypt OWASP (N=2^17), password cap 100, Zod enrollments | ✅ Selesai (konsisten dengan commit `734a9af`, `a3b0d28`) |
| Fallback password plaintext di login | ✅ Logika dihapus (`verifyPassword` menolak non-hash) — komentar basi di `src/app/api/auth/login/route.ts` ikut diperbaiki (P1) |
| RSS pengumuman link ke `/` | 🔶 Diperbaiki sebagian — kini `/#pengumuman` (anchor), halaman detail `/announcements/[slug]` memang tidak ada (by design) |
| `getClientIp()` percaya `X-Forwarded-For` (H1) | ✅ Selesai (P1) — header dibaca hanya bila `TRUST_PROXY=true`; docker-compose set defaults true di belakang Caddy |
| Manager >800 baris (audit #8) | ✅ Selesai (P2-1) — 6 file (settings 1069 … students 800) dipecah ke folder `modules/<name>/` + barrel; file terbesar kini `bos-expenditures-manager.tsx` (781, di luar scope) |
| `console.*` di client (audit #7) | ✅ Nyaris selesai — API 0, components 1; sisa 22 di `src/lib/` (mayoritas CLI scraper Dapodik, wajar) |
| picsum.photos (audit #1) | 🔶 Sisa 8 di `prisma/seed.ts` saja (data demo) — nol di `src/` |

## P0 — Bersihkan Sisa File (≤ 1 jam, hasilkan "repo tanpa error")

1. **Hapus file tes sementara** `src/lib/__tests__/zz-tmp-verify-catch.test.ts`
   (untracked, header-nya sendiri menulis "Delete after verification").
   Ini satu-satunya penyebab 5 error lint (`no-explicit-any`) dan 7 kegagalan
   vitest. Perintah: `rm src/lib/__tests__/zz-tmp-verify-catch.test.ts` lalu
   `bun run lint && bun run test` → keduanya hijau.
2. **Hapus artefak lokal untracked**: `src/graphify-out/`,
   `cms-monsa-static-FINAL2.zip` (4,5 MB), `cms-monsa-static-FINAL3.zip` (4,4 MB).
   Tidak ter-track git, tapi menumpuk di disk dan bisa terbawa arsip/copy.
3. **Hapus dependensi mati** di `package.json`:
   - `isomorphic-dompurify` — tidak diimpor lagi; `src/lib/sanitize.ts` kini
     memakai `sanitize-html` (komentar historis saja yang menyebut dompurify).
   - `pg` + `@types/pg` — nol impor di `src/` (Prisma pakai driver Rust sendiri).
   Verifikasi: `bun remove isomorphic-dompurify pg @types/pg && bun run check`.
4. **Hapus komentar basi** "Support both hashed and (legacy) plaintext stored
   passwords" di `src/app/api/auth/login/route.ts:64` — menyesatkan saat audit
   berikutnya karena fallback itu sudah tidak ada.

## P1 — Minggu Ini (konsistensi & batas kepercayaan) — ✅ SELESAI 22-09-2026

> Implementasi: `withErrorHandling` di-refactor pass-through + 28 rute mutasi
> dibungkus; guard `bun run check:mutation-handlers` masuk rantai `check`
> (pre-commit + CI ikut terkunci); `TRUST_PROXY` jadi batas kepercayaan
> eksplisit header proxy (default compose `true` di belakang Caddy, lihat
> RUNNING.md §13); cap per-IP login (20 gagal/15 menit, `isIpLocked`)
> terverifikasi sudah aktif di `login/route.ts` sejak `a3b0d28`.

1. **Konsistensi error handling API**: dari 104 `route.ts`, ±39 file tidak punya
   `catch` sama sekali. Helper `withErrorHandling` sudah ada di
   `src/lib/api-helpers.ts` tetapi **belum dipakai satu rute produksi pun**
   (hanya oleh tes sementara yang dihapus di P0-1) — saat ini ia dead code.
   Rekomendasi: bungkus handler rute yang belum terlindungi dengan
   `withErrorHandling`, mulai dari 8 rute mutasi tersisa tanpa catch; atau
   sebaliknya hapus helper bila tim memilih pola try-catch eksplisit.
   Jangan biarkan dua pola berjalan beriringan. Tambah guard CI sederhana
   (skrip periksa `route.ts` tanpa `catch`/`withErrorHandling` → gagal).
2. **Batas kepercayaan proxy (H1)**: `src/lib/rate-limit.ts:44-50` masih
   memprioritaskan `x-forwarded-for` dari klien tanpa konfirmasi. Di belakang
   Caddy (`header_up X-Forwarded-For {remote_host}` menimpa nilai klien) ini
   aman, tapi port 3000 yang terekspos membuat rate limit login bisa di-bypass
   dengan header palsu — sekaligus memungkinkan lockout akun orang lain.
   Rekomendasi: kebijakan eksplisit via env `TRUST_PROXY=true` (hanya set di
   deployment Caddy); tanpa flag itu, pakai IP socket / `x-real-ip` saja dan
   abaikan XFF. Tambahkan unit test "XFF diabaikan saat TRUST_PROXY unset".
3. **Rate limit login lintas akun (M5)**: pastikan cap per-IP global sudah aktif
   (selain kunci per email+IP) agar credential stuffing banyak email dari satu IP
   tetap terblokir.

## P2 — 1–2 Minggu (struktur kode) — ✅ SELESAI 22-09-2026

> Catatan implementasi: keenam manager dipecah ke folder `modules/<name>-manager/`
> dengan barrel `index.tsx` (path import konsumen tidak berubah; named + default
> export dipertahankan; semua file <450 baris). `dapodik-sync.ts` menjadi folder
> `src/lib/dapodik-sync/` (types/normalize/plan/commit + barrel re-export helper
> & config agar 15+3 import lama tetap bekerja). Kuota upload M7: 50 file/24 jam
> per pengguna di `/api/upload` dan `/api/bos-documents` (Redis/in-memory, nonaktif
> saat `E2E_SUITE=1`). Jalur Vercel ditandai LEGACY (`docs/legacy/VERCEL_DEPLOYMENT.md`,
> komentar di workflow) — `vercel.json` + workflow dipertahankan sebagai fallback.

1. **Pecah 6 file manager dashboard** yang melewati 800 baris:
   `settings-manager.tsx` (1069), `users-manager.tsx` (1049),
   `dapodik-manager.tsx` (981), `teachers-manager.tsx` (896),
   `news-manager.tsx` (823), `students-manager.tsx` (800).
   Pola usang yang sama berulang: satu file berisi tabel + form dialog +
   filter + bulk actions. Rekomendasi per modul:
   `modules/<name>/index.tsx` (state & wiring) + `<name>-table.tsx` +
   `<name>-form-dialog.tsx` + `<name>-filters.tsx`, util umum naik ke
   `dashboard/_shared.tsx`. Kerjakan satu modul per PR dengan e2e modul
   tersebut sebagai jaring pengaman; target < 400 baris per file.
2. **`src/lib/dapodik-sync.ts` (767 baris)** — pisahkan fetcher, mapping, dan
   transaksi DB agar sync dapat diuji per lapisan (scheduler sudah punya tes
   sendiri).
3. **Kuota upload per pengguna (M7)**: upload masih tanpa batas jumlah per
   user/hari; akun GURU/OPERATOR bisa mengisi disk. Tambah kuota harian
   sederhana via limiter Redis/in-memory yang sudah ada.
4. **Komentar & dokumentasi**: sinkronkan `docs/DEPLOYMENT.md` (masih ada
   rujukan lama) dan arsipkan jalur Vercel — `vercel.json`,
   `.github/workflows/deploy-vercel.yml`, `docs/VERCEL_DEPLOYMENT.md` — ke
   subfolder `docs/legacy/` atau hapus, karena target produksi kini self-host
   Docker (6 file compose). Workflow lama yang tidak dipakai menambah kebisingan CI
   (9 workflow aktif).

## P3 — Berkelanjutan (operasional & produk)

1. **Alerting Sentry**: error tracking sudah aktif, tapi dua item TODO masih
   terbuka — dashboard performance monitoring dan alert error rate > 1%.
   Untuk self-host, tambahkan aturan alert di Grafana (stack Loki/Grafana sudah
   tersedia via `docker-compose.logging.yml`) atau Sentry webhook.
2. **Halaman detail pengumuman**: pertimbangkan `/announcements/[slug]` agar
   tautan RSS dan broadcast WhatsApp mengarah ke konten penuh; saat ini
   jangkar `/#pengumuman` bisa diterima, tapi catat sebagai keputusan desain
   di `ARCHITECTURE.md` agar tidak muncul lagi sebagai "temuan" di audit berikutnya.
3. **Foto asli untuk seed demo**: 8 URL `picsum.photos` hanya ada di
   `prisma/seed.ts`. Untuk demo publik/ekspor, ganti dengan foto sekolah asli
   atau folder `public/demo/`; biarkan di seed dev jika memang disengaja.
4. **Sisa `console.*` di `src/lib/`**: 15 di antaranya milik
   `dapodik-scraper-cli.ts`/`dapodik-scraper.ts` (pola CLI, wajar); audit 3 sisanya
   (`encryption.ts`, `db.ts`, `auth.ts`) → konversi ke `logger` pino.
5. **Kebiasaan repo**: lanjutkan aturan `REPO_HEALTH_AUDIT.md` (commit logis kecil,
   pre-commit gate aktif). Setelah P0, jaga `git status --porcelain` mendekati 0
   dan jangan tinggalkan file "zz-tmp*" — tambahkan `**/zz-tmp*` ke `.gitignore`
   sekaligus guard di `hooks:check` agar tes sementara tidak pernah lolos ke gate.

## Estimasi & Urutan Eksekusi

| Prioritas | Usaha | Dampak | Verifikasi akhir |
|---|---|---|---|
| P0 (4 item) | ± 1 jam | Repo langsung hijau semua | `bun run lint` + `bun run test` + `bun run typecheck` |
| P1 (3 item) | 0,5–1 hari | Konsistensi 500-handler + anti rate-limit-bypass | `bun run check` + tes baru XFF |
| P2 (4 item) | 3–5 hari | Maintainability modul terbesar | e2e per modul + `bun run check` |
| P3 (5 item) | ongoing | Operasional & kualitas produk | manual + alert test |

**Saran langkah pertama sekarang juga**: kerjakan P0-1 s/d P0-4 (satu commit
`chore: hapus artefak sisa + dependensi mati`), jalankan `bun run check`, lalu
lanjut P1-1 (wiring `withErrorHandling`) karena helper-nya sudah tersedia.
