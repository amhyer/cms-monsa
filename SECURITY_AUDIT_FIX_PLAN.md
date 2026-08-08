# Rencana Perbaikan Audit Keamanan

Dokumen ini merangkum temuan audit keamanan dan bug potensial dalam proyek, serta menyusun rencana perbaikan dalam bentuk checklist.

## Temuan dan Rencana Perbaikan

### 1. (Kritis) Dukungan Password Plaintext

- **Masalah**: Sistem saat ini masih mendukung penyimpanan dan validasi password dalam bentuk teks biasa (plaintext). Ini adalah risiko keamanan yang sangat tinggi. Jika database bocor, semua kredensial pengguna akan terekspos.
- **Lokasi**: `src/app/api/auth/login/route.ts`
- **Rencana Perbaikan**:
    - [ ] Buat skrip migrasi satu kali untuk membaca semua password plaintext dari database, mengubahnya menjadi hash menggunakan `scrypt`, dan memperbarui kembali ke database.
    - [ ] Hapus kode fallback `user.password === password` dari logika login.
    - [ ] Pastikan semua proses registrasi dan pembaruan password menggunakan fungsi `hashPassword`.

### 2. (Kritis) Rate Limiter Berbasis Memori

- **Masalah**: Mekanisme rate limiting untuk mencegah serangan brute-force (percobaan login berulang) hanya berjalan di memori server (in-memory `Map`). Ini tidak efektif jika aplikasi dijalankan di lebih dari satu server/instance (misalnya, di lingkungan produksi dengan load balancing), karena setiap instance akan memiliki data limiternya sendiri.
- **Lokasi**: `src/lib/rate-limit.ts`
- **Rencana Perbaikan**:
    - [ ] Ganti implementasi `Map` dengan solusi penyimpanan terpusat seperti **Redis**.
    - [ ] Tambahkan library klien Redis (misalnya, `ioredis`) ke dalam proyek.
    - [ ] Perbarui fungsi-fungsi di `rate-limit.ts` (`isLocked`, `recordFailure`, dll.) untuk berinteraksi dengan Redis.

### 3. Validasi Peran Terbatas pada Endpoint Testing

- **Masalah**: Endpoint untuk testing perpindahan peran (`/api/auth/switch-role`) hanya mengizinkan perpindahan ke `SUPER_ADMIN` dan `OPERATOR`. Ini membatasi kemampuan testing untuk peran lain (misalnya, `GURU`).
- **Lokasi**: `src/app/api/auth/switch-role/route.ts`
- **Rencana Perbaikan**:
    - [ ] Dapatkan daftar semua peran yang valid dari sistem (misalnya, dari tipe `Role` atau enum).
    - [ ] Ubah validasi agar memeriksa apakah `target` ada di dalam daftar peran yang valid, bukan hanya `SUPER_ADMIN` atau `OPERATOR`.

### 4. Potensi Celah Otorisasi di Backend

- **Masalah**: Navigasi UI untuk admin (`adminOnly: true`) didefinisikan di frontend (`src/lib/nav.ts`). Ini hanya menyembunyikan link, tetapi tidak mengamankan endpoint API di backend. Jika endpoint yang sesuai tidak memiliki pemeriksaan otorisasi, pengguna non-admin bisa saja mengaksesnya dengan memanggil URL secara langsung.
- **Lokasi**: API routes yang terkait dengan menu admin, seperti `src/app/api/users/`, `src/app/api/settings/`, dll.
- **Rencana Perbaikan**:
    - [ ] Lakukan verifikasi pada setiap API route yang datanya hanya boleh diakses oleh admin.
    - [ ] Pastikan setiap route tersebut memanggil `requireRole('OPERATOR')` atau `requireRole('SUPER_ADMIN')` di awal proses request.

---
*Dokumen ini dibuat pada 2026-08-07.*
