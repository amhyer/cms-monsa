# Changelog

Catatan perubahan terkurasi untuk CMS MONSA (SDN Mongisidi 1). Format mengikuti
kesan [Keep a Changelog](https://keepachangelog.com/); tanggal absolut, referensi
commit `git` agar bisa dilacak.

## [2026-09-23] — Blok pasca-program P3 (ef0a683..c192958)

Program P0–P3 `docs/REKOMENDASI-PERBAIKAN-2026-09.md` sudah tutup di `cc1c7cb`;
blok ini adalah lanjutan lintas dua sesi (termasuk pekerjaan agen paralel yang
direview & diverifikasi manual). CI `c192958` hijau penuh — 8 check riil
termasuk 4 suite Playwright e2e (PR, next start, self-host compose, coexistence).

### Ditambahkan

- **Proteksi error per-handler untuk 7 rute mutasi tersisa** (`ed39387`) —
  `scripts/check-mutation-handlers.ts` kini memindai body tiap `POST/PUT/PATCH/DELETE`
  secara string/comment-aware (sebelumnya cukup ada kata `catch` di mana pun di
  file, sehingga 7 handler lolos tanpa proteksi). Kontrak "500 tersanitasi +
  tepat satu `logger.error`, tanpa bocor detail Prisma" diuji di
  `src/lib/__tests__/api/error-contract-new-routes.test.ts`.

### Diubah

- **32 rute API: `try/catch` inline → `withErrorHandling(X_impl)`** (`c192958`)
  — net −135 baris. `withErrorHandling` dapat opsi `errorMessage` untuk
  mempertahankan pesan 500 spesifik rute lama (22 pemakaian); sisanya kembali
  ke pesan generik tersanitasi.

### Diperbaiki

- **Ikon tab (favicon) lambat berubah setelah ganti logo** (`ef0a683`) —
  TTL `/api/favicon` 24 jam → 5 menit (`stale-while-revalidate` 24 jam).
- **Gambar dari URL eksternal isian admin pecah pasca-migrasi next/image**
  (`67413d6`) — komponen baru `src/components/shared/smart-image.tsx`:
  same-origin + host yang terdaftar di `images.remotePatterns` tetap lewat
  optimizer; host asing, `http:`, protocol-relative, dan `data:` otomatis
  `unoptimized` (URL mentah, perilaku sama seperti `<img>` pra-migrasi).
  Daftar host wrapper dikunci identik dengan `next.config.ts` oleh tes
  regresi. 15 komponen publik (termasuk `home-view.tsx` yang lebih dulu
  bermigrasi) hanya berganti baris import.
- **Selector e2e foto siswa** (`7a0febb`) — `img[src^='http']` tidak cocok
  lagi dengan rewrite `/_next/image`; kini menerima kedua bentuk.

### Optimalisasi

- **Migrasi `<img>` → `next/image` di 14 komponen publik** (`0cbfee9`) —
  format avif/webp, `sizes` responsif, `priority` untuk gambar pertama;
  melengkapi konfigurasi `images.remotePatterns` yang sebelumnya hanya
  terpasang di `next.config.ts`.
