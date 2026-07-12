# Daftar Akun Pengguna — CMS SD Negeri Unggulan Mongisidi 1

> **PERHATIAN:** Dokumen ini berisi daftar akun untuk keperluan **purwarupa/prototype**.
> Password di bawah adalah password awal dari data seed. Pada produksi nyata,
> password disimpan dalam bentuk **hash** (tidak dapat dibaca) dan harus diganti
> melalui menu **Manajemen Operator** di dashboard admin. Jangan menyimpan
> password asli di repositori pada lingkungan produksi.

**Login URL:**

| Portal | Link |
|---|---|
| Login Admin (Super Admin) | `/#/admin-login` |
| Login Umum (Operator & Admin) | `/#/login` |

---

## Akun Super Admin

Akses penuh: manajemen konten + pengaturan situs + manajemen operator + log aktivitas.

| Nama | Email | Password | Status |
|---|---|---|---|
| Nawawi Hamzah, S.Pd., M.Pd. | `admin@mongisidi1.sch.id` | `admin123` | ✅ Aktif |

---

## Akun Operator

Akses: CRUD berita, pengumuman, agenda, galeri, prestasi, guru & staf, pesan masuk.
**Tidak** dapat mengakses pengaturan situs, manajemen operator, atau log aktivitas.

| Nama | Email | Password | Status |
|---|---|---|---|
| Siti Aminah, S.Pd. | `operator@mongisidi1.sch.id` | `operator123` | ✅ Aktif |
| Muhammad Yusuf, S.Pd. | `yusuf@mongisidi1.sch.id` | `operator123` | ✅ Aktif |
| Fatimah Zahra, S.Pd. | `fatimah@mongisidi1.sch.id` | `operator123` | ⛔ Nonaktif |

---

## Catatan

- **Akun Fatimah Zahra** sengaja dinonaktifkan sebagai contoh akun yang di-suspend.
  Login akan ditolak dengan pesan "Akun Anda dinonaktifkan."
- Super Admin dapat menonaktifkan/mengaktifkan kembali akun operator melalui menu
  **Manajemen Operator** di dashboard.
- Tombol **Switch Role (Mock)** di dashboard topbar memungkinkan admin berpindah
  peran ke Operator (dan sebaliknya) tanpa logout — untuk menguji hak akses RBAC.
- Untuk mengganti password akun: login sebagai Super Admin →
  **Manajemen Operator** → Edit akun → isi field "Password Baru" (kosongkan jika
  tidak ingin mengubah).
