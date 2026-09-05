# 🏗️ Jembatan Dapodik untuk CMS MONSA

## Apa Itu Jembatan Dapodik?

Jembatan Dapodik adalah aplikasi yang menghubungkan **Dapodik** (database sekolah dari Kemendikbud) dengan **CMS MONSA** (website sekolah Anda di Vercel + Neon PostgreSQL).

### Masalah yang Dipecahkan

Biasanya, untuk menarik data dari Dapodik ke website:
- ❌ Dapodik tidak bisa diakses dari internet (hanya jalan di localhost)
- ❌ Vercel (cloud hosting) tidak bisa akses localhost sekolah
- ❌ PC sekolah tidak selalu menyala

### Solusi: Aplikasi Bridge

Aplikasi bridge ini dijalankan di **PC sekolah** (tempat Dapodik terinstall), lalu mengirim data ke cloud secara aman.

---

## 📥 Cara Download dan Install

### Langkah 1: Download File Executable

Download file `Jembatan-Dapodik.exe` dari:
- Releases page di GitHub repository ini
- Atau minta file ke operator yang sudah build

### Langkah 2: Simpan di Folder

Simpan file `Jembatan-Dapodik.exe` di folder yang mudah diakses, misalnya:
- Desktop
- Folder Dokumen
- Folder khusus aplikasi sekolah

### Langkah 3: Jalankan Aplikasi

**Double-click** file `Jembatan-Dapodik.exe`

Aplikasi akan terbuka di browser secara otomatis di alamat:
```
http://localhost:3847
```

---

## ⚙️ Setup Pertama Kali

### A. Setup di Aplikasi Dapodik

1. Buka **Aplikasi Dapodik** di komputer Anda
2. Login sebagai **Admin**
3. Klik menu **Pengaturan** (pojok kiri bawah)
4. Cari bagian **Web Service Lokal** → klik **Web Service**
5. Klik tombol **Tambah**
6. Isi formulir:
   - **Nama Aplikasi**: `Jembatan-CMS`
   - **IP Address**: `localhost`
7. Klik **Simpan**
8. **Salin Token** yang muncul (klik tombol salin token)

### B. Setup di Aplikasi Jembatan

1. Buka aplikasi Jembatan di browser (`http://localhost:3847`)
2. Isi formulir pengaturan:

| Field | Nilai | Keterangan |
|-------|-------|------------|
| **URL CMS** | `https://[domain].vercel.app` | Domain website sekolah Anda |
| **Kunci Pairing CMS** | (dari CMS dashboard) | Buat di CMS → Dapodik → Jembatan |
| **NPSN** | Nomor NPSN | Nomor NPSN sekolah Anda |
| **Token Web Service** | (dari langkah A) | Token yang sudah disalin |
| **Host Dapodik** | `localhost` | Default, biarkan |
| **Port Dapodik** | `5774` | Default, biarkan |

3. Klik **Simpan**

---

## 🔄 Sinkronisasi Data

### Cara Manual (via Browser)

1. Buka aplikasi Jembatan di browser
2. Klik tombol **Tarik & Kirim**
3. Tunggu sampai selesai
4. Lihat log untuk memastikan berhasil

### Cara Otomatis (via Command Line)

Jika Anda lebih suka sinkronisasi otomatis:

1. Buka Command Prompt (Windows) atau Terminal
2. Arahkan ke folder tempat file disimpan
3. Jalankan:
   ```bash
   Jembatan-Dapodik.exe test      # Test koneksi dulu
   Jembatan-Dapodik.exe preview    # Preview data
   Jembatan-Dapodik.exe sync       # Sinkronisasi
   ```

---

## 📊 Data Apa yang Diambil?

| Data | Keterangan |
|------|------------|
| **Data Sekolah** | Nama, NPSN, alamat |
| **Peserta Didik** | Daftar siswa (NIS, nama, kelas, orang tua) |
| **GTK** | Daftar guru dan staf (NUPTK, NIP, jabatan) |
| **Rombongan Belajar** | Daftar kelas/rombel |

---

## 🔧 Troubleshooting

### Error: "Port 3847 sedang dipakai"

Ada proses jembatan lain yang berjalan.
- Buka Task Manager
- Cari proses "Jembatan-Dapodik" atau "node"
- Klik End Task
- Jalankan aplikasi lagi

### Error: "Tidak bisa terhubung ke Dapodik"

1. Pastikan aplikasi Dapodik sudah dibuka
2. Pastikan Dapodik sudah login dan database terhubung
3. Cek apakah Dapodik menampilkan "Terhubung dengan database"
4. Buka menu Pengaturan → Web Service, pastikan Dapodik listen di port 5774

### Error: "Koneksi CMS gagal"

1. Pastikan URL CMS benar (include `https://`)
2. Pastikan website CMS sudah online (bisa diakses dari browser)
3. Pastikan Kunci Pairing benar
4. Cek apakah ada error di Vercel dashboard

### Error: "Token salah"

1. Buka Dapodik → Pengaturan → Web Service
2. Hapus Web Service yang lama
3. Buat Web Service baru
4. Salin token yang baru
5. Update di aplikasi Jembatan

---

## 📅 Kapan Harus Sinkronisasi?

Disarankan sinkronisasi saat:

| Kapan | Alasan |
|-------|--------|
| Awal tahun ajaran | Data siswa dan guru baru masuk |
| Ada siswa baru | Siswa pindahan atau baru mendaftar |
| Ada guru baru | Guru baru ditugaskan |
| Ada perubahan kelas | Perpindahan kelas siswa |
| Sebelum rapor | Pastikan data terbaru untuk rapor |

---

## 🔒 Keamanan

- ✅ Aplikasi hanya jalan di komputer lokal (localhost)
- ✅ Data dikirim via HTTPS ke CMS
- ✅ Token tidak disimpan dalam teks plain di cloud
- ✅ Token di-encrypt di database CMS
- ⚠️ Jangan bagikan file .exe ke orang yang tidak berwenang
- ⚠️ Jangan simpan token di tempat yang tidak aman

---

## 💡 Tips untuk Operator

1. **Buat shortcut** di Desktop untuk akses cepat
2. **Buat jadwal rutin** sinkronisasi (misalnya setiap Senin pagi)
3. **Backup konfigurasi** dengan copy file `jembatan-config.json`
4. **Catat Kunci Pairing** di tempat yang aman
5. **Test koneksi** dulu sebelum sinkronisasi besar

---

## 📞 Butuh Bantuan?

Jika ada masalah:
1. Cek bagian Troubleshooting di atas
2. Lihat log di aplikasi Jembatan
3. Cek console browser (F12) untuk error detail
4. Hubungi administrator CMS

---

## 📝 Changelog

### v1.0.0 (2026-09-05)
- Rilis pertama
- Mendukung sinkronisasi sekolah, siswa, GTK, rombel
- Interface web + CLI
- Build untuk Windows, macOS, Linux
